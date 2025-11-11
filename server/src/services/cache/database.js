import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_DIR = path.join(__dirname, '../../../cache');
const DB_PATH = path.join(CACHE_DIR, 'bgg-cache.db');

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Initialize SQLite database
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL'); // Better concurrency
db.pragma('foreign_keys = ON');

// Initialize schema
export function initializeSchema() {
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

// Initialize on module load
initializeSchema();

export { db };

