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

export default router;
