import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { authRateLimit } from '../middleware/rate-limit.middleware';

const router = Router();

// POST /api/auth/login - Authenticate administrator (rate limited)
router.post('/login', authRateLimit, authController.login);

// POST /api/auth/logout - Clear session cookie
router.post('/logout', authController.logout);

// GET /api/auth/me - Get current authenticated administrator (requires auth)
router.get('/me', authMiddleware, authController.me);

export default router;
