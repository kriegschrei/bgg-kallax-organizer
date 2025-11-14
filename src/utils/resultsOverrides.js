import { toArray, sortByName } from './results';

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


