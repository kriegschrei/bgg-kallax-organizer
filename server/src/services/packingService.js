import {
  buildVersionsUrl,
  buildCorrectionUrl,
  buildGameCorrectionUrl,
  extractBaseGameId,
  extractVersionId,
} from '../utils/gameUtils.js';
import { createGameGroups } from './groupingService.js';

const GRID_PRECISION = 0.1;
const CUBE_SIZE = 12.8;
const OVERSIZED_THRESHOLD = 13;
const DISPLAY_KALLAX_WIDTH = 13;
const DISPLAY_KALLAX_HEIGHT = 13;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const calculateStatsSummary = (cubes, stacking) => {
  const isVertical = stacking === 'vertical';
  const safeTotals = {
    totalGames: 0,
    totalCubes: 0,
    avgGamesPerCube: '0.0',
    avgUtilization: '0.0',
  };

  if (!Array.isArray(cubes) || cubes.length === 0) {
    return safeTotals;
  }

  const totalGames = cubes.reduce(
    (sum, cube) => sum + (Array.isArray(cube.games) ? cube.games.length : 0),
    0,
  );
  const avgGamesPerCube = totalGames / cubes.length || 0;

  const utilizations = cubes.map((cube) => {
    const numerator = isVertical ? cube.currentHeight ?? 0 : cube.currentWidth ?? 0;
    const denominator = isVertical ? DISPLAY_KALLAX_HEIGHT : DISPLAY_KALLAX_WIDTH;

    if (!denominator) {
      return 0;
    }

    return clamp((numerator / denominator) * 100, 0, 100);
  });

  const avgUtilization =
    utilizations.length > 0
      ? utilizations.reduce((sum, value) => sum + value, 0) / utilizations.length
      : 0;

  return {
    totalGames,
    totalCubes: cubes.length,
    avgGamesPerCube: avgGamesPerCube.toFixed(1),
    avgUtilization: avgUtilization.toFixed(1),
  };
};

const normalizeSortValue = (value) => {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === 'string') {
    return value.toLowerCase();
  }
  return value;
};

const getGameSortValue = (game, field) => {
  switch (field) {
    case 'gameName':
      return normalizeSortValue(game.name);
    case 'versionName':
      return normalizeSortValue(game.versionName);
    case 'gameId': {
      const id = extractBaseGameId(game);
      return id ? Number.parseInt(id, 10) : Number.MAX_SAFE_INTEGER;
    }
    case 'versionId': {
      const versionId = extractVersionId(game, game.selectedVersionId);
      if (!versionId || versionId === 'default') {
        return Number.MAX_SAFE_INTEGER;
      }
      const parsed = Number.parseInt(versionId, 10);
      return Number.isNaN(parsed) ? versionId : parsed;
    }
    case 'categories':
      return normalizeSortValue(game.categories?.[0] || '');
    case 'families':
      return normalizeSortValue(game.families?.[0] || '');
    case 'mechanics':
      return normalizeSortValue(game.mechanics?.[0] || '');
    default:
      return game[field] ?? null;
  }
};

const compareGames = (game1, game2, sortRules) => {
  for (const rule of sortRules) {
    if (!rule || !rule.field) {
      continue;
    }

    const order = rule.order === 'desc' ? -1 : 1;
    const val1 = getGameSortValue(game1, rule.field);
    const val2 = getGameSortValue(game2, rule.field);

    if (val1 === val2) {
      continue;
    }

    if (val1 === null) {
      return 1 * order;
    }
    if (val2 === null) {
      return -1 * order;
    }

    if (val1 < val2) {
      return -1 * order;
    }
    if (val1 > val2) {
      return 1 * order;
    }
  }

  return 0;
};

const calculate2DDimensions = (dims3D, primaryOrder) => {
  const sorted = [dims3D.length, dims3D.width, dims3D.depth].sort((a, b) => b - a);

  const dim1 = sorted[1];
  const dim2 = sorted[2];

  if (primaryOrder === 'vertical') {
    return {
      x: Math.min(dim1, dim2),
      y: Math.max(dim1, dim2),
    };
  }

  return {
    x: Math.max(dim1, dim2),
    y: Math.min(dim1, dim2),
  };
};

