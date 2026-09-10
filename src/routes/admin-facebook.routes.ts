import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { adminMiddleware } from '../middleware/admin.middleware';
import * as adminFacebookController from '../controllers/admin-facebook.controller';

const router = Router();

// Apply authMiddleware and adminMiddleware to all routes
router.use(authMiddleware);
router.use(adminMiddleware);

// GET / — list configured Facebook sources
router.get('/', adminFacebookController.listSources);

// POST / — add a new Facebook source
router.post('/', adminFacebookController.addSource);

// DELETE /:id — deactivate a Facebook source
router.delete('/:id', adminFacebookController.deactivateSource);

export default router;
