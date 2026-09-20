const { test, beforeEach, afterEach, mock } = require('node:test');
const { preacherService } = require('../dist/services/preacher.service');
beforeEach(() => mock.method(preacherService, 'remember', async (name, image) => ({ id: 7, name, kind: 'guest', image_url: image || null })));
afterEach(() => mock.restoreAll());
const assert = require('node:assert/strict');
const { createSermon, updateSermon } = require('../dist/controllers/admin.controller');
const { sermonService, SermonService } = require('../dist/services/sermon.service');
const { notificationService } = require('../dist/services/notification.service');
const { resolveBlobUpload } = require('../dist/routes/uploads.routes');
const { pool } = require('../dist/config/database');
const base = { title: 'Hope', speaker: 'Preacher', sermon_date: '2026-09-20', content_type: 'text', text_content: 'A message\n\nA reflection' };
function response() { return { locals: {}, code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; } }; }

test('sermons accept written text and a verified portrait alongside audio', async () => {
  const original = sermonService.createSermon;
  const notify = notificationService.createNotification;
  let saved;
  sermonService.createSermon = async data => { saved = data; return { id: 1, ...data }; };
  notificationService.createNotification = async () => {};
  try {
    const res = response(); res.locals.preacherImage = 'portrait.jpg';
    await createSermon({ body: { ...base, content_type: 'audio' }, file: { mimetype: 'audio/mpeg', size: 10, filename: 'message.mp3' }, member: { id: 1 } }, res);
    assert.equal(res.code, 201);
    assert.equal(saved.preacher_image, null);
    assert.equal(saved.preacher_id, 7);
    assert.deepEqual(preacherService.remember.mock.calls[0].arguments, [base.speaker, 'portrait.jpg']);
    assert.equal(saved.audio_path, 'message.mp3');
    assert.equal(saved.text_content, base.text_content);
    const invalid = response();
    await createSermon({ body: { ...base, text_content: ' ' }, member: { id: 1 } }, invalid);
    assert.equal(invalid.code, 400);
    const noAudio = response();
    await createSermon({ body: { ...base, content_type: 'audio' }, member: { id: 1 } }, noAudio);
    assert.equal(noAudio.code, 400);
  } finally { sermonService.createSermon = original; notificationService.createNotification = notify; }
});

test('unverified raw image paths cannot be submitted in sermon data', async () => {
  const original = sermonService.createSermon;
  const notify = notificationService.createNotification;
  let saved;
  sermonService.createSermon = async data => { saved = data; return { id: 1, ...data }; };
  notificationService.createNotification = async () => {};
  try {
    const res = response();
    await createSermon({ body: { ...base, preacher_image: 'https://attacker.example/image.jpg' }, member: { id: 1 } }, res);
    assert.equal(res.code, 201);
    assert.equal(saved.preacher_image, null);
  } finally { sermonService.createSermon = original; notificationService.createNotification = notify; }
});

test('editing supports keeping, replacing, and removing a portrait', async () => {
  const originalGet = sermonService.getSermonById;
  const originalUpdate = sermonService.updateSermon;
  let saved;
  sermonService.getSermonById = async () => ({ ...base, id: 1, preacher_image: 'old.jpg' });
  sermonService.updateSermon = async (_id, data) => { saved = data; return { ...base, ...data }; };
  try {
    await updateSermon({ params: { id: '1' }, body: { title: 'New title' } }, response());
    assert.equal(saved.preacher_image, undefined);
    const res = response(); res.locals.preacherImage = 'new.jpg';
    await updateSermon({ params: { id: '1' }, body: {} }, res);
    assert.equal(saved.preacher_image, undefined);
    assert.equal(saved.preacher_id, 7);
    assert.deepEqual(preacherService.remember.mock.calls[0].arguments, [base.speaker, 'new.jpg']);
    await updateSermon({ params: { id: '1' }, body: { remove_preacher_image: 'true' } }, response());
    assert.equal(saved.preacher_image, null);
    const invalid = response();
    await updateSermon({ params: { id: '1' }, body: { text_content: '' } }, invalid);
    assert.equal(invalid.code, 400);
  } finally { sermonService.getSermonById = originalGet; sermonService.updateSermon = originalUpdate; }
});

test('portrait upload validation rejects external and wrong-folder URLs before storage access', async () => {
  const originalBase = process.env.BLOB_PUBLIC_BASE_URL;
  process.env.BLOB_PUBLIC_BASE_URL = 'https://example.public.blob.vercel-storage.com';
  try {
    for (const url of ['https://attacker.example/preachers/file.jpg', 'https://example.public.blob.vercel-storage.com/sermons/file.mp3', 'file:///tmp/photo.jpg']) {
      const res = response(); let proceeded = false;
      await resolveBlobUpload('preacher_image')({ body: { preacher_image_url: url } }, res, () => { proceeded = true; });
      assert.equal(res.code, 400); assert.equal(proceeded, false);
    }
  } finally { if (originalBase === undefined) delete process.env.BLOB_PUBLIC_BASE_URL; else process.env.BLOB_PUBLIC_BASE_URL = originalBase; }
});

test('database writes include portrait and clearing uses a bound null value', async () => {
  const original = pool.query; const calls = [];
  pool.query = async (sql, params) => { calls.push({ sql, params }); return [sql.startsWith('INSERT') ? { insertId: 1 } : [{ id: 1, ...base }]]; };
  try {
    const service = new SermonService();
    await service.createSermon({ ...base, preacher_image: 'image.jpg', created_by: 1 });
    assert.ok(calls[0].sql.includes('preacher_image')); assert.ok(calls[0].params.includes('image.jpg'));
    calls.length = 0;
    await service.updateSermon(1, { preacher_image: null });
    const update = calls.find(call => call.sql.startsWith('UPDATE'));
    assert.ok(update.sql.includes('preacher_image = ?')); assert.deepEqual(update.params, [null, 1]);
  } finally { pool.query = original; }
});
