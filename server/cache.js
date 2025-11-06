import Database from 'better-sqlite3';
import { LRUCache } from 'lru-cache';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cache configuration
const CACHE_DIR = path.join(__dirname, 'cache');
const DB_PATH = path.join(CACHE_DIR, 'bgg-cache.db');
const CACHE_TTL = 3600 * 1000; // 1 hour in milliseconds
const MEMORY_CACHE_MAX_SIZE = 100 * 1024 * 1024; // 100MB
const MEMORY_CACHE_MAX_ENTRIES = 1000;
const DB_MAX_SIZE = 2 * 1024 * 1024 * 1024; // 2GB
const CLEANUP_AGE = 7 * 24 * 3600 * 1000; // 7 days

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Initialize SQLite database
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL'); // Better concurrency
db.pragma('foreign_keys = ON');

// Initialize schema
function initializeSchema() {
  // Collections cache
  db.exec(`
    CREATE TABLE IF NOT EXISTS collections (
      key TEXT PRIMARY KEY,
      collection_hash TEXT NOT NULL,
      data TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      last_accessed INTEGER NOT NULL
    );
    
    CREATE INDEX IF NOT EXISTS idx_collections_hash ON collections(collection_hash);
    CREATE INDEX IF NOT EXISTS idx_collections_timestamp ON collections(timestamp);
  `);

  // Games cache
  db.exec(`
    CREATE TABLE IF NOT EXISTS games (
      game_id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      last_accessed INTEGER NOT NULL
    );
    
    CREATE INDEX IF NOT EXISTS idx_games_timestamp ON games(timestamp);
  `);

  // Versions cache
  db.exec(`
    CREATE TABLE IF NOT EXISTS versions (
      key TEXT PRIMARY KEY,
      game_id TEXT NOT NULL,
      version_id TEXT NOT NULL,
      data TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      last_accessed INTEGER NOT NULL
    );
    
    CREATE INDEX IF NOT EXISTS idx_versions_timestamp ON versions(timestamp);
    CREATE INDEX IF NOT EXISTS idx_versions_game_id ON versions(game_id);
  `);

  // Cache statistics
  db.exec(`
    CREATE TABLE IF NOT EXISTS cache_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cache_type TEXT NOT NULL,
      operation TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );
    
    CREATE INDEX IF NOT EXISTS idx_cache_stats_timestamp ON cache_stats(timestamp);
  `);
}

// Initialize in-memory LRU caches
const memoryCaches = {
  collections: new LRUCache({
    max: MEMORY_CACHE_MAX_ENTRIES,
    maxSize: MEMORY_CACHE_MAX_SIZE,
    sizeCalculation: (value) => JSON.stringify(value).length,
    ttl: CACHE_TTL
  }),
  games: new LRUCache({
    max: MEMORY_CACHE_MAX_ENTRIES,
    maxSize: MEMORY_CACHE_MAX_SIZE,
    sizeCalculation: (value) => JSON.stringify(value).length,
    ttl: CACHE_TTL
  }),
  versions: new LRUCache({
    max: MEMORY_CACHE_MAX_ENTRIES,
    maxSize: MEMORY_CACHE_MAX_SIZE,
    sizeCalculation: (value) => JSON.stringify(value).length,
    ttl: CACHE_TTL
  })
};

