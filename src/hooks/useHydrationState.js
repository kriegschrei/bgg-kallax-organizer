import { useState, useCallback } from 'react';

export const useHydrationState = () => {
  const [settingsHydrated, setSettingsHydrated] = useState(false);
  const [lastResultHydrated, setLastResultHydrated] = useState(false);
  const [hasStoredData, setHasStoredData] = useState(false);

  const resetHydration = useCallback(() => {
    setHasStoredData(false);
    setLastResultHydrated(false);
  }, []);

  return {
    settingsHydrated,
    setSettingsHydrated,
    lastResultHydrated,
    setLastResultHydrated,
    hasStoredData,
    setHasStoredData,
    resetHydration,
  };
};

export default useHydrationState;

