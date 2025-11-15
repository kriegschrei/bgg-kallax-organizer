import { hasCollision, hasFullSupport, roundToGrid, PACKING_CONSTANTS } from './packingPositionService.js';

const { GRID_PRECISION, CUBE_SIZE } = PACKING_CONSTANTS;

export const findSupportingGames = (x, y, width, games) => {
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

export const checkAndImproveStability = (cube, placedGame) => {
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

