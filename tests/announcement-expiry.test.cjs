const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createAnnouncementSchema, updateAnnouncementSchema } = require('../dist/models/schemas');
const { ContentService, announcementToday } = require('../dist/services/content.service');
const { pool } = require('../dist/config/database');
const controllers = require('../dist/controllers/content.controller');
const { contentService } = require('../dist/services/content.service');

test('expiry date is optional, clearable, and calendar-validated', () => {
  const base = { title: 'Service', body: 'Join us' };
  assert.equal(createAnnouncementSchema.parse(base).expires_on, undefined);
  assert.equal(createAnnouncementSchema.parse({ ...base, expires_on: '' }).expires_on, null);
  assert.equal(updateAnnouncementSchema.parse({ expires_on: null }).expires_on, null);
  assert.equal(updateAnnouncementSchema.parse({ title: 'Changed' }).expires_on, undefined);
  assert.equal(createAnnouncementSchema.safeParse({ ...base, expires_on: '2026-02-30' }).success, false);
  assert.equal(createAnnouncementSchema.safeParse({ ...base, expires_on: '2026-09-20' }).success, true);
});

test('expiry uses Cameroon midnight regardless of server timezone', () => {
  assert.equal(announcementToday(new Date('2026-09-19T22:59:59Z')), '2026-09-19');
  assert.equal(announcementToday(new Date('2026-09-19T23:00:00Z')), '2026-09-20');
});

test('public pagination and detail use inclusive expiry filters; admins can retrieve expired records', async () => {
  const calls = [];
  const original = pool.query;
  pool.query = async (sql, params) => { calls.push({ sql, params }); return [sql.includes('COUNT(*)') ? [{ total: 0 }] : []]; };
  try {
    const service = new ContentService();
    await service.listAnnouncements(2);
    assert.ok(calls[0].sql.includes('expires_on IS NULL OR expires_on >= ?'));
    assert.ok(calls[1].sql.includes('expires_on IS NULL OR expires_on >= ?'));
    assert.equal(calls[0].params[0], calls[1].params[0]);
    assert.deepEqual(calls[1].params.slice(1), [20, 20]);
    calls.length = 0;
    await service.listAnnouncements(1, 20, true);
    assert.ok(calls.every(call => !call.sql.includes('expires_on >= ?')));
    calls.length = 0;
    await service.getAnnouncementById(1, false);
    assert.ok(calls[0].sql.includes('expires_on >= ?'));
    calls.length = 0;
    await service.getAnnouncementById(1, true);
    assert.deepEqual(calls[0].params, [1]);
    assert.ok(!calls[0].sql.includes('expires_on >= ?'));
    calls.length = 0;
    service.getAnnouncementById = async () => ({ id: 1 });
    await service.updateAnnouncement(1, { expires_on: null });
    assert.ok(calls[0].sql.includes('expires_on = ?'));
    assert.deepEqual(calls[0].params, [null, 1]);
  } finally { pool.query = original; }
});

test('a public query cannot opt into expired announcements', async () => {
  const original = contentService.listAnnouncements;
  const flags = [];
  contentService.listAnnouncements = async (_page, _size, includeExpired) => { flags.push(includeExpired); return { items: [], total: 0, page: 1, pageSize: 20 }; };
  try {
    const req = { query: { includeExpired: 'true' } };
    const res = { locals: {}, status() { return this; }, json() {} };
    await controllers.listAnnouncements(req, res);
    res.locals.includeExpired = true;
    await controllers.listAnnouncements(req, res);
    assert.deepEqual(flags, [false, true]);
  } finally { contentService.listAnnouncements = original; }
});