const roundToGrid = (value) => Math.round(value / GRID_PRECISION) * GRID_PRECISION;

const hasCollision = (x, y, width, height, games) => {
  const epsilon = GRID_PRECISION * 0.5;

  for (const game of games) {
    const gx = game.position.x;
    const gy = game.position.y;
    const gw = game.packedDims.x;
    const gh = game.packedDims.y;

    if (
      !(
        x >= gx + gw - epsilon ||
        x + width <= gx + epsilon ||
        y >= gy + gh - epsilon ||
        y + height <= gy + epsilon
      )
    ) {
      return true;
    }
  }
  return false;
};

const hasFullSupport = (x, y, width, games) => {
  if (y < GRID_PRECISION) return true;

  const epsilon = GRID_PRECISION * 0.5;
  const targetY = y;

  for (let testX = x; testX < x + width - epsilon; testX += GRID_PRECISION) {
    let supported = false;

    for (const game of games) {
      const gx = game.position.x;
      const gy = game.position.y;
      const gw = game.packedDims.x;
      const gh = game.packedDims.y;
      const topY = gy + gh;

      if (
        testX >= gx - epsilon &&
        testX < gx + gw - epsilon &&
        Math.abs(targetY - topY) < epsilon
      ) {
        supported = true;
        break;
      }
    }

    if (!supported) return false;
  }

  return true;
};

const findPosition = (cube, width, height) => {
  const maxX = CUBE_SIZE - width + GRID_PRECISION * 0.5;
  const maxY = CUBE_SIZE - height + GRID_PRECISION * 0.5;

  for (let y = 0; y <= maxY; y = roundToGrid(y + GRID_PRECISION)) {
    for (let x = 0; x <= maxX; x = roundToGrid(x + GRID_PRECISION)) {
      if (hasCollision(x, y, width, height, cube.games)) {
        continue;
      }

      if (y >= GRID_PRECISION && !hasFullSupport(x, y, width, cube.games)) {
        continue;
      }

      return { x: roundToGrid(x), y: roundToGrid(y) };
    }
  }

  return null;
};

const calculateOccupiedArea = (cube) => {
  let area = 0;
  for (const game of cube.games) {
    area += game.packedDims.x * game.packedDims.y;
  }
  return area;
};

const findSupportingGames = (x, y, width, games) => {
  if (y < GRID_PRECISION) return [];

  const epsilon = GRID_PRECISION * 0.5;
  const supporters = [];

  for (const game of games) {
    const gx = game.position.x;
    const gy = game.position.y;
    const gw = game.packedDims.x;
    const gh = game.packedDims.y;
    const topY = gy + gh;

    if (Math.abs(y - topY) < epsilon) {
      if (!(x >= gx + gw - epsilon || x + width <= gx + epsilon)) {
        supporters.push(game);
      }
    }
  }

  return supporters;
};

