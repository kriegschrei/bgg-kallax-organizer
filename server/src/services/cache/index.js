// Main cache service exports
export { getCollection, setCollection } from './collectionCache.js';
export { getGame, setGame } from './gameCache.js';
export { getVersion, setVersion } from './versionCache.js';
export { cleanup, getStats, clearCache, checkForDuplicates } from './cacheStats.js';
export { hashData } from './cacheUtils.js';

