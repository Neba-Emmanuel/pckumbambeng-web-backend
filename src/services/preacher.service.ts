import { pool } from '../config/database';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

export interface Preacher { id: number; name: string; kind: 'pastor' | 'guest'; image_url: string | null }
export const preacherService = {
  // The unique name index makes concurrent first sermons reuse one profile.
  async remember(name: string, image?: string): Promise<Preacher> {
    const normalized = name.trim().replace(/\s+/g, ' ');
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO preachers (name, kind, image_url) VALUES (?, 'guest', ?)
       ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), image_url = COALESCE(VALUES(image_url), image_url)`,
      [normalized, image || null]
    );
    const preacher = await this.get(result.insertId);
    if (!preacher) throw new Error('Unable to save preacher information');
    return preacher;
  },
  async list(): Promise<Preacher[]> {
    const [rows] = await pool.query<RowDataPacket[]>("SELECT id, name, kind, image_url FROM preachers ORDER BY FIELD(kind, 'pastor', 'guest'), name");
    return rows as Preacher[];
  },
  async get(id: number): Promise<Preacher | null> {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT id, name, kind, image_url FROM preachers WHERE id = ?', [id]);
    return (rows[0] as Preacher) || null;
  },
  async create(data: Omit<Preacher, 'id'>): Promise<Preacher> {
    const [result] = await pool.query<ResultSetHeader>('INSERT INTO preachers (name, kind, image_url) VALUES (?, ?, ?)', [data.name, data.kind, data.image_url]);
    return { id: result.insertId, ...data };
  },
  async update(id: number, data: { name: string; kind: Preacher['kind']; image_url?: string | null }): Promise<Preacher | null> {
    if (!await this.get(id)) return null;
    const fields = ['name = ?', 'kind = ?'];
    const values: (string | number | null)[] = [data.name, data.kind];
    if (data.image_url !== undefined) { fields.push('image_url = ?'); values.push(data.image_url); }
    await pool.query(`UPDATE preachers SET ${fields.join(', ')} WHERE id = ?`, [...values, id]);
    return this.get(id);
  },
};
