const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const uploads = require('../dist/routes/uploads.routes');
const { authMiddleware } = require('../dist/middleware/auth.middleware');
const { adminMiddleware } = require('../dist/middleware/admin.middleware');
const { env } = require('../dist/config/env');

test('upload authorization and external URL rejection', async () => {
  const app = express();
  app.use(express.json(), cookieParser());
  app.use('/api/uploads', uploads.default);
  app.post('/save', authMiddleware, adminMiddleware, uploads.resolveBlobUpload('audio'), (_req, res) => res.json({ success: true }));
  const oldToken = process.env.BLOB_READ_WRITE_TOKEN;
  const oldBase = process.env.BLOB_PUBLIC_BASE_URL;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  process.env.BLOB_PUBLIC_BASE_URL = 'https://example.public.blob.vercel-storage.com';
  const server = await new Promise((resolve, reject) => {
    const listener = app.listen(0, '127.0.0.1', error => error ? reject(error) : resolve(listener));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const token = jwt.sign({ sub: 1, role: 'administrator' }, env.jwt.secret, { expiresIn: '1h' });
  try {
    assert.equal((await fetch(base + '/api/uploads/blob', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 503);
    assert.equal((await fetch(base + '/save', { method: 'POST' })).status, 401);
    for (const audio_url of ['https://attacker.example/sermons/file.mp3', 'file:///etc/passwd', 'https://example.public.blob.vercel-storage.com/announcements/file.pdf']) {
      const result = await fetch(base + '/save', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `token=${token}` }, body: JSON.stringify({ audio_url }) });
      assert.equal(result.status, 400);
    }
    process.env.BLOB_READ_WRITE_TOKEN = 'not-a-real-token';
    const result = await fetch(base + '/api/uploads/blob', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'blob.generate-client-token', payload: { pathname: 'sermons/00000000-0000-0000-0000-000000000000.mp3', callbackUrl: base } }) });
    assert.equal(result.status, 400);
  } finally {
    if (oldToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN; else process.env.BLOB_READ_WRITE_TOKEN = oldToken;
    if (oldBase === undefined) delete process.env.BLOB_PUBLIC_BASE_URL; else process.env.BLOB_PUBLIC_BASE_URL = oldBase;
    await new Promise(resolve => server.close(resolve));
  }
});
