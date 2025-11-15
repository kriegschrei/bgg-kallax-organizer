import { CACHE_ADMIN_PASSWORD } from '../services/configService.js';

export const checkAdminAuth = (req, res, next) => {
  const providedPassword = req.headers['x-admin-password'] || req.body?.password;

  if (!CACHE_ADMIN_PASSWORD) {
    return res.status(500).json({ error: 'Admin password not configured' });
  }

  if (providedPassword !== CACHE_ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  return next();
};

