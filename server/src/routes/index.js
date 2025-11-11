import gamesRouter from './gamesRouter.js';
import progressRouter from './progressRouter.js';
import healthRouter from './healthRouter.js';
import proxyRouter from './proxyRouter.js';
import adminRouter from './adminRouter.js';

export const registerRoutes = (app) => {
  app.use('/api/games', gamesRouter);
  app.use('/api/progress', progressRouter);
  app.use('/api/health', healthRouter);
  app.use('/api', proxyRouter);
  app.use('/api/admin', adminRouter);
};

