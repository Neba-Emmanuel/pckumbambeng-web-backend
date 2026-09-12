const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createEventSchema, updateEventSchema } = require('../dist/models/schemas');
const { EventService } = require('../dist/services/event.service');
const { pool } = require('../dist/config/database');
const base = { title: 'Harvest', event_date: '2026-11-01T09:00:00.000Z', location: 'Church', description: 'Thanksgiving service' };

test('event page validation and partial update transitions', async () => {
  assert.equal(createEventSchema.parse(base).detail_page_status, 'off');
  assert.equal(createEventSchema.safeParse({ ...base, detail_page_status: 'published' }).success, false);
  for (const path of ['https://example.com', '//example.com', '/events/archive', '/events/../login', '/events/a?x=1']) {
    assert.equal(createEventSchema.safeParse({ ...base, detail_page_status: 'published', detail_page_path: path }).success, false);
  }
  assert.equal(createEventSchema.safeParse({ ...base, detail_page_status: 'published', detail_page_path: '/events/harvest-2026' }).success, true);
  assert.equal(updateEventSchema.safeParse({ title: 'New title' }).success, true);
  const service = new EventService();
  let existing = { ...base, id: 1, detail_page_status: 'draft', detail_page_path: null };
  service.getEventById = async () => existing;
  let writes = 0;
  const original = pool.query;
  pool.query = async () => { writes++; return [{ affectedRows: 1 }]; };
  try {
    await assert.rejects(service.updateEvent(1, { detail_page_status: 'published' }));
    assert.equal(writes, 0);
    await service.updateEvent(1, { detail_page_status: 'published', detail_page_path: '/events/harvest-2026' });
    assert.equal(writes, 1);
    existing = { ...existing, detail_page_status: 'published', detail_page_path: '/events/harvest-2026' };
    await assert.rejects(service.updateEvent(1, { detail_page_path: null }));
    await service.updateEvent(1, { title: 'Updated Harvest' });
    await service.updateEvent(1, { detail_page_status: 'off', detail_page_path: null });
    assert.equal(writes, 3);
  } finally { pool.query = original; await pool.end(); }
});
