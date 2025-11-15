import { toArray, sortByName } from './results';

/**
 * Collects games into warning groups based on dimension issues.
 * Uses boolean flags set by the backend instead of analyzing dimension arrays.
 * @param {Object} options - Configuration object
 * @param {Array} options.cubes - Array of cube objects
 * @param {Array} options.oversizedGames - Array of oversized games
 * @param {boolean} options.includeCubeId - Whether to include cube ID in game data
 * @returns {Object} Object containing arrays of games for each warning type
 */
export const collectWarningGroups = ({
  cubes = [],
  oversizedGames = [],
  includeCubeId = true,
} = {}) => {
  const bggDefaultDimensions = [];
  const guessedDueToNoVersion = [];
  const selectedVersionMissingDimensions = [];
  const allVersionsMissingDimensions = [];

  toArray(cubes).forEach((cube) => {
    const cubeId = cube?.id ?? null;
    toArray(cube?.games).forEach((game) => {
      const baseGameData = includeCubeId ? { ...game, cubeId } : { ...game };
      
      // Check for bggDefaultDimensions flag first
      if (game.bggDefaultDimensions === true) {
        bggDefaultDimensions.push({
          ...baseGameData,
          correctionUrl: game?.correctionUrl ?? null,
          versionsUrl: game?.versionsUrl ?? null,
        });
      } 
      // Use boolean flags set by backend instead of analyzing dimensions
      if (game.allVersionsMissingDimensions === true) {
        allVersionsMissingDimensions.push({
          ...baseGameData,
          correctionUrl: game?.correctionUrl ?? null,
          versionsUrl: game?.versionsUrl ?? null,
        });
      } 
      if (game.selectedVersionMissingDimensions === true) {
        selectedVersionMissingDimensions.push({
          ...baseGameData,
          versionsUrl: game?.versionsUrl ?? null,
          correctionUrl: game?.correctionUrl ?? null,
        });
      }
      if (game.guessedDueToNoVersion === true) {
        guessedDueToNoVersion.push({
          ...baseGameData,
          versionsUrl: game?.versionsUrl ?? null,
        });
      }
      // If none of the flags are true, the game has correct version dimensions, so no warning needed
    });
  });

  bggDefaultDimensions.sort(sortByName);
  guessedDueToNoVersion.sort(sortByName);
  selectedVersionMissingDimensions.sort(sortByName);
  allVersionsMissingDimensions.sort(sortByName);

  const oversizedList = toArray(oversizedGames)
    .map((game) => ({
      ...game,
      cubeId: game?.cubeId ?? null,
      correctionUrl: game?.correctionUrl ?? null,
      versionsUrl: game?.versionsUrl ?? null,
    }))
    .sort(sortByName);

  return {
    bggDefaultDimensions,
    guessedDueToNoVersion,
    selectedVersionMissingDimensions,
    allVersionsMissingDimensions,
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

