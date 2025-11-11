import { findPosition, PACKING_CONSTANTS } from './packingPositionService.js';
import { checkAndImproveStability } from './packingStabilityService.js';
import { compareGames, sortGamesByArea } from './packingSortService.js';

const { CUBE_SIZE, GRID_PRECISION } = PACKING_CONSTANTS;
const OVERSIZED_THRESHOLD = 13;

const calculateOccupiedArea = (cube) => {
  let area = 0;
  for (const game of cube.games) {
    area += game.packedDims.x * game.packedDims.y;
  }
  return area;
};

export const tryPlaceGame = (cube, game, width, height, orientationLabel = null) => {
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

export const tryAggressiveReorganization = (
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

export const calculateOccupiedAreaForCube = calculateOccupiedArea;

