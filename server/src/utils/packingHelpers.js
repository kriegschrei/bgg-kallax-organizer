import { PACKING_CONSTANTS } from '../services/packingPositionService.js';

const { CUBE_AREA } = PACKING_CONSTANTS;

/**
 * Multiplier used for calculating maximum group area (95% of cube area).
 */
export const MAX_GROUP_AREA_MULTIPLIER = 0.95;

/**
 * Maximum area allowed for a group (95% of cube area).
 */
export const MAX_GROUP_AREA = CUBE_AREA * MAX_GROUP_AREA_MULTIPLIER;

/**
 * Gets the safe area value from a game object.
 * Returns the game's area if it's a valid positive number, otherwise calculates from dims2D.
 * @param {Object} game - The game object
 * @returns {number} The game area or 0 if invalid
 */
export const getSafeGameArea = (game) => {
  // First try to use pre-calculated area
  if (Number.isFinite(game.area) && game.area > 0) {
    return game.area;
  }
  
  // Fallback: calculate from dims2D if available
  if (game.dims2D?.horizontal && game.dims2D?.vertical) {
    // Use the larger of the two orientations (primary orientation area)
    const horizontalArea = game.dims2D.horizontal.x * game.dims2D.horizontal.y;
    const verticalArea = game.dims2D.vertical.x * game.dims2D.vertical.y;
    const calculatedArea = Math.max(horizontalArea, verticalArea);
    
    if (Number.isFinite(calculatedArea) && calculatedArea > 0) {
      return calculatedArea;
    }
  }
  
  return 0;
};

/**
 * Gets the maximum depth dimension from a game's dimensions.
 * Sorts length, width, and depth (or just length and width if depth not needed) and returns the largest value.
 * @param {Object} dimensions - The dimensions object with length, width, and optionally depth
 * @param {boolean} includeDepth - Whether to include depth in the calculation (default: true)
 * @returns {number} The maximum depth dimension
 */
export const getMaxDepthDimension = (dimensions, includeDepth = true) => {
  if (!dimensions) {
    return 0;
  }

  const dims = includeDepth
    ? [dimensions.length, dimensions.width, dimensions.depth]
    : [dimensions.length, dimensions.width];

  const sorted = dims.filter(d => Number.isFinite(d) && d > 0).sort((a, b) => b - a);
  return sorted.length > 0 ? sorted[0] : 0;
};

/**
 * Selects which cubes to check when placing a game or group.
 * Returns cubes in order (earliest first) within the backfill window.
 * When optimizeSpace is true, backfillPercentage is treated as 100%.
 * @param {Array} cubes - Array of cube objects
 * @param {boolean} optimizeSpace - Whether to optimize for space (forces 100% backfill)
 * @param {number} backfillPercentage - Percentage of cubes to check back from the end (0-100)
 * @param {Function} calculateOccupiedAreaForCube - Function to calculate occupied area for a cube (fallback if cube.occupiedArea not set)
 * @returns {Array} Array of cubes to check, in order (earliest first)
 */
export const selectCubesToCheck = (
  cubes,
  optimizeSpace,
  backfillPercentage,
  calculateOccupiedAreaForCube,
) => {
  if (cubes.length === 0) {
    return [];
  }

  // When optimizing space, always check all cubes (100% backfill)
  // This ensures optimal bin packing by checking all existing cubes before creating new ones
  const effectiveBackfillPercentage = optimizeSpace ? 100 : backfillPercentage;

  // Calculate how many cubes to check based on percentage
  // Ensure at least 1 cube is checked when percentage > 0
  const numCubesToCheck = effectiveBackfillPercentage === 0
    ? 1
    : Math.max(1, Math.ceil(cubes.length * (effectiveBackfillPercentage / 100)));

  // Get the last N cubes, maintaining their original order (earliest first)
  // This ensures we check cubes sequentially: cube 1, then cube 2, then cube 3...
  // which allows area-based sorting to work optimally for bin packing
  const startIndex = Math.max(0, cubes.length - numCubesToCheck);
  return cubes.slice(startIndex);
};

