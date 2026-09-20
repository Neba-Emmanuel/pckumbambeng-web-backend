import '../config/env';
import { readFile } from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import { list, put, head } from '@vercel/blob';
import { pool } from '../config/database';
import { RowDataPacket } from 'mysql2';

// Run after migration 013. Existing Blob portraits are preserved.
async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN || !process.env.BLOB_PUBLIC_BASE_URL) {
    throw new Error('Configure BLOB_READ_WRITE_TOKEN and BLOB_PUBLIC_BASE_URL in backend/.env before importing pastor photos.');
  }
  const origin = new URL(process.env.BLOB_PUBLIC_BASE_URL).origin;
  const pastors = [
    { name: 'Rev. Dr. Mokoko Mbue Thomas', file: 'mokoko-thomas.jpg', slug: 'parish-pastor', type: 'image/jpeg' },
    { name: 'Rev. Saihnom Read Fomufod', file: 'saihnom-read.png', slug: 'associate-pastor', type: 'image/png' },
  ];
  for (const pastor of pastors) {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT id, image_url FROM preachers WHERE name = ? AND kind = ?', [pastor.name, 'pastor']);
    if (rows.length !== 1) throw new Error(`Run migration 013 first: missing profile for ${pastor.name}.`);
    const current = rows[0].image_url as string | null;
    if (current?.startsWith(`${origin}/preachers/`)) {
      await head(current);
      console.log(`Already uploaded: ${pastor.name}`);
      continue;
    }
    const bytes = await readFile(path.resolve(__dirname, '../../../frontend/public', pastor.file));
    const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 20);
    const pathname = `preachers/${pastor.slug}-${hash}${path.extname(pastor.file)}`;
    const existing = await list({ prefix: pathname, limit: 10 });
    const blob = existing.blobs.find(item => item.pathname === pathname) || await put(pathname, bytes, { access: 'public', addRandomSuffix: false, contentType: pastor.type });
    if (new URL(blob.url).origin !== origin) throw new Error('The Blob store does not match BLOB_PUBLIC_BASE_URL. No profile URL was changed.');
    await head(blob.url);
    await pool.query('UPDATE preachers SET image_url = ? WHERE id = ? AND image_url <=> ?', [blob.url, rows[0].id, current]);
    console.log(`Photo uploaded and linked: ${pastor.name}`);
  }
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Photo import failed.'); process.exitCode = 1; }).finally(() => pool.end());
