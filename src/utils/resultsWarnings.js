import { toArray, sortByName } from './results';

/**
 * Analyzes the dimensions array to determine which warning category a game belongs to.
 * @param {Array} dimensionsArray - Array of dimension objects
 * @returns {string|null} - 'selectedVersionFallback', 'guessedVersions', 'missingDimensions', or null
 */
const classifyGameByDimensions = (dimensionsArray) => {
  if (!Array.isArray(dimensionsArray) || dimensionsArray.length === 0) {
    return null;
  }

  // Find dimensions by type
  const versionDim = dimensionsArray.find((d) => d?.type === 'version');
  const guessedDim = dimensionsArray.find((d) => d?.type === 'guessed');
  const defaultDim = dimensionsArray.find((d) => d?.type === 'default');

  // Rule 1: selectedVersionFallback
  // If first dimension is type "version" and missing: true, but there is a "guessed" dimension type
  if (versionDim?.missing === true && guessedDim) {
    return 'selectedVersionFallback';
  }

  // Rule 2: guessedVersions
  // If there is no dimension of type "version", and we have a "guessed" type of dimension
  if (!versionDim && guessedDim) {
    return 'guessedVersions';
  }

  // Rule 3: missingDimensions
  // If dimension type "version" has missing: true and the next one is of type "default" and there is no "guessed"
  if (versionDim?.missing === true && defaultDim && !guessedDim) {
    return 'missingDimensions';
  }

  return null;
};

export const collectWarningGroups = ({
  cubes = [],
  oversizedGames = [],
  includeCubeId = true,
} = {}) => {
  const guessedVersions = [];
  const selectedVersionFallback = [];
  const missingDimensions = [];

  toArray(cubes).forEach((cube) => {
    const cubeId = cube?.id ?? null;
    toArray(cube?.games).forEach((game) => {
      const baseGameData = includeCubeId ? { ...game, cubeId } : { ...game };
      const classification = classifyGameByDimensions(game.dimensions);

      if (classification === 'selectedVersionFallback') {
        selectedVersionFallback.push({
          ...baseGameData,
          versionsUrl: game?.versionsUrl ?? null,
          correctionUrl: game?.correctionUrl ?? null,
        });
      } else if (classification === 'guessedVersions') {
        guessedVersions.push({
          ...baseGameData,
          versionsUrl: game?.versionsUrl ?? null,
        });
      } else if (classification === 'missingDimensions') {
        missingDimensions.push({
          ...baseGameData,
          correctionUrl: game?.correctionUrl ?? null,
          versionsUrl: game?.versionsUrl ?? null,
        });
      }
      // If classification is null, the game has correct version dimensions, so no warning needed
    });
  });

  guessedVersions.sort(sortByName);
  selectedVersionFallback.sort(sortByName);
  missingDimensions.sort(sortByName);

  const oversizedList = toArray(oversizedGames)
    .map((game) => ({
      ...game,
      cubeId: game?.cubeId ?? null,
      correctionUrl: game?.correctionUrl ?? null,
      versionsUrl: game?.versionsUrl ?? null,
    }))
    .sort(sortByName);

  return {
    guessedVersions,
    selectedVersionFallback,
    missingDimensions,
    oversized: oversizedList,
  };
};

/**
 * Creates initial state for warning panels (all collapsed).
 */
export const createWarningPanelState = (panelIds) =>
  panelIds.reduce((acc, id) => {
    acc[id] = false;
    return acc;
  }, {});

/**
 * Builds warning panel data from warning groups and panel state.
 * Returns data structure without JSX - JSX rendering is handled in the component.
 */
export const buildWarningPanels = ({
  warningGroups,
  fitOversized,
  panelState,
  onTogglePanel,
  panelConfig,
}) =>
  panelConfig.map((definition) => {
    const items = warningGroups[definition.dataKey] || [];
    const count = items.length;

    if (count === 0) {
      return null;
    }

    const isExpanded = panelState?.[definition.id] ?? false;

    return {
      id: definition.id,
      variant: definition.variant,
      Icon: definition.Icon,
      title: definition.title,
      count,
      getDescription: definition.getDescription,
      items,
      renderItem: definition.renderItem,
      expanded: isExpanded,
      onToggle: () => onTogglePanel(definition.id),
      context: { fitOversized },
    };
  }).filter(Boolean);

