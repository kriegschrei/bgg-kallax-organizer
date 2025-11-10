import { useMemo } from 'react';
import {
  buildOverrideLookups,
  buildSortedOverrides,
  mapOrientationOverrideDisplay,
} from '../utils/resultsOverrides';

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


