import { pool } from '../config/database';
import { env } from '../config/env';
import { Sermon } from '../models/types';
import { PaginatedResult } from './content.service';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

// Allowed audio MIME types
const ALLOWED_AUDIO_TYPES: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/wave': 'wav',
  'audio/x-wav': 'wav',
};

const MAX_AUDIO_SIZE_BYTES = env.upload.maxAudioSizeMB * 1024 * 1024;

export interface CreateSermonData {
  preacher_id?: number;
  preacher_image?: string | null;
  title: string;
  speaker: string;
  sermon_date: string;
  content_type: 'audio' | 'text';
  text_content?: string | null;
  audio_path?: string | null;
  created_by: number;
}

export interface UpdateSermonData {
  preacher_id?: number;
  preacher_image?: string | null;
  title?: string;
  speaker?: string;
  sermon_date?: string;
  content_type?: 'audio' | 'text';
  text_content?: string | null;
  audio_path?: string | null;
}

/**
 * Validate an audio file's type and size.
 * Returns the audio type label or throws on invalid input.
 */
export function validateAudioFile(mimeType: string, sizeBytes: number): string {
  const typeLabel = ALLOWED_AUDIO_TYPES[mimeType];
  if (!typeLabel) {
    const error = new Error(
      `Invalid audio file type: ${mimeType}. Allowed types: MP3, WAV`
    );
    (error as any).code = 'INVALID_FILE_TYPE';
    (error as any).statusCode = 400;
    throw error;
  }

  if (sizeBytes > MAX_AUDIO_SIZE_BYTES) {
    const error = new Error(
      `Audio file size exceeds maximum allowed size of ${env.upload.maxAudioSizeMB}MB`
    );
    (error as any).code = 'FILE_TOO_LARGE';
    (error as any).statusCode = 400;
    throw error;
  }

  return typeLabel;
}

const sermonSelect = `SELECT s.*, CASE WHEN p.id IS NOT NULL THEN p.name ELSE s.speaker END AS speaker,
  CASE WHEN p.id IS NOT NULL THEN p.image_url ELSE s.preacher_image END AS preacher_image
  FROM sermons s LEFT JOIN preachers p ON p.id = s.preacher_id`;

export class SermonService {
  /**
   * List sermons with pagination, ordered by sermon_date DESC.
   */
  async listSermons(
    page: number,
    pageSize: number = 20
  ): Promise<PaginatedResult<Sermon>> {
    const safePage = Math.max(1, page);
    const safePageSize = Math.max(1, Math.min(100, pageSize));
    const offset = (safePage - 1) * safePageSize;

    // Get total count
    const [countRows] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as total FROM sermons'
    );
    const total = countRows[0].total as number;

    // Get paginated items ordered by sermon_date DESC
    const [rows] = await pool.query<RowDataPacket[]>(
      `${sermonSelect} ORDER BY s.sermon_date DESC, s.id DESC LIMIT ? OFFSET ?`,
      [safePageSize, offset]
    );

    return {
      items: rows as Sermon[],
      total,
      page: safePage,
      pageSize: safePageSize,
    };
  }

  /**
   * Get a single sermon by ID.
   * If memberId is provided, checks access for paid sermons.
   * Returns the sermon with a hasAccess flag.
   */
  async getSermonById(id: number): Promise<Sermon | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `${sermonSelect} WHERE s.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return null;
    }

    return rows[0] as Sermon;
  }

  /**
   * Create a new sermon.
   * Returns the created sermon.
   */
  async createSermon(data: CreateSermonData): Promise<Sermon> {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO sermons (title, speaker, sermon_date, content_type, text_content, audio_path, preacher_image, preacher_id, created_by, published_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        data.title,
        data.speaker,
        data.sermon_date,
        data.content_type,
        data.text_content || null,
        data.audio_path || null,
        data.preacher_image || null,
        data.preacher_id ?? null,
        data.created_by,
      ]
    );

    const [rows] = await pool.query<RowDataPacket[]>(
      `${sermonSelect} WHERE s.id = ?`,
      [result.insertId]
    );

    if (rows.length === 0) {
      throw new Error('Failed to retrieve created sermon');
    }

    return rows[0] as Sermon;
  }

  /**
   * Update an existing sermon.
   * Only updates fields that are provided. Preserves published_at.
   * Returns the updated sermon or null if not found.
   */
  async updateSermon(id: number, data: UpdateSermonData): Promise<Sermon | null> {
    // Check if sermon exists
    const [existingRows] = await pool.query<RowDataPacket[]>(
      `${sermonSelect} WHERE s.id = ?`,
      [id]
    );

    if (existingRows.length === 0) {
      return null;
    }

    // Build dynamic UPDATE query with only provided fields
    const fields: string[] = [];
    const values: any[] = [];

    if (data.preacher_id !== undefined) { fields.push('preacher_id = ?'); values.push(data.preacher_id); }
    if (data.preacher_image !== undefined) { fields.push('preacher_image = ?'); values.push(data.preacher_image); }

    if (data.title !== undefined) {
      fields.push('title = ?');
      values.push(data.title);
    }

    if (data.speaker !== undefined) {
      fields.push('speaker = ?');
      values.push(data.speaker);
    }

    if (data.sermon_date !== undefined) {
      fields.push('sermon_date = ?');
      values.push(data.sermon_date);
    }

    if (data.content_type !== undefined) {
      fields.push('content_type = ?');
      values.push(data.content_type);
    }

    if (data.text_content !== undefined) {
      fields.push('text_content = ?');
      values.push(data.text_content);
    }

    if (data.audio_path !== undefined) {
      fields.push('audio_path = ?');
      values.push(data.audio_path);
    }

    if (fields.length === 0) {
      return existingRows[0] as Sermon;
    }

    // Always update updated_at, never change published_at
    fields.push('updated_at = NOW()');
    values.push(id);

    await pool.query<ResultSetHeader>(
      `UPDATE sermons SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    const [rows] = await pool.query<RowDataPacket[]>(
      `${sermonSelect} WHERE s.id = ?`,
      [id]
    );

    return rows[0] as Sermon;
  }

  /**
   * Delete a sermon by ID.
   * Returns true if deleted, false if not found.
   */
  async deleteSermon(id: number): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>(
      'DELETE FROM sermons WHERE id = ?',
      [id]
    );

    return result.affectedRows > 0;
  }

}

export const sermonService = new SermonService();
