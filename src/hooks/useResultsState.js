import { useState, useCallback } from 'react';

/**
 * Hook to manage results state (cubes, stats, warnings, errors, progress).
 * @returns {Object} Object containing all results state and setters
 */
export const useResultsState = () => {
  const [cubes, setCubes] = useState(null);
  const [stats, setStats] = useState(null);
  const [oversizedGames, setOversizedGames] = useState([]);
  const [noSelectedVersionWarning, setnoSelectedVersionWarning] = useState(null);
  const [lastRequestConfig, setLastRequestConfig] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState('');

  const resetResults = useCallback(() => {
    setCubes(null);
    setStats(null);
    setOversizedGames([]);
    setnoSelectedVersionWarning(null);
    setLastRequestConfig(null);
    setError(null);
    setProgress('');
  }, []);

  return {
    cubes,
    setCubes,
    stats,
    setStats,
    oversizedGames,
    setOversizedGames,
    noSelectedVersionWarning,
    setnoSelectedVersionWarning,
    lastRequestConfig,
    setLastRequestConfig,
    error,
    setError,
    progress,
    setProgress,
    resetResults,
  };
};

export default useResultsState;

