const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { pool } = require('../dist/config/database');
const router = require('../dist/routes/content.routes').default;

test('custom page lookup validates slug and returns linked event details', async () => {
  const app = express();
  app.use('/api', router);
  const server = await new Promise((resolve, reject) => {
    const listener = app.listen(0, '127.0.0.1', error => error ? reject(error) : resolve(listener));
  });
  const url = `http://127.0.0.1:${server.address().port}/api/events/page/`;
  const original = pool.query;
  let args;
  pool.query = async (sql, values) => { args = values; return [[{ id: 3, title: 'Cultural Harvest 2026', location: 'PC Kumba-Mbeng' }]]; };
  try {
    assert.equal((await fetch(url + 'bad_slug')).status, 400);
    assert.equal(args, undefined);
    const response = await fetch(url + 'cultural-harvest-2026');
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.id, 3);
    assert.deepEqual(args, ['/events/cultural-harvest-2026', 'off']);
    pool.query = async () => [[]];
    assert.equal((await fetch(url + 'missing')).status, 404);
    pool.query = async () => { throw new Error('private database detail'); };
    const failed = await fetch(url + 'cultural-harvest-2026');
    assert.equal(failed.status, 500);
    assert.ok(!(await failed.text()).includes('private database detail'));
  } finally {
    pool.query = original;
    await new Promise(resolve => server.close(resolve));
    await pool.end();
  }
});
