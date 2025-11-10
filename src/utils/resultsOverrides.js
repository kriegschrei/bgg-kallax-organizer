const toArray = (value) => (Array.isArray(value) ? value : []);

const sortByName = (a, b) => {
  const nameA = typeof a?.name === 'string' ? a.name : '';
  const nameB = typeof b?.name === 'string' ? b.name : '';
  return nameA.localeCompare(nameB);
};

export const buildOverrideLookups = ({
  excludedGames = [],
  orientationOverrides = [],
  dimensionOverrides = [],
} = {}) => {
  const excludedLookup = {};
  const orientationLookup = {};
  const dimensionLookup = {};

  toArray(excludedGames).forEach((game) => {
    if (game?.id) {
      excludedLookup[game.id] = game;
    }
  });

  toArray(orientationOverrides).forEach((override) => {
    if (override?.id) {
      orientationLookup[override.id] = override.orientation;
    }
  });

  toArray(dimensionOverrides).forEach((override) => {
    if (override?.id) {
      dimensionLookup[override.id] = override;
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


