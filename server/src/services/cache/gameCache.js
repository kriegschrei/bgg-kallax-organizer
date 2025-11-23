import { db } from './database.js';
import { memoryCaches } from './memoryCache.js';
import { logStat, isStale } from './cacheUtils.js';

// Get game from cache
export function getGame(gameId) {
  try {
    // Normalize gameId to string for consistency (database stores as TEXT)
    const gameIdStr = String(gameId);
    
    // Try memory cache first
    const memCached = memoryCaches.games.get(gameIdStr);
    if (memCached && !isStale(memCached.timestamp)) {
      logStat('game', 'hit_memory');
      return memCached.data;
    }

    // Try database
    const stmt = db.prepare('SELECT data, timestamp FROM games WHERE game_id = ?');
    const row = stmt.get(gameIdStr);
    
    if (row && !isStale(row.timestamp)) {
      const data = JSON.parse(row.data);
      // Update memory cache
      memoryCaches.games.set(gameIdStr, { data, timestamp: row.timestamp });
      // Update last accessed
      db.prepare('UPDATE games SET last_accessed = ? WHERE game_id = ?').run(Date.now(), gameIdStr);
      logStat('game', 'hit_db');
      return data;
    }

    logStat('game', 'miss');
    return null;
  } catch (error) {
    console.error(`Cache error (getGame): ${error.message}`);
    logStat('game', 'error');
    return null; // Fall back to API
  }
}

// Set game in cache
export function setGame(gameId, data) {
  try {
    // Normalize gameId to string for consistency (database stores as TEXT)
    const gameIdStr = String(gameId);
    const dataJson = JSON.stringify(data);
    const now = Date.now();

    // Check if entry already exists
    const existing = db.prepare('SELECT game_id FROM games WHERE game_id = ?').get(gameIdStr);
    const isUpdate = existing !== undefined;

    // Store in memory
    memoryCaches.games.set(gameIdStr, { data, timestamp: now });

    // Store in database
    const result = db.prepare(`
      INSERT OR REPLACE INTO games (game_id, data, timestamp, last_accessed)
      VALUES (?, ?, ?, ?)
    `).run(gameIdStr, dataJson, now, now);

    // Log for debugging
    if (process.env.DEBUG_CACHE === 'true') {
      console.debug(`💾 Cache ${isUpdate ? 'UPDATE' : 'INSERT'} game: ${gameIdStr} (${typeof gameId} -> string)`);
    }

    logStat('game', isUpdate ? 'update' : 'set');
  } catch (error) {
    console.error(`Cache error (setGame): ${error.message}`);
    logStat('game', 'error');
  }
}

