import { PACKING_CONSTANTS, roundToGrid } from './packingPositionService.js';
import { extractBaseGameId, extractVersionId, buildVersionsUrl, buildCorrectionUrl, buildGameCorrectionUrl } from '../utils/gameUtils.js';

const { CUBE_SIZE } = PACKING_CONSTANTS;
const DISPLAY_KALLAX_WIDTH = 13;
const DISPLAY_KALLAX_HEIGHT = 13;
const OVERSIZED_THRESHOLD = 13;

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

  cube.currentHeight =
    cube.games.length > 0
      ? Math.max(...cube.games.map((g) => g.position.y + g.packedDims.y))
      : 0;
  cube.currentWidth = CUBE_SIZE;
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