// Helper to hash data
function hashData(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// Helper to log statistics
function logStat(cacheType, operation) {
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
function isStale(timestamp) {
  return Date.now() - timestamp > CACHE_TTL;
}

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

// Cleanup old entries
export function cleanup() {
  try {
    const cutoffTime = Date.now() - CLEANUP_AGE;
    const now = Date.now();

    // Clean up old collections
    const collectionsDeleted = db.prepare('DELETE FROM collections WHERE timestamp < ?').run(cutoffTime).changes;
    
    // Clean up old games
    const gamesDeleted = db.prepare('DELETE FROM games WHERE timestamp < ?').run(cutoffTime).changes;
    
    // Clean up old versions
    const versionsDeleted = db.prepare('DELETE FROM versions WHERE timestamp < ?').run(cutoffTime).changes;

    // Clean up old stats (keep last 30 days)
    const statsCutoff = Date.now() - (30 * 24 * 3600 * 1000);
    const statsDeleted = db.prepare('DELETE FROM cache_stats WHERE timestamp < ?').run(statsCutoff).changes;

    // Check database size and evict if needed
    const dbSize = db.prepare('SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()').get();
    if (dbSize && dbSize.size > DB_MAX_SIZE * 0.9) { // If > 90% of max
      // Evict oldest 10% of entries (by last_accessed)
      const evictCount = Math.floor(dbSize.size / 10);
      
      // Evict from each table
      db.prepare(`
        DELETE FROM collections 
        WHERE key IN (
          SELECT key FROM collections 
          ORDER BY last_accessed ASC 
          LIMIT ?
        )
      `).run(Math.floor(evictCount / 3));
      
      db.prepare(`
        DELETE FROM games 
        WHERE game_id IN (
          SELECT game_id FROM games 
          ORDER BY last_accessed ASC 
          LIMIT ?
        )
      `).run(Math.floor(evictCount / 3));
      
      db.prepare(`
        DELETE FROM versions 
        WHERE key IN (
          SELECT key FROM versions 
          ORDER BY last_accessed ASC 
          LIMIT ?
        )
      `).run(Math.floor(evictCount / 3));
    }

    console.log(`🧹 Cache cleanup: removed ${collectionsDeleted} collections, ${gamesDeleted} games, ${versionsDeleted} versions, ${statsDeleted} stats`);
    return { collectionsDeleted, gamesDeleted, versionsDeleted, statsDeleted };
  } catch (error) {
    console.error(`Cache cleanup error: ${error.message}`);
    return null;
  }
}

// Get cache statistics
export function getStats() {
  try {
    const stats = {
      memory: {
        collections: memoryCaches.collections.size,
        games: memoryCaches.games.size,
        versions: memoryCaches.versions.size
      },
      database: {
        collections: db.prepare('SELECT COUNT(*) as count FROM collections').get().count,
        games: db.prepare('SELECT COUNT(*) as count FROM games').get().count,
        versions: db.prepare('SELECT COUNT(*) as count FROM versions').get().count
      },
      operations: {}
    };

    // Get operation stats for last 24 hours
    const last24h = Date.now() - (24 * 3600 * 1000);
    const operationStats = db.prepare(`
      SELECT cache_type, operation, COUNT(*) as count
      FROM cache_stats
      WHERE timestamp > ?
      GROUP BY cache_type, operation
    `).all(last24h);

    operationStats.forEach(row => {
      if (!stats.operations[row.cache_type]) {
        stats.operations[row.cache_type] = {};
      }
      stats.operations[row.cache_type][row.operation] = row.count;
    });

    // Get database size
    const dbSize = db.prepare('SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()').get();
    stats.database.size = dbSize?.size || 0;
    stats.database.sizeMB = ((dbSize?.size || 0) / (1024 * 1024)).toFixed(2);

    return stats;
  } catch (error) {
    console.error(`Error getting cache stats: ${error.message}`);
    return null;
  }
}

// Clear all cache
export function clearCache() {
  try {
    // Clear memory caches
    memoryCaches.collections.clear();
    memoryCaches.games.clear();
    memoryCaches.versions.clear();

    // Clear database
    db.prepare('DELETE FROM collections').run();
    db.prepare('DELETE FROM games').run();
    db.prepare('DELETE FROM versions').run();
    db.prepare('DELETE FROM cache_stats').run();

    // Vacuum to reclaim space
    db.exec('VACUUM');

    console.log('🗑️  Cache cleared');
    return true;
  } catch (error) {
    console.error(`Error clearing cache: ${error.message}`);
    return false;
  }
}

// Extract minimal collection data from parsed XML
export function extractCollectionData(collectionXml) {
  if (!collectionXml.items || !collectionXml.items.item) {
    return { items: [] };
  }

  const items = Array.isArray(collectionXml.items.item) 
    ? collectionXml.items.item 
    : [collectionXml.items.item];

  return {
    items: items.map(item => ({
      gameId: item.$.objectid,
      versionId: item.version?.[0]?.item?.[0]?.$?.id || 'default',
      subtype: item.$.subtype,
      name: item.name?.[0]?._ || item.name?.[0]
    }))
  };
}

// Extract minimal game data from parsed XML (for sorting/organizing)
export function extractGameData(item) {
  const gameId = item.$.id;
  const name = item.name?.find(n => n.$.type === 'primary')?.$?.value || 'Unknown';
  
  const minPlayers = parseInt(item.minplayers?.[0]?.$?.value || 1);
  const maxPlayers = parseInt(item.maxplayers?.[0]?.$?.value || 1);
  const minPlaytime = parseInt(item.minplaytime?.[0]?.$?.value || 0);
  const maxPlaytime = parseInt(item.maxplaytime?.[0]?.$?.value || 0);
  const age = parseInt(item.minage?.[0]?.$?.value || 0);

  // Extract categories and families
  const categories = item.link
    ?.filter(l => l.$.type === 'boardgamecategory')
    .map(l => l.$.value) || [];
  
  const families = item.link
    ?.filter(l => l.$.type === 'boardgamefamily')
    .map(l => l.$.value) || [];

  // Extract stats
  const stats = item.statistics?.[0]?.ratings?.[0];
  const bggRating = parseFloat(stats?.average?.[0]?.$?.value || 0);
  const weight = parseFloat(stats?.averageweight?.[0]?.$?.value || 0);
  
  const ranks = stats?.ranks?.[0]?.rank || [];
  let bggRank = null;
  for (const rank of ranks) {
    if (rank.$.name === 'boardgame' && rank.$.value !== 'Not Ranked') {
      bggRank = parseInt(rank.$.value);
      break;
    }
  }

  // Extract poll data
  let bestPlayerCount = null;
  let communityAge = null;

  const polls = item.poll || [];
  for (const poll of polls) {
    if (poll.$.name === 'suggested_numplayers') {
      let maxBestVotes = 0;
      const results = poll.results || [];
      for (const result of results) {
        const numPlayers = result.$.numplayers;
        const bestResult = result.result?.find(r => r.$.value === 'Best');
        if (bestResult) {
          const votes = parseInt(bestResult.$.numvotes || 0);
          if (votes > maxBestVotes) {
            maxBestVotes = votes;
            bestPlayerCount = parseInt(numPlayers);
          }
        }
      }
    }
    
    if (poll.$.name === 'suggested_playerage') {
      let maxVotes = 0;
      const results = poll.results?.[0]?.result || [];
      for (const result of results) {
        const votes = parseInt(result.$.numvotes || 0);
        if (votes > maxVotes) {
          maxVotes = votes;
          communityAge = parseInt(result.$.value);
        }
      }
    }
  }

  return {
    name,
    categories,
    families,
    bggRank,
    minPlayers,
    maxPlayers,
    bestPlayerCount,
    minPlaytime,
    maxPlaytime,
    age,
    communityAge,
    weight,
    bggRating
  };
}

// Extract version data from parsed XML
export function extractVersionData(versionItem) {
  const versionId = versionItem.$?.id || 'default';
  const versionName = versionItem.name?.[0]?.$?.value || null;
  const yearPublished = versionItem.yearpublished?.[0]?.$?.value || null;
  const width = versionItem.width?.[0]?.$?.value;
  const length = versionItem.length?.[0]?.$?.value;
  const depth = versionItem.depth?.[0]?.$?.value;

  const widthNum = parseFloat(width);
  const lengthNum = parseFloat(length);
  const depthNum = parseFloat(depth);
  const hasValidDimensions = widthNum > 0 && lengthNum > 0 && depthNum > 0;

  return {
    versionId,
    name: versionName,
    yearPublished,
    dimensions: hasValidDimensions ? {
      width: widthNum,
      length: lengthNum,
      depth: depthNum,
      missingDimensions: false
    } : {
      width: 0,
      length: 0,
      depth: 0,
      missingDimensions: true
    }
  };
}

// Initialize on module load
initializeSchema();

// Export hash function for use in main server
export { hashData };

