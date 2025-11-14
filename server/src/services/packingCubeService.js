import { roundToGrid } from './packingPositionService.js';
import { getSafeGameArea } from '../utils/packingHelpers.js';

const DISPLAY_KALLAX_WIDTH = 13;
const DISPLAY_KALLAX_HEIGHT = 13;
const OVERSIZED_THRESHOLD = 13;
const CUBE_DISPLAY_AREA = DISPLAY_KALLAX_WIDTH * DISPLAY_KALLAX_HEIGHT;

const computeCubeAreaUsed = (cube) =>
  (cube.games || []).reduce((sum, game) => sum + getSafeGameArea(game), 0);

export const calculateStatsSummary = (cubes) => {
  const safeTotals = {
    totalGames: 0,
    totalCubes: 0,
    avgGamesPerCube: 0,
    totalUtilization: 0,
  };

  if (!Array.isArray(cubes) || cubes.length === 0) {
    return safeTotals;
  }

  const totalGames = cubes.reduce(
    (sum, cube) => sum + (Array.isArray(cube.games) ? cube.games.length : 0),
    0,
  );
  const avgGamesPerCube = totalGames / cubes.length || 0;

  const totalAreaUsed = cubes.reduce((sum, cube) => sum + computeCubeAreaUsed(cube), 0);
  const totalAreaCapacity = CUBE_DISPLAY_AREA * cubes.length;

  const totalUtilization =
    totalAreaCapacity > 0
      ? Number(((totalAreaUsed / totalAreaCapacity) * 100).toFixed(1))
      : 0;

  return {
    totalGames,
    totalCubes: cubes.length,
    avgGamesPerCube: Number(avgGamesPerCube.toFixed(1)),
    totalUtilization: Number(totalUtilization),
  };
};

export const finalizeCube = (cube, cubeIndex) => {
  cube.id = cubeIndex + 1;

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
    }

    const maxHeight = Math.max(...rowGames.map((g) => g.packedDims.y));
    const totalWidth = rowGames.reduce((sum, g) => sum + g.packedDims.x, 0);

    cube.rows.push({
      games: rowGames,
      heightUsed: maxHeight,
      widthUsed: totalWidth,
    });
  }
};

export const createOversizedExcludedGame = (game) => {
  return {
    id: game.id,
    gameName: game.gameName || null,
    versionName: game.versionName || null,
    displayName: game.displayName || null,
    status: 'excluded',
    correctionUrl: game.correctionUrl || null,
    versionsUrl: game.versionsUrl || null,
    baseGameId: game.baseGameId || game.gameId || null,
    dimensions: {
      length: game.dimensions.length,
      width: game.dimensions.width,
      depth: game.dimensions.depth,
    },
  };
};

export const getOversizedStuffedGames = (cubes) => {
  const oversizedStuffedGames = [];
  const stuffedSeen = new Set();
  for (const cube of cubes) {
    for (const game of cube.games) {
      if ((game.oversizedX || game.oversizedY) && !stuffedSeen.has(game.id)) {
        oversizedStuffedGames.push({
          id: game.id,
          gameName: game.gameName || null,
          versionName: game.versionName || null,
          displayName: game.displayName || null,
          status: 'stuffed',
          cubeId: cube.id,
          correctionUrl: game.correctionUrl || null,
          versionsUrl: game.versionsUrl || null,
        });
        stuffedSeen.add(game.id);
      }
    }
  }
  return oversizedStuffedGames;
};

export const PACKING_DISPLAY_CONSTANTS = {
  DISPLAY_KALLAX_WIDTH,
  DISPLAY_KALLAX_HEIGHT,
  OVERSIZED_THRESHOLD,
};

