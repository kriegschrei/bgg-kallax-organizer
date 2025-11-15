import { db } from './database.js';
import { memoryCaches } from './memoryCache.js';
import { logStat, isStale } from './cacheUtils.js';

// Get game from cache
export function getGame(gameId) {
  try {
    // Try memory cache first
    const memCached = memoryCaches.games.get(gameId);
    if (memCached && !isStale(memCached.timestamp)) {
      logStat('game', 'hit_memory');
      return memCached.data;
    }

    // Try database
    const stmt = db.prepare('SELECT data, timestamp FROM games WHERE game_id = ?');
    const row = stmt.get(gameId);
    
    if (row && !isStale(row.timestamp)) {
      const data = JSON.parse(row.data);
      // Update memory cache
      memoryCaches.games.set(gameId, { data, timestamp: row.timestamp });
      // Update last accessed
      db.prepare('UPDATE games SET last_accessed = ? WHERE game_id = ?').run(Date.now(), gameId);
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
    const dataJson = JSON.stringify(data);
    const now = Date.now();

    // Store in memory
    memoryCaches.games.set(gameId, { data, timestamp: now });

    // Store in database
    db.prepare(`
      INSERT OR REPLACE INTO games (game_id, data, timestamp, last_accessed)
      VALUES (?, ?, ?, ?)
    `).run(gameId, dataJson, now, now);

    logStat('game', 'set');
  } catch (error) {
    console.error(`Cache error (setGame): ${error.message}`);
    logStat('game', 'error');
  }
}

