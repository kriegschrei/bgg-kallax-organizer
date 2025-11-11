import { Router } from 'express';

import { handleGamesRequest } from '../controllers/gamesController.js';

const router = Router();

router.post('/', handleGamesRequest);

export default router;

