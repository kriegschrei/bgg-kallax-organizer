import { db } from './database.js';
import { memoryCaches } from './memoryCache.js';
import { logStat, isStale } from './cacheUtils.js';
import { parseInteger } from '../../utils/numberUtils.js';

// Extract gameId and versionId from versionKey (format: "gameId-versionId" or "gameId-default")
const extractIdsFromVersionKey = (versionKey) => {
  const parts = versionKey.split('-');
  if (parts.length < 2) {
    return { gameId: -1, versionId: -1 };
  }
  const gameId = parseInteger(parts[0], -1);
  const versionIdPart = parts.slice(1).join('-'); // Handle cases where versionId might contain hyphens
  const versionId = versionIdPart === 'default' ? -1 : parseInteger(versionIdPart, -1);
  return { gameId, versionId };
};

// Get version from cache
export function getVersion(versionKey) {
  try {
    // Try memory cache first
    const memCached = memoryCaches.versions.get(versionKey);
    if (memCached && !isStale(memCached.timestamp)) {
      logStat('version', 'hit_memory');
      return memCached.data;
    }

    // Try database
    const stmt = db.prepare('SELECT data, timestamp FROM versions WHERE key = ?');
    const row = stmt.get(versionKey);
    
    if (row && !isStale(row.timestamp)) {
      const data = JSON.parse(row.data);
      // Update memory cache
      memoryCaches.versions.set(versionKey, { data, timestamp: row.timestamp });
      // Update last accessed
      db.prepare('UPDATE versions SET last_accessed = ? WHERE key = ?').run(Date.now(), versionKey);
      logStat('version', 'hit_db');
      return data;
    }

    logStat('version', 'miss');
    return null;
  } catch (error) {
    console.error(`Cache error (getVersion): ${error.message}`);
    logStat('version', 'error');
    return null; // Fall back to API
  }
}

// Set version in cache
export function setVersion(versionKey, data) {
  try {
    // Validate versionKey before caching
    if (!versionKey || 
        typeof versionKey !== 'string' || 
        versionKey === 'undefined' || 
        versionKey.trim() === '') {
      console.warn(`⚠️  Skipping cache for version with invalid key: ${versionKey}`);
      logStat('version', 'skipped_invalid_key');
      return;
    }

    const { gameId, versionId } = extractIdsFromVersionKey(versionKey);
    
    // Validate extracted IDs - reject invalid gameId or versionId === -1 (no version selected)
    if (gameId === -1 || versionId === -1) {
      console.warn(`⚠️  Skipping cache for version with invalid IDs (key: ${versionKey}, gameId: ${gameId}, versionId: ${versionId})`);
      logStat('version', 'skipped_invalid_ids');
      return;
    }

    const dataJson = JSON.stringify(data);
    const now = Date.now();

    // Check if entry already exists
    const existing = db.prepare('SELECT key FROM versions WHERE key = ?').get(versionKey);
    const isUpdate = existing !== undefined;

    // Store in memory
    memoryCaches.versions.set(versionKey, { data, timestamp: now });

    // Store in database (normalize IDs to strings for consistency with TEXT columns)
    db.prepare(`
      INSERT OR REPLACE INTO versions (key, game_id, version_id, data, timestamp, last_accessed)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(versionKey, String(gameId), String(versionId), dataJson, now, now);

    // Log for debugging
    if (process.env.DEBUG_CACHE === 'true') {
      console.debug(`💾 Cache ${isUpdate ? 'UPDATE' : 'INSERT'} version: ${versionKey} (gameId: ${gameId}, versionId: ${versionId})`);
    }

    logStat('version', isUpdate ? 'update' : 'set');
  } catch (error) {
    console.error(`Cache error (setVersion): ${error.message}`);
    logStat('version', 'error');
  }
}

