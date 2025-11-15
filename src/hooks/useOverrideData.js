import { useMemo } from 'react';
import {
  buildOverrideLookups,
  buildSortedOverrides,
  mapOrientationOverrideDisplay,
} from '../utils/resultsOverrides';

/**
 * Hook to process and organize override data (excluded games, orientation, dimensions).
 * @param {Object} options - Configuration object
 * @param {Array} options.excludedGames - Array of excluded game entries
 * @param {Array} options.orientationOverrides - Array of orientation override entries
 * @param {Array} options.dimensionOverrides - Array of dimension override entries
 * @returns {Object} Object containing lookups and sorted override arrays
 */
export const useOverrideData = ({
  excludedGames = [],
  orientationOverrides = [],
  dimensionOverrides = [],
}) =>
  useMemo(() => {
    const lookups = buildOverrideLookups({
      excludedGames,
      orientationOverrides,
      dimensionOverrides,
    });
    const sorted = buildSortedOverrides({
      excludedGames,
      orientationOverrides,
      dimensionOverrides,
    });

    return {
      ...lookups,
      sortedExcludedGames: sorted.excluded,
      orientationOverrideItems: mapOrientationOverrideDisplay(sorted.orientation),
      sortedDimensionOverrides: sorted.dimensions,
    };
  }, [dimensionOverrides, excludedGames, orientationOverrides]);


