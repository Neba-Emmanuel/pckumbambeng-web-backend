import { Router } from 'express';
import * as notificationController from '../controllers/notification.controller';

const router = Router();

// Anonymous push subscription management (public — no account required).

// POST /api/notifications/subscribe - Register a browser push subscription
router.post('/subscribe', notificationController.subscribe);

// DELETE /api/notifications/subscribe - Unregister a browser push subscription
router.delete('/subscribe', notificationController.unsubscribe);

export default router;
