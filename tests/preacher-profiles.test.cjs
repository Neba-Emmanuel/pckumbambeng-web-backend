const { test } = require('node:test');
const assert = require('node:assert/strict');
const { preacherService } = require('../dist/services/preacher.service');
const { SermonService, sermonService } = require('../dist/services/sermon.service');
const { createSermon, updateSermon } = require('../dist/controllers/admin.controller');
const { notificationService } = require('../dist/services/notification.service');
const { preacherSchema } = require('../dist/routes/preachers.routes');
const { createSermonSchema } = require('../dist/models/schemas');
const { pool } = require('../dist/config/database');
const base = { title: 'Hope', speaker: 'stale browser name', preacher_id: '7', sermon_date: '2026-09-20', content_type: 'text', text_content: 'A message' };
const profile = { id: 7, name: 'Saved pastor', kind: 'pastor', image_url: 'https://store.example/preachers/photo.jpg' };
function response() { return { locals: {}, code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; } }; }

test('profile and sermon inputs reject blank names and invalid profile IDs', () => {
  assert.equal(preacherSchema.safeParse({ name: '   ', kind: 'guest' }).success, false);
  assert.equal(preacherSchema.parse({ name: ' Guest preacher ', kind: 'guest' }).name, 'Guest preacher');
  assert.equal(preacherSchema.safeParse({ name: 'Guest', kind: 'administrator' }).success, false);
  for (const value of ['0', '-1', 'abc', '1.5']) assert.equal(createSermonSchema.safeParse({ ...base, preacher_id: value }).success, false);
});

test('sermons reuse the selected profile and cannot replace its photo through sermon edits', async () => {
  const get = preacherService.get, create = sermonService.createSermon, update = sermonService.updateSermon, getSermon = sermonService.getSermonById, notify = notificationService.createNotification;
  let saved;
  preacherService.get = async id => id === 7 ? profile : null;
  sermonService.createSermon = async data => { saved = data; return { id: 1, ...data }; };
  sermonService.getSermonById = async () => ({ ...base, id: 1, preacher_id: 7 });
  sermonService.updateSermon = async (_id, data) => { saved = data; return { id: 1, ...data }; };
  notificationService.createNotification = async () => {};
  try {
    const res = response(); res.locals.preacherImage = 'new-per-sermon-photo.jpg';
    await createSermon({ body: base, member: { id: 1 } }, res);
    assert.equal(res.code, 201); assert.equal(saved.preacher_id, 7); assert.equal(saved.speaker, profile.name); assert.equal(saved.preacher_image, null);
    const invalid = response();
    await createSermon({ body: { ...base, preacher_id: '99' }, member: { id: 1 } }, invalid);
    assert.equal(invalid.code, 400);
    await updateSermon({ params: { id: '1' }, body: { preacher_id: '7', remove_preacher_image: 'true' } }, res);
    assert.equal(saved.preacher_id, 7); assert.equal(saved.preacher_image, undefined);
  } finally { preacherService.get = get; sermonService.createSermon = create; sermonService.updateSermon = update; sermonService.getSermonById = getSermon; notificationService.createNotification = notify; }
});

test('public reads use the profile even when its photo is null, without reviving an old sermon photo', async () => {
  const query = pool.query; const calls = [];
  pool.query = async (sql, params) => { calls.push({ sql, params }); return [sql.includes('COUNT(*)') ? [{ total: 1 }] : [{ id: 1, preacher_id: 7, preacher_image: null }]]; };
  try {
    const service = new SermonService();
    const sermon = await service.getSermonById(1);
    await service.listSermons(1);
    assert.equal(sermon.preacher_image, null);
    for (const call of calls.filter(c => !c.sql.includes('COUNT(*)'))) {
      assert.ok(call.sql.includes('LEFT JOIN preachers'));
      assert.ok(call.sql.includes('CASE WHEN p.id IS NOT NULL THEN p.image_url ELSE s.preacher_image END'));
    }
  } finally { pool.query = query; }
});

test('profile edits keep photos when omitted and clear them only when explicitly requested', async () => {
  const query = pool.query; const calls = [];
  pool.query = async (sql, params) => { calls.push({ sql, params }); return [[profile]]; };
  try {
    await preacherService.update(7, { name: profile.name, kind: 'guest' });
    assert.ok(!calls.find(c => c.sql.startsWith('UPDATE')).sql.includes('image_url ='));
    calls.length = 0;
    await preacherService.update(7, { name: profile.name, kind: 'pastor', image_url: null });
    const write = calls.find(c => c.sql.startsWith('UPDATE'));
    assert.ok(write.sql.includes('image_url = ?')); assert.deepEqual(write.params, [profile.name, 'pastor', null, 7]);
  } finally { pool.query = query; }
});

test('first sermon saves a preacher by name; subsequent sermons reuse the same profile', async () => {
  const remember = preacherService.remember, create = sermonService.createSermon, notify = notificationService.createNotification;
  const profiles = new Map(); const saved = [];
  preacherService.remember = async (name, image) => {
    const key = name.toLowerCase();
    const profile = profiles.get(key) || { id: profiles.size + 1, name, kind: 'guest', image_url: null };
    if (image) profile.image_url = image;
    profiles.set(key, profile); return profile;
  };
  sermonService.createSermon = async data => { saved.push(data); return { id: saved.length, ...data }; };
  notificationService.createNotification = async () => {};
  try {
    const body = { ...base }; delete body.preacher_id;
    const first = response(); first.locals.preacherImage = 'https://store.example/preachers/first.jpg';
    await createSermon({ body, member: { id: 1 } }, first);
    const second = response();
    await createSermon({ body: { ...body, title: 'Another message' }, member: { id: 1 } }, second);
    assert.equal(first.code, 201); assert.equal(second.code, 201);
    assert.equal(saved[0].preacher_id, saved[1].preacher_id);
    assert.equal(profiles.size, 1);
    assert.equal([...profiles.values()][0].image_url, first.locals.preacherImage);
    const invalid = response();
    await createSermon({ body: { ...body, text_content: '' }, member: { id: 1 } }, invalid);
    assert.equal(invalid.code, 400); assert.equal(saved.length, 2);
  } finally { preacherService.remember = remember; sermonService.createSermon = create; notificationService.createNotification = notify; }
});

test('name matching normalizes whitespace and atomically preserves photos when none is supplied', async () => {
  const query = pool.query; const get = preacherService.get; const calls = [];
  pool.query = async (sql, params) => { calls.push({ sql, params }); return [{ insertId: 7 }]; };
  preacherService.get = async () => profile;
  try {
    const result = await preacherService.remember('  Saved   pastor  ');
    assert.equal(result.id, 7);
    assert.deepEqual(calls[0].params, ['Saved pastor', null]);
    assert.ok(calls[0].sql.includes('ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)'));
    assert.ok(calls[0].sql.includes('COALESCE(VALUES(image_url), image_url)'));
    await preacherService.remember('Saved pastor', 'new-photo.jpg');
    assert.deepEqual(calls[1].params, ['Saved pastor', 'new-photo.jpg']);
  } finally { pool.query = query; preacherService.get = get; }
});
