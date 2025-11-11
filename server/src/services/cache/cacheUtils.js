import crypto from 'crypto';
import { db } from './database.js';
import { CACHE_TTL } from './memoryCache.js';

// Helper to hash data
export function hashData(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// Helper to log statistics
export function logStat(cacheType, operation) {
  try {
    db.prepare(`
      INSERT INTO cache_stats (cache_type, operation, timestamp)
      VALUES (?, ?, ?)
    `).run(cacheType, operation, Date.now());
  } catch (error) {
    console.error(`Failed to log cache stat: ${error.message}`);
  }
}

// Helper to check if entry is stale
export function isStale(timestamp) {
  return Date.now() - timestamp > CACHE_TTL;
}

