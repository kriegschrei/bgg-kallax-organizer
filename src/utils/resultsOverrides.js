import { toArray, sortByName } from './results';

/**
 * Builds lookup maps for excluded games, orientation overrides, and dimension overrides.
 * @param {Object} options - Configuration object
 * @param {Array} options.excludedGames - Array of excluded game entries
 * @param {Array} options.orientationOverrides - Array of orientation override entries
 * @param {Array} options.dimensionOverrides - Array of dimension override entries
 * @returns {Object} Object containing excludedLookup, orientationLookup, and dimensionLookup
 */
export const buildOverrideLookups = ({
  excludedGames = [],
  orientationOverrides = [],
  dimensionOverrides = [],
} = {}) => {
  const excludedLookup = {};
  const orientationLookup = {};
  const dimensionLookup = {};

  toArray(excludedGames).forEach((game) => {
    if (game?.key) {
      excludedLookup[game.key] = game;
    }
  });

  toArray(orientationOverrides).forEach((override) => {
    if (override?.key) {
      orientationLookup[override.key] = override.orientation;
    }
  });

  toArray(dimensionOverrides).forEach((override) => {
    if (override?.key) {
      dimensionLookup[override.key] = override;
    }
  });

  return { excludedLookup, orientationLookup, dimensionLookup };
};

/**
 * Builds sorted arrays of override entries.
 * @param {Object} options - Configuration object
 * @param {Array} options.excludedGames - Array of excluded game entries
 * @param {Array} options.orientationOverrides - Array of orientation override entries
 * @param {Array} options.dimensionOverrides - Array of dimension override entries
 * @returns {Object} Object containing sorted excluded, orientation, and dimensions arrays
 */
export const buildSortedOverrides = ({
  excludedGames = [],
  orientationOverrides = [],
  dimensionOverrides = [],
} = {}) => ({
  excluded: [...toArray(excludedGames)].sort(sortByName),
  orientation: [...toArray(orientationOverrides)].sort(sortByName),
  dimensions: [...toArray(dimensionOverrides)].sort(sortByName),
});

export const mapOrientationOverrideDisplay = (overrides = []) =>
  overrides.map((override) => {
    const orientation = override?.orientation === 'horizontal' ? 'horizontal' : 'vertical';
    return {
      ...override,
      orientation,
      orientationLabel: orientation === 'horizontal' ? 'Horizontal' : 'Vertical',
      nextOrientation: orientation === 'vertical' ? 'horizontal' : 'vertical',
    };
  });


