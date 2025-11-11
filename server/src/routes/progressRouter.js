import { Router } from 'express';

import { getProgressUpdate } from '../controllers/progressController.js';

const router = Router();

router.get('/:requestId', getProgressUpdate);

export default router;

