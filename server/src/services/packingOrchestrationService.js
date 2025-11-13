import { calculateBothOrientations, PACKING_CONSTANTS } from './packingPositionService.js';
import { createOversizedExcludedGame, PACKING_DISPLAY_CONSTANTS } from './packingCubeService.js';
import { splitOversizedGroup, getGroupRepresentative, getGroupTotalArea } from './packingGroupService.js';
import { compareGames, sortGamesByArea } from './packingSortService.js';
import { tryPlaceGame, tryAggressiveReorganization, calculateOccupiedAreaForCube } from './packingPlacementService.js';
import { createGameGroups } from './groupingService.js';
import { getSafeGameArea, selectCubesToCheck, MAX_GROUP_AREA } from '../utils/packingHelpers.js';
import { getGameName } from '../utils/gameUtils.js';
import { hasValidDimensions } from '../utils/gameProcessingHelpers.js';

const { CUBE_SIZE, CUBE_AREA } = PACKING_CONSTANTS;
const { OVERSIZED_THRESHOLD } = PACKING_DISPLAY_CONSTANTS;

/* 
 * Prepare games for packing by calculating 2D dimensions and checking for oversized games.
 * @param {Array} games - The games to prepare for packing.
 * @param {string} primaryOrder - The primary order of the games.
 * @param {boolean} fitOversized - Whether to fit oversized games into the cubes.
 * @returns {Object} An object containing the valid games and oversized excluded games.
 */
export const prepareGamesForPacking = (games, primaryOrder, fitOversized) => {
  const oversizedExcludedGames = [];

  for (const game of games) {
    if (!hasValidDimensions(game.dimensions)) {
      const gameName = getGameName(game, game.gameId);
      console.error(`❌ Game "${gameName}" has invalid dimensions`);
      game.dims2D = null;
      continue;
    }
    
    // Calculate both orientations at once
    const orientations = calculateBothOrientations(game.dimensions);
    
    game.dims2D = {
      horizontal: orientations.horizontal,
      vertical: orientations.vertical,
    };
    
    const primaryOrientation = game.forcedOrientation || game.primaryOrientation || primaryOrder;
    game.primaryOrientation = primaryOrientation;
    
    // Use primary orientation for oversized check
    const primaryDims = primaryOrientation === 'vertical' ? orientations.vertical : orientations.horizontal;
    game.exceedsMaxDimension =
      primaryDims.x > OVERSIZED_THRESHOLD || primaryDims.y > OVERSIZED_THRESHOLD;

    if (game.exceedsMaxDimension && !fitOversized) {
      oversizedExcludedGames.push(createOversizedExcludedGame(game));
    }
  }

  const validGames = games.filter((g) => {
    if (!g.dims2D || !g.dims2D.horizontal || !g.dims2D.vertical) {
      return false;
    }

    if (g.exceedsMaxDimension && !fitOversized) {
      return false;
    }

    return true;
  });

  return { validGames, oversizedExcludedGames };
};

export const processGameGroups = (validGames, groupExpansions, groupSeries) => {
  let gameGroups = new Map();
  let standaloneGames = [...validGames];

  if (groupExpansions || groupSeries) {
    const groupingResult = createGameGroups(validGames, groupExpansions, groupSeries);

    const splitGroups = new Map();
    for (const [groupId, group] of groupingResult.groups.entries()) {
      const subGroups = splitOversizedGroup(group, MAX_GROUP_AREA);
      if (subGroups.length === 1) {
        splitGroups.set(groupId, subGroups[0]);
      } else {
        subGroups.forEach((subGroup, index) => {
          splitGroups.set(`${groupId}_split${index}`, subGroup);
        });
      }
    }

    gameGroups = splitGroups;
    standaloneGames = groupingResult.standaloneGames;

    for (const game of validGames) {
      if (game._group !== undefined) {
        delete game._group;
      }
    }
  }

  return { gameGroups, standaloneGames };
};

export const sortGroupsAndStandaloneGames = (gameGroups, standaloneGames, sortRules, optimizeSpace) => {
  const sortedGroups = [];
  if (gameGroups.size > 0) {
    for (const [groupId, group] of gameGroups.entries()) {
      sortedGroups.push({ groupId, group });
    }

    if (optimizeSpace) {
      sortedGroups.sort((a, b) => {
        const areaA = getGroupTotalArea(a.group);
        const areaB = getGroupTotalArea(b.group);
        if (Math.abs(areaA - areaB) > 0.01) return areaB - areaA;

        const repA = getGroupRepresentative(a.group);
        const repB = getGroupRepresentative(b.group);
        return compareGames(repA, repB, sortRules);
      });
    } else {
      sortedGroups.sort((a, b) => {
        const repA = getGroupRepresentative(a.group);
        const repB = getGroupRepresentative(b.group);
        return compareGames(repA, repB, sortRules);
      });
    }
  }

  if (standaloneGames.length > 0) {
    if (optimizeSpace) {
      // Sort by area descending when optimizing space
      standaloneGames.sort((a, b) => {
        const areaA = getSafeGameArea(a);
        const areaB = getSafeGameArea(b);
        if (Math.abs(areaA - areaB) > 0.01) return areaB - areaA;
        return compareGames(a, b, sortRules);
      });
    } else {
      standaloneGames.sort((a, b) => compareGames(a, b, sortRules));
    }
  }

  return { sortedGroups, standaloneGames };
};

