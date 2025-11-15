import { LRUCache } from 'lru-cache';

const CACHE_TTL = 3600 * 1000; // 1 hour in milliseconds
const MEMORY_CACHE_MAX_SIZE = 100 * 1024 * 1024; // 100MB
const MEMORY_CACHE_MAX_ENTRIES = 1000;

// Initialize in-memory LRU caches
export const memoryCaches = {
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

export { CACHE_TTL };

