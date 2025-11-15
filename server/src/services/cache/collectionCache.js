import { db } from './database.js';
import { memoryCaches } from './memoryCache.js';
import { hashData, logStat, isStale } from './cacheUtils.js';

// Get collection from cache
export function getCollection(key, collectionHash) {
  try {
    // Try memory cache first
    const memKey = `${key}:${collectionHash}`;
    const memCached = memoryCaches.collections.get(memKey);
    if (memCached && !isStale(memCached.timestamp)) {
      logStat('collection', 'hit_memory');
      return memCached.data;
    }

    // Try database
    const stmt = db.prepare('SELECT data, collection_hash, timestamp FROM collections WHERE key = ?');
    const row = stmt.get(key);
    
    if (row) {
      // Check if hash matches (collection hasn't changed)
      if (row.collection_hash === collectionHash && !isStale(row.timestamp)) {
        const data = JSON.parse(row.data);
        // Update memory cache
        memoryCaches.collections.set(memKey, { data, timestamp: row.timestamp });
        // Update last accessed
        db.prepare('UPDATE collections SET last_accessed = ? WHERE key = ?').run(Date.now(), key);
        logStat('collection', 'hit_db');
        return data;
      } else {
        // Hash mismatch or stale - collection changed
        logStat('collection', 'miss_stale');
        return null;
      }
    }

    logStat('collection', 'miss');
    return null;
  } catch (error) {
    console.error(`Cache error (getCollection): ${error.message}`);
    logStat('collection', 'error');
    return null; // Fall back to API
  }
}

// Set collection in cache
export function setCollection(key, collectionHash, data) {
  try {
    const dataJson = JSON.stringify(data);
    const now = Date.now();
    const memKey = `${key}:${collectionHash}`;

    // Store in memory
    memoryCaches.collections.set(memKey, { data, timestamp: now });

    // Store in database
    db.prepare(`
      INSERT OR REPLACE INTO collections (key, collection_hash, data, timestamp, last_accessed)
      VALUES (?, ?, ?, ?, ?)
    `).run(key, collectionHash, dataJson, now, now);

    logStat('collection', 'set');
  } catch (error) {
    console.error(`Cache error (setCollection): ${error.message}`);
    logStat('collection', 'error');
  }
}

