import { createEventSchema } from '../models/schemas';
import { pool } from '../config/database';
import { Event } from '../models/types';
import { PaginatedResult } from './content.service';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

export interface CreateEventData {
  detail_page_status?: Event['detail_page_status'];
  detail_page_path?: string | null;
  title: string;
  event_date: Date | string;
  location: string;
  description: string;
  created_by: number;
}

export interface UpdateEventData {
  detail_page_status?: Event['detail_page_status'];
  detail_page_path?: string | null;
  title?: string;
  event_date?: Date | string;
  location?: string;
  description?: string;
}

export class EventService {
  /**
   * List events for a specific calendar month, ordered by event_date ASC.
   */
  async listEvents(year: number, month: number): Promise<Event[]> {
    // Build start/end dates for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM events
       WHERE event_date >= ? AND event_date < ?
       ORDER BY event_date ASC`,
      [startDate, endDate]
    );

    return rows as Event[];
  }

  /**
   * List past events (event_date < NOW), ordered by event_date DESC with pagination.
   */
  async listPastEvents(
    page: number,
    pageSize: number = 20
  ): Promise<PaginatedResult<Event>> {
    const safePage = Math.max(1, page);
    const safePageSize = Math.max(1, Math.min(100, pageSize));
    const offset = (safePage - 1) * safePageSize;

    // Get total count of past events
    const [countRows] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as total FROM events WHERE event_date < NOW()'
    );
    const total = countRows[0].total as number;

    // Get paginated past events
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM events
       WHERE event_date < NOW()
       ORDER BY event_date DESC
       LIMIT ? OFFSET ?`,
      [safePageSize, offset]
    );

    return {
      items: rows as Event[],
      total,
      page: safePage,
      pageSize: safePageSize,
    };
  }

  /**
   * Get a single event by ID.
   * Returns the event or null if not found.
   */
  async getEventById(id: number): Promise<Event | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM events WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      return null;
    }

    return rows[0] as Event;
  }

  /**
   * Create a new event.
   * Returns the created event.
   */
  async createEvent(data: CreateEventData): Promise<Event> {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO events (title, event_date, location, description, created_by, detail_page_status, detail_page_path)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [data.title, data.event_date, data.location, data.description, data.created_by, data.detail_page_status ?? 'off', data.detail_page_path ?? null]
    );

    const created = await this.getEventById(result.insertId);
    if (!created) {
      throw new Error('Failed to retrieve created event');
    }

    return created;
  }

  /**
   * Update an existing event.
   * Only updates fields that are provided.
   * Returns the updated event or null if not found.
   */
  async updateEvent(id: number, data: UpdateEventData): Promise<Event | null> {
    const existing = await this.getEventById(id);
    if (!existing) {
      return null;
    }

    createEventSchema.parse({ ...existing, ...data, event_date: new Date(data.event_date ?? existing.event_date).toISOString() });
    const fields: string[] = [];
    const values: any[] = [];

    if (data.detail_page_status !== undefined) {
      fields.push('detail_page_status = ?');
      values.push(data.detail_page_status);
    }
    if (data.detail_page_path !== undefined) {
      fields.push('detail_page_path = ?');
      values.push(data.detail_page_path);
    }
    if (data.title !== undefined) {
      fields.push('title = ?');
      values.push(data.title);
    }

    if (data.event_date !== undefined) {
      fields.push('event_date = ?');
      values.push(data.event_date);
    }

    if (data.location !== undefined) {
      fields.push('location = ?');
      values.push(data.location);
    }

    if (data.description !== undefined) {
      fields.push('description = ?');
      values.push(data.description);
    }

    if (fields.length === 0) {
      return existing;
    }

    fields.push('updated_at = NOW()');
    values.push(id);

    await pool.query<ResultSetHeader>(
      `UPDATE events SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    return this.getEventById(id);
  }

  /**
   * Delete an event by ID.
   * Returns true if deleted, false if not found.
   */
  async deleteEvent(id: number): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>(
      'DELETE FROM events WHERE id = ?',
      [id]
    );

    return result.affectedRows > 0;
  }
}

export const eventService = new EventService();
