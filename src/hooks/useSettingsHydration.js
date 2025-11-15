import { useEffect } from 'react';
import {
  getExcludedGames,
  getOrientationOverrides,
  getDimensionOverrides,
  getUserSettings,
  getLastResult,
} from '../services/storage/indexedDb';
import { arrayToMap } from '../utils/collectionHelpers';
import { validateStoredSettings, applyStoredSettings, normalizeStoredStacking } from '../utils/settingsHydration';

/**
 * Hook to handle hydration of settings and last result from IndexedDB.
 * @param {Object} options - Configuration object
 * @param {Function} options.setExcludedGamesMap - Setter for excluded games map
 * @param {Function} options.setOrientationOverridesMap - Setter for orientation overrides map
 * @param {Function} options.setDimensionOverridesMap - Setter for dimension overrides map
 * @param {Function} options.setHasStoredData - Setter for has stored data flag
 * @param {Function} options.setSettingsHydrated - Setter for settings hydrated flag
 * @param {Function} options.setLastResultHydrated - Setter for last result hydrated flag
 * @param {boolean} options.settingsHydrated - Whether settings have been hydrated
 * @param {boolean} options.lastResultHydrated - Whether last result has been hydrated
 * @param {*} options.cubes - Current cubes state
 * @param {Object} options.setters - Object containing all state setters
 * @param {Function} options.setCubes - Setter for cubes
 * @param {Function} options.setStats - Setter for stats
 * @param {Function} options.setOversizedGames - Setter for oversized games
 * @param {Function} options.setFitOversized - Setter for fit oversized flag
 * @param {Function} options.setLockRotation - Setter for lock rotation flag
 * @param {Function} options.setStacking - Setter for stacking
 * @param {Function} options.setLastRequestConfig - Setter for last request config
 * @param {Function} options.setError - Setter for error
 * @param {Function} options.setProgress - Setter for progress
 * @param {Object} [options.filtersCollapsedFromStorageRef] - Ref to track if filtersCollapsed was set from storage
 */
export const useSettingsHydration = ({
  setExcludedGamesMap,
  setOrientationOverridesMap,
  setDimensionOverridesMap,
  setHasStoredData,
  setSettingsHydrated,
  setLastResultHydrated,
  settingsHydrated,
  lastResultHydrated,
  cubes,
  setters,
  setCubes,
  setStats,
  setOversizedGames,
  setFitOversized,
  setLockRotation,
  setStacking,
  setLastRequestConfig,
  setError,
  setProgress,
  filtersCollapsedFromStorageRef,
}) => {
  // Hydrate settings from storage
  useEffect(() => {
    // Prevent re-running if already hydrated
    if (settingsHydrated) {
      return;
    }

    let isCancelled = false;

    async function hydrateFromStorage() {
      try {
        let foundStoredData = false;

        const [
          storedExcluded,
          storedOrientation,
          storedDimensions,
          storedSettings,
        ] = await Promise.all([
          getExcludedGames(),
          getOrientationOverrides(),
          getDimensionOverrides(),
          getUserSettings(),
        ]);

        if (isCancelled) {
          return;
        }

        setExcludedGamesMap(arrayToMap(storedExcluded));
        setOrientationOverridesMap(arrayToMap(storedOrientation));
        setDimensionOverridesMap(arrayToMap(storedDimensions));

        if (
          (Array.isArray(storedExcluded) && storedExcluded.length > 0) ||
          (Array.isArray(storedOrientation) && storedOrientation.length > 0) ||
          (Array.isArray(storedDimensions) && storedDimensions.length > 0)
        ) {
          foundStoredData = true;
        }

        if (validateStoredSettings(storedSettings)) {
          foundStoredData = true;
          applyStoredSettings(storedSettings, setters, {
            filtersCollapsedFromStorageRef,
          });
        }

        setHasStoredData(foundStoredData);
      } catch (storageError) {
        console.error('Unable to load stored preferences', storageError);
      } finally {
        if (!isCancelled) {
          setSettingsHydrated(true);
        }
      }
    }

    hydrateFromStorage();

    return () => {
      isCancelled = true;
    };
  }, [
    settingsHydrated,
    setExcludedGamesMap,
    setOrientationOverridesMap,
    setDimensionOverridesMap,
    setHasStoredData,
    setSettingsHydrated,
    filtersCollapsedFromStorageRef,
  ]);

  // Hydrate last result from storage
  useEffect(() => {
    if (!settingsHydrated || lastResultHydrated || cubes !== null) {
      return;
    }

    let isCancelled = false;

    (async () => {
      try {
        const storedResult = await getLastResult();
        if (
          isCancelled ||
          !storedResult ||
          !storedResult.response ||
          !Array.isArray(storedResult.response.cubes) ||
          storedResult.response.cubes.length === 0
        ) {
          return;
        }

        setCubes(storedResult.response.cubes);
        setStats(storedResult.response.stats || null);
        setOversizedGames(storedResult.response.oversizedGames || []);
        setHasStoredData(true);

        if (typeof storedResult.response.fitOversized === 'boolean') {
          setFitOversized(storedResult.response.fitOversized);
        }
        if (typeof storedResult.response.lockRotation === 'boolean') {
          setLockRotation(storedResult.response.lockRotation);
        }
        if (typeof storedResult.response.stacking === 'string') {
          setStacking(normalizeStoredStacking(storedResult.response.stacking));
        }
        if (storedResult.requestConfig) {
          setLastRequestConfig(storedResult.requestConfig);
        }

        setError(null);
        setProgress('');
      } catch (resultError) {
        console.error('Unable to restore last result', resultError);
      } finally {
        if (!isCancelled) {
          setLastResultHydrated(true);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [
    settingsHydrated,
    lastResultHydrated,
    cubes,
    setCubes,
    setStats,
    setOversizedGames,
    setHasStoredData,
    setFitOversized,
    setLockRotation,
    setStacking,
    setLastRequestConfig,
    setError,
    setProgress,
  ]);
};

