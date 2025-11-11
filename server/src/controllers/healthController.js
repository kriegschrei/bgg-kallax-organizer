import { BGG_API_TOKEN } from '../services/configService.js';

export const getHealthStatus = (req, res) => {
  const tokenConfigured = Boolean(BGG_API_TOKEN);

  return res.json({
    status: 'ok',
    tokenConfigured,
    message: tokenConfigured
      ? 'BGG token is configured'
      : 'BGG token is not configured. Please set BGG_API_TOKEN in .env file',
  });
};

