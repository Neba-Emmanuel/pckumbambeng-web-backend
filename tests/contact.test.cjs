const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { pool } = require('../dist/config/database');
const { env } = require('../dist/config/env');
const routes = require('../dist/routes/contact.routes').default;

test('contact submissions and protected admin inbox', async () => {
  const app = express();
  app.use(express.json(), cookieParser());
  app.use('/api', routes);
  const server = await new Promise((resolve, reject) => {
    const listener = app.listen(0, '127.0.0.1', error => error ? reject(error) : resolve(listener));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const originalExecute = pool.execute;
  const originalQuery = pool.query;
  let saved;
  let databaseCalls = 0;
  pool.execute = async (_sql, values) => {
    databaseCalls++;
    saved = values;
    return [{ insertId: 42 }];
  };
  pool.query = async (sql) => {
    databaseCalls++;
    return [sql.includes('COUNT') ? [{ total: 1 }] : [{ id: 42, name: saved[0], message: saved[4] }]];
  };
  const post = body => fetch(`${base}/api/contact`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const valid = { name: ' Visitor ', email: 'visitor@example.com', subject: ' Sunday visit ', message: 'I would like to visit this Sunday.' };
  try {
    const invalid = await post({ ...valid, email: 'invalid' });
    assert.equal(invalid.status, 400);
    assert.equal(databaseCalls, 0);
    assert.equal((await post({ ...valid, message: ' '.repeat(20) })).status, 400);
    const accepted = await post(valid);
    assert.equal(accepted.status, 201);
    assert.equal((await accepted.json()).data.id, 42);
    assert.deepEqual(saved, ['Visitor', valid.email, null, 'Sunday visit', valid.message]);
    const callsBefore = databaseCalls;
    assert.equal((await fetch(`${base}/api/admin/contact-messages`)).status, 401);
    const nonAdmin = jwt.sign({ sub: 1, role: 'member' }, env.jwt.secret, { expiresIn: '1h' });
    assert.equal((await fetch(`${base}/api/admin/contact-messages`, { headers: { Cookie: `token=${nonAdmin}` } })).status, 403);
    assert.equal(databaseCalls, callsBefore);
    const token = jwt.sign({ sub: 1, role: 'administrator' }, env.jwt.secret, { expiresIn: '1h' });
    const headers = { Cookie: `token=${token}` };
    const inbox = await fetch(`${base}/api/admin/contact-messages`, { headers });
    assert.equal(inbox.status, 200);
    const result = await inbox.json();
    assert.equal(result.data[0].message, valid.message);
    assert.deepEqual(result.meta, { page: 1, pageSize: 20, total: 1 });
    assert.equal((await fetch(`${base}/api/admin/contact-messages?page=-1`, { headers })).status, 400);
    pool.execute = async () => { throw new Error('database unavailable'); };
    const failed = await post(valid);
    assert.equal(failed.status, 500);
    assert.equal((await failed.json()).success, false);
    await post(valid);
    assert.equal((await post(valid)).status, 429);
  } finally {
    pool.execute = originalExecute;
    pool.query = originalQuery;
    await new Promise(resolve => server.close(resolve));
    await pool.end();
  }
});
