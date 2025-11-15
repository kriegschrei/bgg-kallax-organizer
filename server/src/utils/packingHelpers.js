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
 * Returns the game's area if it's a valid positive number, otherwise returns 0.
 * @param {Object} game - The game object
 * @returns {number} The game area or 0 if invalid
 */
export const getSafeGameArea = (game) => {
  return Number.isFinite(game.area) && game.area > 0 ? game.area : 0;
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
 * Returns an array of cubes sorted/selected based on optimization and sort order preferences.
 * @param {Array} cubes - Array of cube objects
 * @param {boolean} optimizeSpace - Whether to optimize for space (sorts by occupied area descending)
 * @param {boolean} respectSortOrder - Whether to respect sort order (only checks last cube)
 * @param {Function} calculateOccupiedAreaForCube - Function to calculate occupied area for a cube (fallback if cube.occupiedArea not set)
 * @returns {Array} Array of cubes to check
 */
export const selectCubesToCheck = (
  cubes,
  optimizeSpace,
  respectSortOrder,
  calculateOccupiedAreaForCube,
) => {
  if (optimizeSpace) {
    return [...cubes].sort((a, b) => {
      const occupiedA = a.occupiedArea !== undefined ? a.occupiedArea : calculateOccupiedAreaForCube(a);
      const occupiedB = b.occupiedArea !== undefined ? b.occupiedArea : calculateOccupiedAreaForCube(b);
      return occupiedB - occupiedA;
    });
  }

  if (respectSortOrder) {
    return cubes.length > 0 ? [cubes[cubes.length - 1]] : [];
  }

  if (cubes.length === 0) {
    return [];
  }

  const cubesToCheck = [cubes[cubes.length - 1]];
  if (cubes.length > 1) {
    cubesToCheck.unshift(cubes[cubes.length - 2]);
  }

  return cubesToCheck;
};