const trySwapForStability = (cube, game1, game2) => {
  if (Math.abs(game1.packedDims.x - game2.packedDims.x) < GRID_PRECISION) {
    return false;
  }

  const [lowerGame, upperGame] =
    game1.packedDims.x > game2.packedDims.x ? [game1, game2] : [game2, game1];

  const originalLowerPos = { ...lowerGame.position };
  const originalUpperPos = { ...upperGame.position };

  const lowerTargetY = Math.min(originalLowerPos.y, originalUpperPos.y);
  const upperTargetY = Math.max(originalLowerPos.y, originalUpperPos.y);

  const index1 = cube.games.indexOf(game1);
  const index2 = cube.games.indexOf(game2);
  cube.games.splice(Math.max(index1, index2), 1);
  cube.games.splice(Math.min(index1, index2), 1);

  let lowerNewPos = null;

  for (const tryX of [originalLowerPos.x, originalUpperPos.x]) {
    if (
      !hasCollision(
        tryX,
        lowerTargetY,
        lowerGame.packedDims.x,
        lowerGame.packedDims.y,
        cube.games,
      )
    ) {
      if (
        lowerTargetY < GRID_PRECISION ||
        hasFullSupport(tryX, lowerTargetY, lowerGame.packedDims.x, cube.games)
      ) {
        lowerNewPos = { x: tryX, y: lowerTargetY };
        break;
      }
    }
  }

  if (!lowerNewPos) {
    const maxX = CUBE_SIZE - lowerGame.packedDims.x + GRID_PRECISION * 0.5;
    for (let testX = 0; testX <= maxX; testX = roundToGrid(testX + GRID_PRECISION)) {
      if (
        !hasCollision(
          testX,
          lowerTargetY,
          lowerGame.packedDims.x,
          lowerGame.packedDims.y,
          cube.games,
        )
      ) {
        if (
          lowerTargetY < GRID_PRECISION ||
          hasFullSupport(testX, lowerTargetY, lowerGame.packedDims.x, cube.games)
        ) {
          lowerNewPos = { x: testX, y: lowerTargetY };
          break;
        }
      }
    }
  }

  if (!lowerNewPos) {
    cube.games.splice(Math.min(index1, index2), 0, index1 < index2 ? game1 : game2);
    cube.games.splice(Math.max(index1, index2), 0, index1 < index2 ? game2 : game1);
    return false;
  }

  lowerGame.position = lowerNewPos;
  const tempCubeWithLower = [lowerGame, ...cube.games];

  let upperNewPos = null;

  for (const tryX of [originalUpperPos.x, originalLowerPos.x]) {
    if (
      !hasCollision(
        tryX,
        upperTargetY,
        upperGame.packedDims.x,
        upperGame.packedDims.y,
        tempCubeWithLower,
      )
    ) {
      if (
        upperTargetY < GRID_PRECISION ||
        hasFullSupport(tryX, upperTargetY, upperGame.packedDims.x, tempCubeWithLower)
      ) {
        upperNewPos = { x: tryX, y: upperTargetY };
        break;
      }
    }
  }

  if (!upperNewPos) {
    const maxX = CUBE_SIZE - upperGame.packedDims.x + GRID_PRECISION * 0.5;
    for (let testX = 0; testX <= maxX; testX = roundToGrid(testX + GRID_PRECISION)) {
      if (
        !hasCollision(
          testX,
          upperTargetY,
          upperGame.packedDims.x,
          upperGame.packedDims.y,
          tempCubeWithLower,
        )
      ) {
        if (
          upperTargetY < GRID_PRECISION ||
          hasFullSupport(testX, upperTargetY, upperGame.packedDims.x, tempCubeWithLower)
        ) {
          upperNewPos = { x: testX, y: upperTargetY };
          break;
        }
      }
    }
  }

  if (!upperNewPos) {
    cube.games.splice(Math.min(index1, index2), 0, index1 < index2 ? game1 : game2);
    cube.games.splice(Math.max(index1, index2), 0, index1 < index2 ? game2 : game1);
    lowerGame.position = originalLowerPos;
    upperGame.position = originalUpperPos;
    return false;
  }

  upperGame.position = upperNewPos;
  cube.games.push(lowerGame);
  cube.games.push(upperGame);
  return true;
};

const checkAndImproveStability = (cube, placedGame) => {
  if (placedGame.position.y < GRID_PRECISION) return;

  const supporters = findSupportingGames(
    placedGame.position.x,
    placedGame.position.y,
    placedGame.packedDims.x,
    cube.games.filter((g) => g !== placedGame),
  );

  if (supporters.length === 0) return;

  for (const supporter of supporters) {
    if (placedGame.packedDims.x > supporter.packedDims.x + GRID_PRECISION) {
      if (trySwapForStability(cube, placedGame, supporter)) {
        checkAndImproveStability(cube, placedGame);
        break;
      }
    }
  }
};

