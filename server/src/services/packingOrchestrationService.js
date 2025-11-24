import { calculateBothOrientations, PACKING_CONSTANTS } from './packingPositionService.js';
import { createOversizedExcludedGame, PACKING_DISPLAY_CONSTANTS } from './packingCubeService.js';
import { splitOversizedGroup, getGroupRepresentative, getGroupTotalArea } from './packingGroupService.js';
import { compareGames, sortGamesByArea } from './packingSortService.js';
import { tryPlaceGame, tryAggressiveReorganization, calculateOccupiedAreaForCube } from './packingPlacementService.js';
import { createGameGroups } from './groupingService.js';
import { getSafeGameArea, selectCubesToCheck, MAX_GROUP_AREA } from '../utils/packingHelpers.js';
import { hasValidDimensions } from '../utils/gameProcessingHelpers.js';

const { CUBE_AREA } = PACKING_CONSTANTS;
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
      const gameName = game.gameName;
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

export const processGameGroups = (validGames, groupExpansions) => {
  let gameGroups = new Map();
  let standaloneGames = [...validGames];

  if (groupExpansions) {
    const groupingResult = createGameGroups(validGames, groupExpansions);

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
      // When optimizing space, sort ONLY by area descending (ignore sortRules)
      sortedGroups.sort((a, b) => {
        const areaA = getGroupTotalArea(a.group);
        const areaB = getGroupTotalArea(b.group);
        return areaB - areaA; // No tiebreaker, just area descending
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
      // When optimizing space, sort ONLY by area descending (ignore sortRules)
      standaloneGames.sort((a, b) => {
        const areaA = getSafeGameArea(a);
        const areaB = getSafeGameArea(b);
        return areaB - areaA; // No tiebreaker, just area descending
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
  backfillPercentage,
  placed,
) => {
  if (placed.has(game.id)) return;

  const orientations = buildOrientations(game, primaryOrder, lockRotation);
  
  // Calculate minimum game area needed (smallest orientation)
  // This helps filter cubes that definitely don't have enough space
  const minGameArea = orientations.length > 0
    ? Math.min(...orientations.map(o => o.x * o.y))
    : getSafeGameArea(game) || 0;

  let wasPlaced = false;

  // Get cubes to check based on backfill percentage (maintains order - earliest first)
  const cubesToCheck = selectCubesToCheck(
    cubes,
    optimizeSpace,
    backfillPercentage,
    calculateOccupiedAreaForCube,
  );

  // Filter cubes that have enough area for this game
  // This avoids wasting time trying to place in cubes that are too full
  const cubesWithSpace = cubesToCheck.filter(cube => {
    const cubeOccupiedArea = cube.occupiedArea !== undefined 
      ? cube.occupiedArea 
      : calculateOccupiedAreaForCube(cube);
    return cubeOccupiedArea + minGameArea <= CUBE_AREA;
  });

  // Try each cube starting with the earliest one in the backfill window
  for (const cube of cubesWithSpace) {
    // Try aggressive reorganization first (if cube has games)
    // This improves packing by reorganizing existing games to fit the new one
    if (cube.games.length > 0) {
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

    // Try normal placement (for empty cubes or if reorganization failed)
    for (const orientation of orientations) {
      if (tryPlaceGame(cube, game, orientation.x, orientation.y, orientation.label)) {
        placed.add(game.id);
        wasPlaced = true;
        break;
      }
    }
    if (wasPlaced) break;
  }

  // Only create new cube if no existing cube could fit the game
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
  backfillPercentage,
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

    // Calculate total area needed for the group
    const groupArea = getGroupTotalArea(group);

    // Get cubes to check based on backfill percentage (maintains order - earliest first)
    const cubesToCheck = selectCubesToCheck(
      cubes,
      optimizeSpace,
      backfillPercentage,
      calculateOccupiedAreaForCube,
    );

    // Filter cubes that have enough area for this group
    const cubesWithSpace = cubesToCheck.filter(cube => {
      const cubeOccupiedArea = cube.occupiedArea !== undefined 
        ? cube.occupiedArea 
        : calculateOccupiedAreaForCube(cube);
      return cubeOccupiedArea + groupArea <= CUBE_AREA;
    });

    // Try each cube starting with the earliest one in the backfill window
    for (const cube of cubesWithSpace) {
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

