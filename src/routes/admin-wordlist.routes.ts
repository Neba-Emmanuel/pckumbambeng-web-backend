import { Router } from 'express';
import * as controller from '../controllers/admin-wordlist.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { adminMiddleware } from '../middleware/admin.middleware';

const router = Router();

// Require authenticated administrator for all word-list management routes
router.use(authMiddleware);
router.use(adminMiddleware);

// GET /api/admin/word-list - List custom words
router.get('/', controller.listWords);

// POST /api/admin/word-list - Add a Bible-themed word
router.post('/', controller.addWord);

// DELETE /api/admin/word-list/:id - Remove a custom word
router.delete('/:id', controller.removeWord);

export default router;
