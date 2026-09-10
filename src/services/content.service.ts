import { pool } from '../config/database';
import { env } from '../config/env';
import { Announcement } from '../models/types';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

// Allowed attachment MIME types and their labels
const ALLOWED_ATTACHMENT_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
};

const MAX_ATTACHMENT_SIZE_BYTES = env.upload.maxAttachmentSizeMB * 1024 * 1024;

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateAnnouncementData {
  title: string;
  body: string;
  attachment_path?: string | null;
  attachment_type?: string | null;
  created_by: number;
}

export interface UpdateAnnouncementData {
  title?: string;
  body?: string;
  attachment_path?: string | null;
  attachment_type?: string | null;
}

/**
 * Validate an attachment file's type and size.
 * Returns the attachment_type label or throws on invalid input.
 */
export function validateAttachment(mimeType: string, sizeBytes: number): string {
  const typeLabel = ALLOWED_ATTACHMENT_TYPES[mimeType];
  if (!typeLabel) {
    const error = new Error(
      `Invalid file type: ${mimeType}. Allowed types: PDF, PNG, JPG`
    );
    (error as any).code = 'INVALID_FILE_TYPE';
    (error as any).statusCode = 400;
    throw error;
  }

  if (sizeBytes > MAX_ATTACHMENT_SIZE_BYTES) {
    const error = new Error(
      `File size exceeds maximum allowed size of ${env.upload.maxAttachmentSizeMB}MB`
    );
    (error as any).code = 'FILE_TOO_LARGE';
    (error as any).statusCode = 400;
    throw error;
  }

  return typeLabel;
}

export class ContentService {
  /**
   * List announcements with pagination, ordered by published_at DESC.
   */
  async listAnnouncements(
    page: number,
    pageSize: number = 20
  ): Promise<PaginatedResult<Announcement>> {
    // Ensure page and pageSize are valid
    const safePage = Math.max(1, page);
    const safePageSize = Math.max(1, Math.min(100, pageSize));
    const offset = (safePage - 1) * safePageSize;

    // Get total count
    const [countRows] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as total FROM announcements'
    );
    const total = countRows[0].total as number;

    // Get paginated items
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM announcements ORDER BY published_at DESC LIMIT ? OFFSET ?',
      [safePageSize, offset]
    );

    return {
      items: rows as Announcement[],
      total,
      page: safePage,
      pageSize: safePageSize,
    };
  }

  /**
   * Get a single announcement by ID.
   * Returns the announcement or null if not found.
   */
  async getAnnouncementById(id: number): Promise<Announcement | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM announcements WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      return null;
    }

    return rows[0] as Announcement;
  }

  /**
   * Create a new announcement.
   * Returns the created announcement.
   */
  async createAnnouncement(data: CreateAnnouncementData): Promise<Announcement> {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO announcements (title, body, attachment_path, attachment_type, published_at, created_by, updated_at)
       VALUES (?, ?, ?, ?, NOW(), ?, NOW())`,
      [
        data.title,
        data.body,
        data.attachment_path || null,
        data.attachment_type || null,
        data.created_by,
      ]
    );

    const created = await this.getAnnouncementById(result.insertId);
    if (!created) {
      throw new Error('Failed to retrieve created announcement');
    }

    return created;
  }

  /**
   * Update an existing announcement.
   * Only updates fields that are provided. Preserves original published_at.
   * Returns the updated announcement or null if not found.
   */
  async updateAnnouncement(
    id: number,
    data: UpdateAnnouncementData
  ): Promise<Announcement | null> {
    // Check if announcement exists
    const existing = await this.getAnnouncementById(id);
    if (!existing) {
      return null;
    }

    // Build dynamic UPDATE query with only provided fields
    const fields: string[] = [];
    const values: any[] = [];

    if (data.title !== undefined) {
      fields.push('title = ?');
      values.push(data.title);
    }

    if (data.body !== undefined) {
      fields.push('body = ?');
      values.push(data.body);
    }

    if (data.attachment_path !== undefined) {
      fields.push('attachment_path = ?');
      values.push(data.attachment_path);
    }

    if (data.attachment_type !== undefined) {
      fields.push('attachment_type = ?');
      values.push(data.attachment_type);
    }

    if (fields.length === 0) {
      return existing;
    }

    // Always update updated_at, never change published_at
    fields.push('updated_at = NOW()');
    values.push(id);

    await pool.query<ResultSetHeader>(
      `UPDATE announcements SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    return this.getAnnouncementById(id);
  }

  /**
   * Delete an announcement by ID.
   * Returns true if deleted, false if not found.
   */
  async deleteAnnouncement(id: number): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>(
      'DELETE FROM announcements WHERE id = ?',
      [id]
    );

    return result.affectedRows > 0;
  }
}

export const contentService = new ContentService();
