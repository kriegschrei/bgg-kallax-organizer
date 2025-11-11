import { calculateStatsSummary, finalizeCube, getOversizedStuffedGames } from './packingCubeService.js';
import {
  prepareGamesForPacking,
  processGameGroups,
  sortGroupsAndStandaloneGames,
  placeGroups,
  placeStandaloneGame,
  getUnplacedGroupGames,
} from './packingOrchestrationService.js';
import { compareGames } from './packingSortService.js';

export const packGamesIntoCubes = (
  games,
  sortRules,
  stacking,
  lockRotation,
  optimizeSpace,
  respectSortOrder,
  fitOversized = false,
  groupExpansions = false,
  groupSeries = false,
) => {
  const primaryOrder = stacking === 'horizontal' ? 'horizontal' : 'vertical';

  // Prepare games: calculate dimensions and filter oversized
  const { validGames, oversizedExcludedGames } = prepareGamesForPacking(
    games,
    primaryOrder,
    fitOversized,
  );

  if (validGames.length === 0) {
    return { cubes: [], oversizedExcludedGames };
  }

  // Process groups if needed
  const { gameGroups, standaloneGames } = processGameGroups(
    validGames,
    groupExpansions,
    groupSeries,
  );

  // Sort groups and standalone games
  const { sortedGroups, standaloneGames: sortedStandaloneGames } = sortGroupsAndStandaloneGames(
    gameGroups,
    standaloneGames,
    sortRules,
    optimizeSpace,
  );

  // Initialize cubes and tracking
  const cubes = [];
  const placed = new Set();

  // Place groups first
  placeGroups(
    sortedGroups,
    cubes,
    primaryOrder,
    lockRotation,
    optimizeSpace,
    respectSortOrder,
    placed,
  );

  // Get unplaced group games and add to standalone
  const unplacedGroupGames = getUnplacedGroupGames(sortedGroups, placed);
  if (unplacedGroupGames.length > 0) {
    unplacedGroupGames.sort((a, b) => compareGames(a, b, sortRules));
    console.log(`   Adding ${unplacedGroupGames.length} unplaced group games to pack individually`);
  }

  // Place standalone games
  for (const game of sortedStandaloneGames) {
    placeStandaloneGame(
      game,
      cubes,
      primaryOrder,
      lockRotation,
      sortRules,
      optimizeSpace,
      respectSortOrder,
      placed,
    );
  }

  // Place unplaced group games individually
  for (const game of unplacedGroupGames) {
    placeStandaloneGame(
      game,
      cubes,
      primaryOrder,
      lockRotation,
      sortRules,
      optimizeSpace,
      respectSortOrder,
      placed,
    );
  }

  // Finalize cubes
  for (let i = 0; i < cubes.length; i += 1) {
    finalizeCube(cubes[i], i);
  }

  return { cubes, oversizedExcludedGames };
};

export { calculateStatsSummary, getOversizedStuffedGames } from './packingCubeService.js';
