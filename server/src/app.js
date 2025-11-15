import express from 'express';
import cors from 'cors';
import compression from 'compression';

import { compressionFilter } from './middleware/compressionFilter.js';
import { registerRoutes } from './routes/index.js';

const REQUEST_TIMEOUT_MS = 120000;

export const createApp = () => {
  const app = express();

  app.use(cors());
  app.use(
    compression({
      filter: compressionFilter,
    }),
  );
  app.use(
    express.json({
      limit: '2mb',
      inflate: true,
    }),
  );

  app.timeout = REQUEST_TIMEOUT_MS;

  app.use((req, res, next) => {
    req.setTimeout(REQUEST_TIMEOUT_MS);
    res.setTimeout(REQUEST_TIMEOUT_MS);
    next();
  });

  registerRoutes(app);

  return app;
};

