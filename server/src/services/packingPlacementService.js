import { findPosition, PACKING_CONSTANTS } from './packingPositionService.js';
import { checkAndImproveStability } from './packingStabilityService.js';
import { compareGames, sortGamesByArea } from './packingSortService.js';
import { PACKING_DISPLAY_CONSTANTS } from './packingCubeService.js';
import { getSafeGameArea } from '../utils/packingHelpers.js';

const { CUBE_SIZE, CUBE_AREA, GRID_PRECISION } = PACKING_CONSTANTS;
const { OVERSIZED_THRESHOLD } = PACKING_DISPLAY_CONSTANTS;

export const calculateOccupiedAreaForCube = (cube) => {
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

  const depthDimension = game.maxDepth || 0;

  const gameArea = packedWidth * packedHeight;
  const cubeArea = CUBE_AREA;

  if (cube.occupiedArea + gameArea > cubeArea) {
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
    
    // Update cached occupied area
    cube.occupiedArea += gameArea;

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
  orientationLabel = null,
) => {
  const gameArea = getSafeGameArea(newGame) || width * height;
  const cubeArea = CUBE_AREA;

  if (cube.occupiedArea + gameArea > cubeArea) {
    return false;
  }

  const originalGames = cube.games.map((g) => ({
    game: g,
    position: { ...g.position },
    packedDims: { ...g.packedDims },
    actualDims: { ...g.actualDims },
  }));
  const originalOccupiedArea = cube.occupiedArea;

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

  allGames.sort((a, b) => compareGames(a, b, sortRules));

  cube.games = [];
  cube.occupiedArea = 0;

  let failedToPlace = null;
  for (const gameToPlace of allGames) {
    const gWidth = gameToPlace.packedDims?.x || gameToPlace.dims2D?.x || width;
    const gHeight = gameToPlace.packedDims?.y || gameToPlace.dims2D?.y || height;

    const position = findPosition(cube, gWidth, gHeight);

    if (position) {
      const depthDimension = gameToPlace.maxDepth || 0;

      gameToPlace.position = position;
      gameToPlace.packedDims = { x: gWidth, y: gHeight, z: depthDimension };
      gameToPlace.actualDims = gameToPlace.actualDims || {
        x: gWidth,
        y: gHeight,
      };
      const orientationForGame =
        gameToPlace.manualOrientation ||
        (gWidth >= gHeight ? 'horizontal' : 'vertical');
      gameToPlace.appliedOrientation = orientationForGame;
      cube.games.push(gameToPlace);
      
      // Update cached occupied area
      cube.occupiedArea += gWidth * gHeight;
    } else {
      failedToPlace = gameToPlace;
      break;
    }
  }

  if (!failedToPlace) {
    return true;
  }

  // Restore original state
  cube.games = [];
  cube.occupiedArea = originalOccupiedArea;
  for (const orig of originalGames) {
    orig.game.position = orig.position;
    orig.game.packedDims = orig.packedDims;
    orig.game.actualDims = orig.actualDims;
    cube.games.push(orig.game);
  }

  return false;
};