const tryAggressiveReorganization = (
  cube,
  newGame,
  width,
  height,
  sortRules,
  optimizeSpace,
  orientationLabel = null,
) => {
  const gameArea = width * height;
  const cubeArea = CUBE_SIZE * CUBE_SIZE;
  const occupiedArea = calculateOccupiedArea(cube);

  if (occupiedArea + gameArea > cubeArea) {
    return false;
  }

  const originalGames = cube.games.map((g) => ({
    game: g,
    position: { ...g.position },
    packedDims: { ...g.packedDims },
    actualDims: { ...g.actualDims },
  }));

  const allGames = [
    ...cube.games.map((g) => ({
      ...g,
      isOriginal: true,
      manualOrientation: g.forcedOrientation || g.appliedOrientation || null,
    })),
    {
      ...newGame,
      packedDims: { x: width, y: height },
      isNew: true,
      manualOrientation: orientationLabel,
    },
  ];

  if (optimizeSpace) {
    allGames.sort((a, b) => {
      const aArea =
        (a.packedDims?.x || a.dims2D?.x || width) *
        (a.packedDims?.y || a.dims2D?.y || height);
      const bArea =
        (b.packedDims?.x || b.dims2D?.x || width) *
        (b.packedDims?.y || b.dims2D?.y || height);
      return bArea - aArea;
    });
  } else {
    allGames.sort((a, b) => compareGames(a, b, sortRules));
  }

  cube.games = [];

  let failedToPlace = null;
  for (const gameToPlace of allGames) {
    const gWidth = gameToPlace.packedDims?.x || gameToPlace.dims2D?.x || width;
    const gHeight = gameToPlace.packedDims?.y || gameToPlace.dims2D?.y || height;

    const position = findPosition(cube, gWidth, gHeight);

    if (position) {
      const sorted = [
        gameToPlace.dimensions.length,
        gameToPlace.dimensions.width,
        gameToPlace.dimensions.depth,
      ].sort((a, b) => b - a);
      const depthDimension = sorted[0];

      gameToPlace.position = position;
      gameToPlace.packedDims = { x: gWidth, y: gHeight, z: depthDimension };
      gameToPlace.actualDims = gameToPlace.actualDims || {
        x: gWidth,
        y: gHeight,
        z: depthDimension,
      };
      const orientationForGame =
        gameToPlace.manualOrientation ||
        (gWidth >= gHeight ? 'horizontal' : 'vertical');
      gameToPlace.appliedOrientation = orientationForGame;
      cube.games.push(gameToPlace);
    } else {
      failedToPlace = gameToPlace;
      break;
    }
  }

  if (!failedToPlace) {
    return true;
  }

  cube.games = [];
  for (const orig of originalGames) {
    orig.game.position = orig.position;
    orig.game.packedDims = orig.packedDims;
    orig.game.actualDims = orig.actualDims;
    cube.games.push(orig.game);
  }

  return false;
};

const tryPlaceGame = (cube, game, width, height, orientationLabel = null) => {
  const actualWidth = width;
  const actualHeight = height;
  const packedWidth = Math.min(width, CUBE_SIZE);
  const packedHeight = Math.min(height, CUBE_SIZE);

  const sorted = [
    game.dimensions.length,
    game.dimensions.width,
    game.dimensions.depth,
  ].sort((a, b) => b - a);
  const depthDimension = sorted[0];

  const gameArea = packedWidth * packedHeight;
  const cubeArea = CUBE_SIZE * CUBE_SIZE;
  const occupiedArea = calculateOccupiedArea(cube);

  if (occupiedArea + gameArea > cubeArea) {
    return false;
  }

  const position = findPosition(cube, packedWidth, packedHeight);

  if (position) {
    game.position = position;
    game.packedDims = { x: packedWidth, y: packedHeight, z: depthDimension };
    game.actualDims = { x: actualWidth, y: actualHeight, z: depthDimension };
    game.oversizedX = actualWidth > OVERSIZED_THRESHOLD;
    game.oversizedY = actualHeight > OVERSIZED_THRESHOLD;
    if (orientationLabel) {
      game.appliedOrientation = orientationLabel;
    } else if (!game.appliedOrientation) {
      game.appliedOrientation =
        packedWidth >= packedHeight ? 'horizontal' : 'vertical';
    }
    cube.games.push(game);

    checkAndImproveStability(cube, game);

    return true;
  }

  return false;
};

