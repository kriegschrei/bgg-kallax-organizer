import { Router } from 'express';

import {
  clearCacheHandler,
  cleanupCacheHandler,
  getCacheStatsHandler,
} from '../controllers/adminController.js';
import { checkAdminAuth } from '../middleware/checkAdminAuth.js';

const router = Router();

router.use(checkAdminAuth);

router.get('/cache/stats', getCacheStatsHandler);
router.post('/cache/clear', clearCacheHandler);
router.post('/cache/cleanup', cleanupCacheHandler);

export default router;

