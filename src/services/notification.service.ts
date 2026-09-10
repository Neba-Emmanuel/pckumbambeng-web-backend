import webpush from 'web-push';
import { pool } from '../config/database';
import { env } from '../config/env';
import { RowDataPacket } from 'mysql2';

// Configure VAPID keys for web-push
if (env.vapid.publicKey && env.vapid.privateKey) {
  webpush.setVapidDetails(
    env.vapid.subject,
    env.vapid.publicKey,
    env.vapid.privateKey
  );
}

export type NotificationType = 'announcement' | 'event' | 'sermon';

export class NotificationService {
  /**
   * Announce new content by sending an anonymous browser push notification
   * to every stored push subscription. No per-user records are kept.
   */
  async createNotification(
    type: NotificationType,
    referenceId: number,
    title: string,
    message: string
  ): Promise<void> {
    // Fire-and-forget push to all anonymous subscriptions.
    this.sendPush(title, message, `/${type}s/${referenceId}`).catch(() => {
      // Silently ignore push errors — notifications are non-critical.
    });
  }

  /**
   * Send a push notification to all stored (anonymous) subscriptions.
   * If a subscription returns 410 Gone, delete it from the database.
   * Fire-and-forget: does not throw if individual pushes fail.
   */
  async sendPush(title: string, body: string, url: string): Promise<void> {
    if (!env.vapid.publicKey || !env.vapid.privateKey) {
      return;
    }

    const [subscriptions] = await pool.query<RowDataPacket[]>(
      'SELECT id, endpoint, p256dh_key, auth_key FROM push_subscriptions'
    );

    const payload = JSON.stringify({ title, body, url });

    const pushPromises = subscriptions.map(async (sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh_key,
          auth: sub.auth_key,
        },
      };

      try {
        await webpush.sendNotification(pushSubscription, payload);
      } catch (error: any) {
        if (error.statusCode === 410) {
          await pool.query('DELETE FROM push_subscriptions WHERE id = ?', [sub.id]);
        }
        // Silently ignore other push errors.
      }
    });

    await Promise.allSettled(pushPromises);
  }
}

export const notificationService = new NotificationService();
