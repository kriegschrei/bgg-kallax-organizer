import { db } from './database.js';
import { memoryCaches } from './memoryCache.js';
import { CACHE_TTL } from './memoryCache.js';

const CLEANUP_AGE = 7 * 24 * 3600 * 1000; // 7 days
const STALE_CLEANUP_AGE = 24 * 3600 * 1000; // 24 hours - remove stale entries not accessed in this time
const DB_MAX_SIZE = 2 * 1024 * 1024 * 1024; // 2GB

// Cleanup old entries
export function cleanup() {
  try {
    const cutoffTime = Date.now() - CLEANUP_AGE;
    const now = Date.now();
    const staleCutoff = now - CACHE_TTL; // Entries older than 1 hour are stale
    const staleAccessCutoff = now - STALE_CLEANUP_AGE; // Remove stale entries not accessed in 24h

    // Clean up old collections (older than 7 days)
    const collectionsDeleted = db.prepare('DELETE FROM collections WHERE timestamp < ?').run(cutoffTime).changes;
    
    // Clean up old games (older than 7 days)
    const gamesDeleted = db.prepare('DELETE FROM games WHERE timestamp < ?').run(cutoffTime).changes;
    
    // Clean up old versions (older than 7 days)
    const versionsDeleted = db.prepare('DELETE FROM versions WHERE timestamp < ?').run(cutoffTime).changes;

    // Also clean up stale entries that haven't been accessed recently
    // (stale = older than CACHE_TTL, and not accessed in last 24 hours)
    const staleGamesDeleted = db.prepare(`
      DELETE FROM games 
      WHERE timestamp < ? AND last_accessed < ?
    `).run(staleCutoff, staleAccessCutoff).changes;

    const staleVersionsDeleted = db.prepare(`
      DELETE FROM versions 
      WHERE timestamp < ? AND last_accessed < ?
    `).run(staleCutoff, staleAccessCutoff).changes;

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

    const totalGamesDeleted = gamesDeleted + staleGamesDeleted;
    const totalVersionsDeleted = versionsDeleted + staleVersionsDeleted;
    
    console.log(`🧹 Cache cleanup: removed ${collectionsDeleted} collections, ${totalGamesDeleted} games (${gamesDeleted} old + ${staleGamesDeleted} stale), ${totalVersionsDeleted} versions (${versionsDeleted} old + ${staleVersionsDeleted} stale), ${statsDeleted} stats`);
    return { 
      collectionsDeleted, 
      gamesDeleted: totalGamesDeleted, 
      versionsDeleted: totalVersionsDeleted, 
      statsDeleted,
      staleGamesDeleted,
      staleVersionsDeleted
    };
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

// Check for potential duplicates in cache
export function checkForDuplicates() {
  try {
    // Check for games with duplicate keys (shouldn't happen with PRIMARY KEY, but check anyway)
    const duplicateGames = db.prepare(`
      SELECT game_id, COUNT(*) as count 
      FROM games 
      GROUP BY game_id 
      HAVING count > 1
    `).all();
    
    // Check for versions with duplicate keys
    const duplicateVersions = db.prepare(`
      SELECT key, COUNT(*) as count 
      FROM versions 
      GROUP BY key 
      HAVING count > 1
    `).all();
    
    // Check for games that might have been stored with different types
    const allGames = db.prepare('SELECT game_id, typeof(game_id) as type FROM games').all();
    const typeGroups = {};
    allGames.forEach(g => {
      const type = g.type || 'unknown';
      typeGroups[type] = (typeGroups[type] || 0) + 1;
    });
    
    // Check for potential type mismatches (numeric strings vs pure strings)
    const numericLikeGames = db.prepare(`
      SELECT game_id 
      FROM games 
      WHERE game_id GLOB '[0-9]*' AND game_id NOT GLOB '*[^0-9]*'
    `).all();
    
    return {
      duplicateGames: duplicateGames.length,
      duplicateVersions: duplicateVersions.length,
      gameIdTypes: typeGroups,
      numericLikeGames: numericLikeGames.length,
      totalGames: allGames.length,
      sampleDuplicates: {
        games: duplicateGames.slice(0, 10),
        versions: duplicateVersions.slice(0, 10)
      }
    };
  } catch (error) {
    console.error(`Error checking for duplicates: ${error.message}`);
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

