const GRID_PRECISION = 0.1;
const CUBE_SIZE = 12.8;

export const roundToGrid = (value) => Math.round(value / GRID_PRECISION) * GRID_PRECISION;

export const calculate2DDimensions = (dims3D, primaryOrder) => {
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

export const hasCollision = (x, y, width, height, games) => {
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

export const hasFullSupport = (x, y, width, games) => {
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

export const findPosition = (cube, width, height) => {
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

export const PACKING_CONSTANTS = {
  GRID_PRECISION,
  CUBE_SIZE,
};