const splitOversizedGroup = (group, maxArea) => {
  const MAX_GROUP_AREA = maxArea || CUBE_SIZE * CUBE_SIZE * 0.95;

  const currentArea = group.reduce((total, game) => {
    if (game.dims2D) {
      return total + game.dims2D.x * game.dims2D.y;
    }
    return total;
  }, 0);

  if (currentArea <= MAX_GROUP_AREA) {
    return [group];
  }

  const sortedGames = [...group].sort((a, b) => {
    const areaA = (a.dims2D?.x || 0) * (a.dims2D?.y || 0);
    const areaB = (b.dims2D?.x || 0) * (b.dims2D?.y || 0);
    return areaB - areaA;
  });

  const baseGameIndex = sortedGames.findIndex((g) => !g.isExpansion);
  const baseGame = baseGameIndex >= 0 ? sortedGames[baseGameIndex] : sortedGames[0];

  const otherGames = sortedGames.filter(
    (g, i) => i !== (baseGameIndex >= 0 ? baseGameIndex : 0),
  );

  const subGroups = [[baseGame]];

  for (const game of otherGames) {
    const gameArea = (game.dims2D?.x || 0) * (game.dims2D?.y || 0);

    let added = false;
    for (let i = 0; i < subGroups.length; i += 1) {
      const groupArea = subGroups[i].reduce((total, g) => {
        if (g.dims2D) {
          return total + g.dims2D.x * g.dims2D.y;
        }
        return total;
      }, 0);

      if (groupArea + gameArea <= MAX_GROUP_AREA) {
        subGroups[i].push(game);
        added = true;
        break;
      }
    }

    if (!added) {
      subGroups.push([game]);
    }
  }

  return subGroups;
};

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
      const baseGameId = extractBaseGameId(game);
      const correctionVersionId = extractVersionId(game, game.selectedVersionId);
      let correctionUrl = game.correctionUrl || null;
      if (!correctionUrl && correctionVersionId) {
        correctionUrl = buildCorrectionUrl(correctionVersionId);
      }
      if (!correctionUrl && baseGameId) {
        correctionUrl = buildGameCorrectionUrl(baseGameId);
      }
      const versionsUrl =
        game.versionsUrl || buildVersionsUrl(baseGameId || game.id, game.name);

      oversizedExcludedGames.push({
        id: game.id,
        name: game.name,
        status: 'excluded',
        correctionUrl,
        versionsUrl,
        baseGameId: baseGameId || null,
        dimensions: {
          length: game.dimensions.length,
          width: game.dimensions.width,
          depth: game.dimensions.depth,
        },
      });
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

  if (validGames.length === 0) {
    return { cubes: [], oversizedExcludedGames };
  }

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

  const getGroupRepresentative = (group) => {
    const baseGame = group.find((g) => !g.isExpansion);
    return baseGame || group[0];
  };

  const getGroupTotalArea = (group) =>
    group.reduce((total, game) => {
      if (game.dims2D) {
        return total + game.dims2D.x * game.dims2D.y;
      }
      return total;
    }, 0);

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

  const cubes = [];
  const placed = new Set();

  const tryPlaceGroup = (cube, group) => {
    const tempCube = { games: [...cube.games], rows: [] };
    const groupPlaced = [];

    const sortedGroup = [...group].sort((a, b) => {
      const areaA = (a.dims2D?.x || 0) * (a.dims2D?.y || 0);
      const areaB = (b.dims2D?.x || 0) * (b.dims2D?.y || 0);
      return areaB - areaA;
    });

    for (const game of sortedGroup) {
      if (placed.has(game.id)) continue;

      const forcedOrientation =
        game.forcedOrientation === 'horizontal' || game.forcedOrientation === 'vertical'
          ? game.forcedOrientation
          : null;
      const orientations = [];
      if (forcedOrientation) {
        orientations.push({
          x: game.dims2D.x,
          y: game.dims2D.y,
          label: forcedOrientation,
        });
      } else {
        const primary = game.primaryOrientation || primaryOrder;
        orientations.push({ x: game.dims2D.x, y: game.dims2D.y, label: primary });
        if (!lockRotation && Math.abs(game.dims2D.x - game.dims2D.y) > 0.01) {
          const alternate = primary === 'vertical' ? 'horizontal' : 'vertical';
          orientations.push({
            x: game.dims2D.y,
            y: game.dims2D.x,
            label: alternate,
          });
        }
      }

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

  if (sortedGroups.length > 0) {
    for (const { groupId, group } of sortedGroups) {
      if (group.every((g) => placed.has(g.id))) {
        continue;
      }

      let groupPlaced = false;

      let cubesToCheck = [];
      if (optimizeSpace) {
        cubesToCheck = [...cubes].sort((a, b) => {
          const occupiedA = calculateOccupiedArea(a);
          const occupiedB = calculateOccupiedArea(b);
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
        if (tryPlaceGroup(cube, group)) {
          groupPlaced = true;
          break;
        }
      }

      if (!groupPlaced) {
        const newCube = { games: [], rows: [] };
        if (tryPlaceGroup(newCube, group)) {
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
  }

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

  if (unplacedGroupGames.length > 0) {
    unplacedGroupGames.sort((a, b) => compareGames(a, b, sortRules));
    console.log(`   Adding ${unplacedGroupGames.length} unplaced group games to pack individually`);
  }

  const placeStandalone = (game) => {
    if (placed.has(game.id)) return;

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

    let wasPlaced = false;

    let cubesToCheck = [];
    if (optimizeSpace) {
      cubesToCheck = [...cubes].sort((a, b) => {
        const occupiedA = calculateOccupiedArea(a);
        const occupiedB = calculateOccupiedArea(b);
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

  for (const game of standaloneGames) {
    placeStandalone(game);
  }

  for (const game of unplacedGroupGames) {
    placeStandalone(game);
  }

  for (let i = 0; i < cubes.length; i += 1) {
    const cube = cubes[i];
    cube.id = i + 1;

    for (const game of cube.games) {
      delete game._group;
      delete game._groupId;
    }

    const gamesByY = new Map();
    for (const game of cube.games) {
      const y = roundToGrid(game.position.y);
      if (!gamesByY.has(y)) {
        gamesByY.set(y, []);
      }
      gamesByY.get(y).push(game);
    }

    cube.rows = [];

    const yLevels = Array.from(gamesByY.keys()).sort((a, b) => a - b);
    for (const y of yLevels) {
      const rowGames = gamesByY.get(y);
      rowGames.sort((a, b) => a.position.x - b.position.x);

      for (const game of rowGames) {
        game.orientedDims = { ...game.packedDims };
        game.actualOrientedDims = { ...game.actualDims };
        delete game._group;
        delete game._groupId;
      }

      const maxHeight = Math.max(...rowGames.map((g) => g.packedDims.y));
      const totalWidth = rowGames.reduce((sum, g) => sum + g.packedDims.x, 0);

      cube.rows.push({
        games: rowGames,
        heightUsed: maxHeight,
        widthUsed: totalWidth,
      });
    }

    cube.currentHeight =
      cube.games.length > 0
        ? Math.max(...cube.games.map((g) => g.position.y + g.packedDims.y))
        : 0;
    cube.currentWidth = CUBE_SIZE;
  }

  return { cubes, oversizedExcludedGames };
};

export const getOversizedStuffedGames = (cubes) => {
  const oversizedStuffedGames = [];
  const stuffedSeen = new Set();
  for (const cube of cubes) {
    for (const game of cube.games) {
      if ((game.oversizedX || game.oversizedY) && !stuffedSeen.has(game.id)) {
        const versionId = extractVersionId(game, game.selectedVersionId);
        const baseGameId = extractBaseGameId(game);
        oversizedStuffedGames.push({
          id: game.id,
          name: game.name,
          status: 'stuffed',
          cubeId: cube.id,
          correctionUrl: versionId ? buildCorrectionUrl(versionId) : null,
          versionsUrl: game.versionsUrl || (baseGameId ? buildVersionsUrl(baseGameId, game.name) : null),
        });
        stuffedSeen.add(game.id);
      }
    }
  }
  return oversizedStuffedGames;
};

export const PACKING_CONSTANTS = {
  DISPLAY_KALLAX_WIDTH,
  DISPLAY_KALLAX_HEIGHT,
  OVERSIZED_THRESHOLD,
  GRID_PRECISION,
  CUBE_SIZE,
};

