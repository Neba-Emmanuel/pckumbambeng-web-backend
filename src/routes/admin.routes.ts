import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { randomUUID } from 'crypto';
import { authMiddleware } from '../middleware/auth.middleware';
import { adminMiddleware } from '../middleware/admin.middleware';
import { env } from '../config/env';
import * as adminController from '../controllers/admin.controller';

const router = Router();

// Apply auth and admin middleware to all routes
router.use(authMiddleware);
router.use(adminMiddleware);

// ─── Multer Configuration ────────────────────────────────────────────────────

// Disk storage for uploads — files are stored in env.upload.dir
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
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

// POST /api/admin/announcements — create announcement with optional attachment
router.post(
  '/announcements',
  announcementUpload.single('attachment'),
  adminController.createAnnouncement
);

// PUT /api/admin/announcements/:id — update announcement
router.put(
  '/announcements/:id',
  announcementUpload.single('attachment'),
  adminController.updateAnnouncement
);

// DELETE /api/admin/announcements/:id — delete announcement
router.delete('/announcements/:id', adminController.deleteAnnouncement);

// ─── Sermon Routes ───────────────────────────────────────────────────────────

// POST /api/admin/sermons — create sermon with optional audio upload
router.post(
  '/sermons',
  sermonUpload.single('audio'),
  adminController.createSermon
);

// PUT /api/admin/sermons/:id — update sermon
router.put(
  '/sermons/:id',
  sermonUpload.single('audio'),
  adminController.updateSermon
);

// DELETE /api/admin/sermons/:id — delete sermon (retains purchase records)
router.delete('/sermons/:id', adminController.deleteSermon);

// ─── Event Routes ────────────────────────────────────────────────────────────

// POST /api/admin/events — create event
router.post('/events', adminController.createEvent);

// PUT /api/admin/events/:id — update event
router.put('/events/:id', adminController.updateEvent);

// DELETE /api/admin/events/:id — delete event
router.delete('/events/:id', adminController.deleteEvent);

export default router;
