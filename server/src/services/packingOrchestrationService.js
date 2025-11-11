import { calculate2DDimensions, PACKING_CONSTANTS } from './packingPositionService.js';
import { createOversizedExcludedGame, PACKING_DISPLAY_CONSTANTS } from './packingCubeService.js';
import { splitOversizedGroup, getGroupRepresentative, getGroupTotalArea } from './packingGroupService.js';
import { compareGames, sortGamesByArea } from './packingSortService.js';
import { tryPlaceGame, tryAggressiveReorganization, calculateOccupiedAreaForCube } from './packingPlacementService.js';
import { createGameGroups } from './groupingService.js';

const { CUBE_SIZE } = PACKING_CONSTANTS;
const { OVERSIZED_THRESHOLD } = PACKING_DISPLAY_CONSTANTS;

export const prepareGamesForPacking = (games, primaryOrder, fitOversized) => {
  const oversizedExcludedGames = [];

  for (const game of games) {
    if (
      !game.dimensions ||
      !game.dimensions.length ||
      !game.dimensions.width ||
      !game.dimensions.depth
    ) {
      console.error(`❌ Game "${game.name}" has invalid dimensions`);
      game.dims2D = null;
      continue;
    }
    const forcedOrientation =
      game.forcedOrientation === 'horizontal' || game.forcedOrientation === 'vertical'
        ? game.forcedOrientation
        : null;
    const orientationToUse = forcedOrientation || primaryOrder;
    game.dims2D = calculate2DDimensions(game.dimensions, orientationToUse);
    game.primaryOrientation = orientationToUse;
    game.exceedsMaxDimension =
      game.dims2D.x > OVERSIZED_THRESHOLD || game.dims2D.y > OVERSIZED_THRESHOLD;

    if (game.exceedsMaxDimension && !fitOversized) {
      oversizedExcludedGames.push(createOversizedExcludedGame(game));
    }
  }

  const validGames = games.filter((g) => {
    if (!g.dims2D || g.dims2D.x <= 0 || g.dims2D.y <= 0) {
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
  const MAX_GROUP_AREA = CUBE_SIZE * CUBE_SIZE * 0.95;

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
    standaloneGames.sort((a, b) => compareGames(a, b, sortRules));
  }

  return { sortedGroups, standaloneGames };
};

export const buildOrientations = (game, primaryOrder, lockRotation) => {
  const forcedOrientation =
    game.forcedOrientation === 'horizontal' || game.forcedOrientation === 'vertical'
      ? game.forcedOrientation
      : null;
  const orientations = [];
  if (forcedOrientation) {
    orientations.push({ x: game.dims2D.x, y: game.dims2D.y, label: forcedOrientation });
  } else {
    const primary = game.primaryOrientation || primaryOrder;
    orientations.push({ x: game.dims2D.x, y: game.dims2D.y, label: primary });
    if (!lockRotation && Math.abs(game.dims2D.x - game.dims2D.y) > 0.01) {
      const alternate = primary === 'vertical' ? 'horizontal' : 'vertical';
      orientations.push({ x: game.dims2D.y, y: game.dims2D.x, label: alternate });
    }
  }
  return orientations;
};

export const tryPlaceGroup = (cube, group, primaryOrder, lockRotation, placed) => {
  const tempCube = { games: [...cube.games], rows: [] };
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

  let cubesToCheck = [];
  if (optimizeSpace) {
    cubesToCheck = [...cubes].sort((a, b) => {
      const occupiedA = calculateOccupiedAreaForCube(a);
      const occupiedB = calculateOccupiedAreaForCube(b);
      return occupiedB - occupiedA;
    });
  } else if (respectSortOrder) {
    if (cubes.length > 0) {
      cubesToCheck = [cubes[cubes.length - 1]];
    }
  } else if (cubes.length > 0) {
    cubesToCheck = [cubes[cubes.length - 1]];
    if (cubes.length > 1) {
      cubesToCheck.unshift(cubes[cubes.length - 2]);
    }
  }

  for (const cube of cubesToCheck) {
    for (const orientation of orientations) {
      if (tryPlaceGame(cube, game, orientation.x, orientation.y, orientation.label)) {
        placed.add(game.id);
        wasPlaced = true;
        break;
      }
    }
    if (wasPlaced) break;

    if (!wasPlaced) {
      for (const orientation of orientations) {
        if (
          tryAggressiveReorganization(
            cube,
            game,
            orientation.x,
            orientation.y,
            sortRules,
            optimizeSpace,
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
  }

  if (!wasPlaced) {
    const newCube = { games: [], rows: [] };

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

    let cubesToCheck = [];
    if (optimizeSpace) {
      cubesToCheck = [...cubes].sort((a, b) => {
        const occupiedA = calculateOccupiedAreaForCube(a);
        const occupiedB = calculateOccupiedAreaForCube(b);
        return occupiedB - occupiedA;
      });
    } else if (respectSortOrder) {
      if (cubes.length > 0) {
        cubesToCheck = [cubes[cubes.length - 1]];
      }
    } else if (cubes.length > 0) {
      cubesToCheck = [cubes[cubes.length - 1]];
      if (cubes.length > 1) {
        cubesToCheck.unshift(cubes[cubes.length - 2]);
      }
    }

    for (const cube of cubesToCheck) {
      if (tryPlaceGroup(cube, group, primaryOrder, lockRotation, placed)) {
        groupPlaced = true;
        break;
      }
    }

    if (!groupPlaced) {
      const newCube = { games: [], rows: [] };
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

