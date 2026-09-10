import { Router } from 'express';
import * as facebookController from '../controllers/facebook.controller';

const router = Router();

// Public News feed (aggregated from Facebook page sources). No auth required.
// GET /api/facebook/feed - Get aggregated feed grouped by source
router.get('/feed', facebookController.getFeed);

export default router;
