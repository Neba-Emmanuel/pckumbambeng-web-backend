import { Router } from 'express';
import { z } from 'zod';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../config/database';
import { authMiddleware } from '../middleware/auth.middleware';
import { adminMiddleware } from '../middleware/admin.middleware';
import { createRateLimiter } from '../middleware/rate-limit.middleware';

export const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(40).optional(),
  subject: z.string().trim().min(2).max(160),
  message: z.string().trim().min(10).max(5000),
});

const router = Router();
router.post('/contact', createRateLimiter(5, 15 * 60 * 1000), async (req, res) => {
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: {
      code: 'VALIDATION_ERROR', message: 'Please check your contact details and message.',
      details: Object.fromEntries(parsed.error.issues.map(issue => [issue.path.join('.'), issue.message])),
    } });
    return;
  }
  try {
    const { name, email, phone, subject, message } = parsed.data;
    const [result] = await pool.execute<ResultSetHeader>(
      'INSERT INTO contact_messages (name, email, phone, subject, message) VALUES (?, ?, ?, ?, ?)',
      [name, email, phone || null, subject, message],
    );
    res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Your message could not be saved. Please try again later.' } });
  }
});

router.get('/admin/contact-messages', authMiddleware, adminMiddleware, async (req, res) => {
  const parsed = z.coerce.number().int().min(1).max(1000000).safeParse(req.query.page ?? 1);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid page number.' } });
    return;
  }
  try {
    const page = parsed.data;
    const pageSize = 20;
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, name, email, phone, subject, message, created_at FROM contact_messages ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?',
      [pageSize, (page - 1) * pageSize],
    );
    const [count] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS total FROM contact_messages');
    res.json({ success: true, data: rows, meta: { page, pageSize, total: Number(count[0].total) } });
  } catch {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Contact messages could not be loaded.' } });
  }
});
export default router;
