import { Request, Response } from 'express';
import { pool } from '../config/database';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { ApiErrorResponse, ApiSuccessResponse } from '../models/responses';

/**
 * POST /api/notifications/subscribe
 * Register an anonymous browser push subscription (no account required).
 */
export async function subscribe(req: Request, res: Response): Promise<void> {
  try {
    const { endpoint, p256dh_key, auth_key } = req.body;

    if (!endpoint || !p256dh_key || !auth_key) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields: endpoint, p256dh_key, auth_key',
        },
      } as ApiErrorResponse);
      return;
    }

    // Upsert by endpoint (endpoint uniquely identifies a browser subscription).
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM push_subscriptions WHERE endpoint = ?',
      [endpoint]
    );

    if (existing.length > 0) {
      await pool.query<ResultSetHeader>(
        'UPDATE push_subscriptions SET p256dh_key = ?, auth_key = ? WHERE endpoint = ?',
        [p256dh_key, auth_key, endpoint]
      );
    } else {
      await pool.query<ResultSetHeader>(
        'INSERT INTO push_subscriptions (endpoint, p256dh_key, auth_key) VALUES (?, ?, ?)',
        [endpoint, p256dh_key, auth_key]
      );
    }

    res.status(201).json({
      success: true,
      data: { message: 'Push subscription registered' },
    } as ApiSuccessResponse<{ message: string }>);
  } catch (error) {
    console.error('[NotificationController] subscribe error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    } as ApiErrorResponse);
  }
}

/**
 * DELETE /api/notifications/subscribe
 * Unregister an anonymous browser push subscription by endpoint.
 */
export async function unsubscribe(req: Request, res: Response): Promise<void> {
  try {
    const { endpoint } = req.body;

    if (!endpoint) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Missing required field: endpoint' },
      } as ApiErrorResponse);
      return;
    }

    await pool.query<ResultSetHeader>(
      'DELETE FROM push_subscriptions WHERE endpoint = ?',
      [endpoint]
    );

    res.status(200).json({
      success: true,
      data: { message: 'Push subscription removed' },
    } as ApiSuccessResponse<{ message: string }>);
  } catch (error) {
    console.error('[NotificationController] unsubscribe error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    } as ApiErrorResponse);
  }
}
