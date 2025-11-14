import crypto from 'crypto';

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const tokenStore = new Map(); // requestId -> { token, expiresAt }

export const generateRequestToken = (requestId) => {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  
  tokenStore.set(requestId, { token, expiresAt });
  
  return token;
};

export const validateToken = (requestId, providedToken) => {
  const stored = tokenStore.get(requestId);
  
  if (!stored) {
    return { valid: false, reason: 'Request not found' };
  }
  
  if (Date.now() > stored.expiresAt) {
    tokenStore.delete(requestId);
    return { valid: false, reason: 'Token expired' };
  }
  
  if (stored.token !== providedToken) {
    return { valid: false, reason: 'Invalid token' };
  }
  
  return { valid: true };
};

export const cleanupExpiredTokens = () => {
  const now = Date.now();
  for (const [requestId, { expiresAt }] of tokenStore.entries()) {
    if (now > expiresAt) {
      tokenStore.delete(requestId);
    }
  }
};

// Run cleanup every 5 minutes
setInterval(cleanupExpiredTokens, 5 * 60 * 1000);