export const buildOrientations = (game, primaryOrder, lockRotation) => {
  const forcedOrientation =
    game.forcedOrientation === 'horizontal' || game.forcedOrientation === 'vertical'
      ? game.forcedOrientation
      : null;
  
  const orientations = [];
  
  // Use pre-computed dimensions
  const horizontalDims = game.dims2D?.horizontal;
  const verticalDims = game.dims2D?.vertical;
  
  if (!horizontalDims || !verticalDims) {
    // Fallback (shouldn't happen if prepareGamesForPacking ran)
    return [];
  }
  
  if (forcedOrientation) {
    const forcedDims = forcedOrientation === 'horizontal' ? horizontalDims : verticalDims;
    orientations.push({ x: forcedDims.x, y: forcedDims.y, label: forcedOrientation });
  } else {
    const primary = game.primaryOrientation || primaryOrder;
    
    // Add primary orientation first
    if (primary === 'horizontal') {
      orientations.push({ x: horizontalDims.x, y: horizontalDims.y, label: 'horizontal' });
      // Add alternate if rotation is not locked and dimensions differ
      if (!lockRotation && Math.abs(horizontalDims.x - verticalDims.x) > 0.01) {
        orientations.push({ x: verticalDims.x, y: verticalDims.y, label: 'vertical' });
      }
    } else {
      orientations.push({ x: verticalDims.x, y: verticalDims.y, label: 'vertical' });
      // Add alternate if rotation is not locked and dimensions differ
      if (!lockRotation && Math.abs(horizontalDims.x - verticalDims.x) > 0.01) {
        orientations.push({ x: horizontalDims.x, y: horizontalDims.y, label: 'horizontal' });
      }
    }
  }
  
  return orientations;
};

export const tryPlaceGroup = (cube, group, primaryOrder, lockRotation, placed) => {
  const tempCube = { 
    games: [...cube.games], 
    rows: [],
    occupiedArea: cube.occupiedArea !== undefined ? cube.occupiedArea : 0
  };
  const groupPlaced = [];

  const sortedGroup = sortGamesByArea(group);

  for (const game of sortedGroup) {
    if (placed.has(game.id)) continue;

    const orientations = buildOrientations(game, primaryOrder, lockRotation);

    let gamePlaced = false;
    for (const orientation of orientations) {
      if (
        tryPlaceGame(
          tempCube,
          game,
          orientation.x,
          orientation.y,
          orientation.label,
        )
      ) {
        groupPlaced.push(game);
        gamePlaced = true;
        break;
      }
    }

    if (!gamePlaced) {
      return false;
    }
  }

  cube.games = tempCube.games;
  cube.occupiedArea = tempCube.occupiedArea;
  for (const game of groupPlaced) {
    placed.add(game.id);
  }

  return true;
};

export const placeStandaloneGame = (
  game,
  cubes,
  primaryOrder,
  lockRotation,
  sortRules,
  optimizeSpace,
  respectSortOrder,
  placed,
) => {
  if (placed.has(game.id)) return;

  const orientations = buildOrientations(game, primaryOrder, lockRotation);

  let wasPlaced = false;

  const cubesToCheck = selectCubesToCheck(
    cubes,
    optimizeSpace,
    respectSortOrder,
    calculateOccupiedAreaForCube,
  );

  for (const cube of cubesToCheck) {
    for (const orientation of orientations) {
      if (tryPlaceGame(cube, game, orientation.x, orientation.y, orientation.label)) {
        placed.add(game.id);
        wasPlaced = true;
        break;
      }
    }
    if (wasPlaced) break;

    for (const orientation of orientations) {
      if (
        tryAggressiveReorganization(
          cube,
          game,
          orientation.x,
          orientation.y,
          sortRules,
          orientation.label,
        )
      ) {
        placed.add(game.id);
        wasPlaced = true;
        break;
      }
    }
    if (wasPlaced) break;
  }

  if (!wasPlaced) {
    const newCube = { games: [], rows: [], occupiedArea: 0 };

    for (const orientation of orientations) {
      if (tryPlaceGame(newCube, game, orientation.x, orientation.y, orientation.label)) {
        placed.add(game.id);
        cubes.push(newCube);
        break;
      }
    }
  }
};

export const placeGroups = (
  sortedGroups,
  cubes,
  primaryOrder,
  lockRotation,
  optimizeSpace,
  respectSortOrder,
  placed,
) => {
  if (sortedGroups.length === 0) {
    return;
  }

  for (const { groupId, group } of sortedGroups) {
    if (group.every((g) => placed.has(g.id))) {
      continue;
    }

    let groupPlaced = false;

    const cubesToCheck = selectCubesToCheck(
      cubes,
      optimizeSpace,
      respectSortOrder,
      calculateOccupiedAreaForCube,
    );

    for (const cube of cubesToCheck) {
      if (tryPlaceGroup(cube, group, primaryOrder, lockRotation, placed)) {
        groupPlaced = true;
        break;
      }
    }

    if (!groupPlaced) {
      const newCube = { games: [], rows: [], occupiedArea: 0 };
      if (tryPlaceGroup(newCube, group, primaryOrder, lockRotation, placed)) {
        cubes.push(newCube);
        groupPlaced = true;
      }
    }

    if (!groupPlaced) {
      console.log(
        `   ⚠️  Group "${groupId}" couldn't be placed together, will pack individually`,
      );
    }
  }
};

export const getUnplacedGroupGames = (sortedGroups, placed) => {
  const unplacedGroupGames = [];
  if (sortedGroups.length > 0) {
    for (const { group } of sortedGroups) {
      for (const game of group) {
        if (!placed.has(game.id)) {
          unplacedGroupGames.push(game);
        }
      }
    }
  }
  return unplacedGroupGames;
};

