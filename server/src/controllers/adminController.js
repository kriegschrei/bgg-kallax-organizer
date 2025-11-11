import { clearCache, cleanup, getStats } from '../../cache.js';

export const getCacheStatsHandler = (req, res) => {
  try {
    const stats = getStats();
    return res.json(stats);
  } catch (error) {
    console.error('Error getting cache stats:', error.message);
    return res.status(500).json({ error: error.message });
  }
};

export const clearCacheHandler = (req, res) => {
  try {
    const success = clearCache();
    if (success) {
      return res.json({ message: 'Cache cleared successfully' });
    }
    return res.status(500).json({ error: 'Failed to clear cache' });
  } catch (error) {
    console.error('Error clearing cache:', error.message);
    return res.status(500).json({ error: error.message });
  }
};

export const cleanupCacheHandler = (req, res) => {
  try {
    const result = cleanup();
    if (result) {
      return res.json({ message: 'Cleanup completed', result });
    }
    return res.status(500).json({ error: 'Cleanup failed' });
  } catch (error) {
    console.error('Error running cleanup:', error.message);
    return res.status(500).json({ error: error.message });
  }
};

