import { db } from './database.js';
import { memoryCaches } from './memoryCache.js';
import { logStat, isStale } from './cacheUtils.js';

// Get version from cache
export function getVersion(gameId, versionId) {
  try {
    const key = `${gameId}:${versionId}`;
    
    // Try memory cache first
    const memCached = memoryCaches.versions.get(key);
    if (memCached && !isStale(memCached.timestamp)) {
      logStat('version', 'hit_memory');
      return memCached.data;
    }

    // Try database
    const stmt = db.prepare('SELECT data, timestamp FROM versions WHERE key = ?');
    const row = stmt.get(key);
    
    if (row && !isStale(row.timestamp)) {
      const data = JSON.parse(row.data);
      // Update memory cache
      memoryCaches.versions.set(key, { data, timestamp: row.timestamp });
      // Update last accessed
      db.prepare('UPDATE versions SET last_accessed = ? WHERE key = ?').run(Date.now(), key);
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
export function setVersion(gameId, versionId, data) {
  try {
    const key = `${gameId}:${versionId}`;
    const dataJson = JSON.stringify(data);
    const now = Date.now();

    // Store in memory
    memoryCaches.versions.set(key, { data, timestamp: now });

    // Store in database
    db.prepare(`
      INSERT OR REPLACE INTO versions (key, game_id, version_id, data, timestamp, last_accessed)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(key, gameId, versionId, dataJson, now, now);

    logStat('version', 'set');
  } catch (error) {
    console.error(`Cache error (setVersion): ${error.message}`);
    logStat('version', 'error');
  }
}

