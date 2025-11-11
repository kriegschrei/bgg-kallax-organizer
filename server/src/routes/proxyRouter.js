import { Router } from 'express';

import {
  getCollectionProxy,
  getThingProxy,
} from '../controllers/proxyController.js';

const router = Router();

router.get('/collection/:username', getCollectionProxy);
router.get('/thing', getThingProxy);

export default router;

