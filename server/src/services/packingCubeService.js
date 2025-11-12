import { PACKING_CONSTANTS, roundToGrid } from './packingPositionService.js';
import { extractBaseGameId, extractVersionId, buildVersionsUrl, buildCorrectionUrl, buildGameCorrectionUrl } from '../utils/gameUtils.js';

const { CUBE_SIZE } = PACKING_CONSTANTS;
const DISPLAY_KALLAX_WIDTH = 13;
const DISPLAY_KALLAX_HEIGHT = 13;
const OVERSIZED_THRESHOLD = 13;
const CUBE_DISPLAY_AREA = DISPLAY_KALLAX_WIDTH * DISPLAY_KALLAX_HEIGHT;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const computeGameArea = (game) => {
  if (Number.isFinite(game.area) && game.area > 0) {
    return game.area;
  }

  const length =
    Number.isFinite(game.dimensions?.length) && game.dimensions.length > 0
      ? game.dimensions.length
      : null;
  const width =
    Number.isFinite(game.dimensions?.width) && game.dimensions.width > 0
      ? game.dimensions.width
      : null;

  if (length && width) {
    return length * width;
  }

  const packedWidth =
    Number.isFinite(game.packedDims?.x) && game.packedDims.x > 0
      ? game.packedDims.x
      : null;
  const packedHeight =
    Number.isFinite(game.packedDims?.y) && game.packedDims.y > 0
      ? game.packedDims.y
      : null;

  if (packedWidth && packedHeight) {
    return packedWidth * packedHeight;
  }

  return 0;
};

const computeCubeAreaUsed = (cube) =>
  (cube.games || []).reduce((sum, game) => sum + computeGameArea(game), 0);

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

  const areaUsedPerCube = cubes.map((cube) => computeCubeAreaUsed(cube));
  const totalAreaUsed = areaUsedPerCube.reduce((sum, value) => sum + value, 0);
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
};

export const createOversizedExcludedGame = (game) => {
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

  return {
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
  };
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

export const PACKING_DISPLAY_CONSTANTS = {
  DISPLAY_KALLAX_WIDTH,
  DISPLAY_KALLAX_HEIGHT,
  OVERSIZED_THRESHOLD,
};

