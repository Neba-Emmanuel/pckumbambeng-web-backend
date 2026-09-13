import { pool } from '../config/database';
import { RowDataPacket } from 'mysql2';
import { Router } from 'express';
import * as contentController from '../controllers/content.controller';

const router = Router();

// All content GET routes are public (no authentication required).

// Announcements
router.get('/announcements', contentController.listAnnouncements);
router.get('/announcements/:id', contentController.getAnnouncement);

// Sermons (free, public)
router.get('/sermons', contentController.listSermons);
router.get('/sermons/:id', contentController.getSermon);
router.get('/sermons/:id/stream', contentController.streamSermon);

// Events
router.get('/events', contentController.listEvents);
router.get('/events/archive', contentController.listPastEvents);

// Custom event pages use their path to keep their details linked to admin edits.
router.get('/events/page/:slug', async (req, res) => {
  const slug = String(req.params.slug);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid event page' } });
    return;
  }
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, title, event_date, location, description FROM events WHERE detail_page_path = ? AND detail_page_status <> ? ORDER BY id DESC LIMIT 1',
      [`/events/${slug}`, 'off'],
    );
    if (!rows.length) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Event details are not available yet' } }); return; }
    res.json({ success: true, data: rows[0] });
  } catch {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Event details could not be loaded' } });
  }
});

export default router;
