import { useState, useCallback } from 'react';

export const useResultsState = () => {
  const [cubes, setCubes] = useState(null);
  const [stats, setStats] = useState(null);
  const [oversizedGames, setOversizedGames] = useState([]);
  const [missingVersionWarning, setMissingVersionWarning] = useState(null);
  const [lastRequestConfig, setLastRequestConfig] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState('');

  const resetResults = useCallback(() => {
    setCubes(null);
    setStats(null);
    setOversizedGames([]);
    setMissingVersionWarning(null);
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
    missingVersionWarning,
    setMissingVersionWarning,
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

