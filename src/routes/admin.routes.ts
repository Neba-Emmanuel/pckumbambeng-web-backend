import { resolveBlobUpload } from './uploads.routes';
import fs from 'fs';
import { eventService } from '../services/event.service';
import { pool } from '../config/database';
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { randomUUID } from 'crypto';
import { authMiddleware } from '../middleware/auth.middleware';
import { adminMiddleware } from '../middleware/admin.middleware';
import { env } from '../config/env';
import * as adminController from '../controllers/admin.controller';
import { listAnnouncements, getAnnouncement } from '../controllers/content.controller';

const router = Router();

// Apply auth and admin middleware to all routes
router.use(authMiddleware);
router.use(adminMiddleware);

// ─── Multer Configuration ────────────────────────────────────────────────────

// Disk storage for uploads — files are stored in env.upload.dir
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (process.env.VERCEL) { cb(new Error('Use direct Blob uploads on Vercel'), ''); return; }
    fs.mkdirSync(path.resolve(env.upload.dir), { recursive: true });
    cb(null, path.resolve(env.upload.dir));
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${randomUUID()}${ext}`;
    cb(null, uniqueName);
  },
});

// Multer instance for announcement attachments (PDF/PNG/JPG ≤10MB)
const announcementUpload = multer({
  storage,
  limits: {
    fileSize: env.upload.maxAttachmentSizeMB * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ['application/pdf', 'image/png', 'image/jpeg'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: PDF, PNG, JPG'));
    }
  },
});

// Multer instance for sermon audio uploads (MP3/WAV ≤100MB)
const sermonUpload = multer({
  storage,
  limits: {
    fileSize: env.upload.maxAudioSizeMB * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ['audio/mpeg', 'audio/wav', 'audio/wave', 'audio/x-wav'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid audio file type. Allowed: MP3, WAV'));
    }
  },
});

// ─── Announcement Routes ─────────────────────────────────────────────────────

// Authenticated administrators can still read and edit expired announcements.
router.get('/announcements', (_req, res, next) => { res.locals.includeExpired = true; next(); }, listAnnouncements);
router.get('/announcements/:id', (_req, res, next) => { res.locals.includeExpired = true; next(); }, getAnnouncement);

// POST /api/admin/announcements — create announcement with optional attachment
router.post(
  '/announcements',
  announcementUpload.single('attachment'),
  resolveBlobUpload('attachment'),
  adminController.createAnnouncement
);

// PUT /api/admin/announcements/:id — update announcement
router.put(
  '/announcements/:id',
  announcementUpload.single('attachment'),
  resolveBlobUpload('attachment'),
  adminController.updateAnnouncement
);

// DELETE /api/admin/announcements/:id — delete announcement
router.delete('/announcements/:id', adminController.deleteAnnouncement);

// ─── Sermon Routes ───────────────────────────────────────────────────────────

// POST /api/admin/sermons — create sermon with optional audio upload
router.post(
  '/sermons',
  sermonUpload.single('audio'),
  resolveBlobUpload('audio'),
  adminController.createSermon
);

// PUT /api/admin/sermons/:id — update sermon
router.put(
  '/sermons/:id',
  sermonUpload.single('audio'),
  resolveBlobUpload('audio'),
  adminController.updateSermon
);

// DELETE /api/admin/sermons/:id — delete sermon (retains purchase records)
router.delete('/sermons/:id', adminController.deleteSermon);

// ─── Event Routes ────────────────────────────────────────────────────────────

// POST /api/admin/events — create event
router.get('/events', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM events ORDER BY event_date DESC');
    res.json({ success: true, data: rows });
  } catch {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Unable to load events' } });
  }
});
router.get('/events/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) { res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid event ID' } }); return; }
  try {
    const event = await eventService.getEventById(id);
    if (!event) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Event not found' } }); return; }
    res.json({ success: true, data: event });
  } catch {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Unable to load event' } });
  }
});
router.post('/events', adminController.createEvent);

// PUT /api/admin/events/:id — update event
router.put('/events/:id', adminController.updateEvent);

// DELETE /api/admin/events/:id — delete event
router.delete('/events/:id', adminController.deleteEvent);

export default router;
