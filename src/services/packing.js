// Kallax cube dimensions in inches
const KALLAX_WIDTH = 13;
const KALLAX_HEIGHT = 13;
const KALLAX_DEPTH = 15;

/**
 * Calculate the oriented dimensions based on stacking preference
 * @param {Object} dimensions - Original dimensions {length, width, depth}
 * @param {boolean} verticalStacking - True for vertical, false for horizontal
 * @returns {Object} - {x, y, z} where z is along depth, x is width axis, y is height axis
 */
export const calculateOrientedDimensions = (dimensions, verticalStacking) => {
  const { length, width, depth } = dimensions;
  
  // Sort dimensions to find longest, middle, shortest
  const sorted = [length, width, depth].sort((a, b) => b - a);
  const [longest, middle, shortest] = sorted;
  
  if (verticalStacking) {
    // Longest along depth, middle as height, shortest as width
    return {
      z: longest,  // depth dimension (can exceed 15")
      y: middle,   // height (should fit in 13")
      x: shortest, // width (should fit in 13")
    };
  } else {
    // Longest along depth, middle as width, shortest as height
    return {
      z: longest,  // depth dimension (can exceed 15")
      y: shortest, // height (should fit in 13")
      x: middle,   // width (should fit in 13")
    };
  }
};

/**
 * Compare two games based on sorting priorities
 * @param {Object} game1 
 * @param {Object} game2 
 * @param {Array} priorities - Array of {field, enabled} objects
 * @returns {number} - Comparison result
 */
const compareGames = (game1, game2, priorities) => {
  for (const priority of priorities) {
    if (!priority.enabled) continue;
    
    const field = priority.field;
    let val1, val2;
    
    switch (field) {
      case 'name':
        // Alphabetical comparison
        val1 = (game1[field] || '').toLowerCase();
        val2 = (game2[field] || '').toLowerCase();
        break;
      
      case 'categories':
      case 'families':
        // For categories/families, compare alphabetically by first item
        val1 = game1[field]?.[0] || '';
        val2 = game2[field]?.[0] || '';
        break;
      
      case 'bggRank':
        // Lower rank is better, nulls go last
        val1 = game1[field] ?? Infinity;
        val2 = game2[field] ?? Infinity;
        break;
      
      default:
        val1 = game1[field] ?? 0;
        val2 = game2[field] ?? 0;
    }
    
    if (val1 < val2) return -1;
    if (val1 > val2) return 1;
  }
  
  return 0;
};

/**
 * Check if a game fits in the current cube's remaining space
 * @param {Object} gameDims - {x, y, z} dimensions
 * @param {Object} cubeState - Current cube state
 * @param {boolean} verticalStacking
 * @returns {boolean}
 */
const fitsInCube = (gameDims, cubeState, verticalStacking) => {
  if (verticalStacking) {
    // Stacking vertically: check if height fits
    return (cubeState.currentHeight + gameDims.y <= KALLAX_HEIGHT) &&
           (gameDims.x <= KALLAX_WIDTH);
  } else {
    // Stacking horizontally: check if width fits
    return (cubeState.currentWidth + gameDims.x <= KALLAX_WIDTH) &&
           (gameDims.y <= KALLAX_HEIGHT);
  }
};

/**
 * Find the best game to fit in the current cube based on priorities
 * @param {Array} remainingGames - Games not yet packed
 * @param {Object} cubeState - Current cube state
 * @param {Array} priorities - Sorting priorities
 * @param {boolean} verticalStacking
 * @returns {number} - Index of best game, or -1 if none fit
 */
const findBestFit = (remainingGames, cubeState, priorities, verticalStacking) => {
  const candidates = [];
  
  // Find all games that fit
  for (let i = 0; i < remainingGames.length; i++) {
    const game = remainingGames[i];
    if (fitsInCube(game.orientedDims, cubeState, verticalStacking)) {
      candidates.push({ index: i, game });
    }
  }
  
  if (candidates.length === 0) return -1;
  
  // Sort candidates by priorities
  candidates.sort((a, b) => compareGames(a.game, b.game, priorities));
  
  return candidates[0].index;
};

/**
 * Pack games into Kallax cubes using bin-packing algorithm
 * @param {Array} games - Array of game objects with details
 * @param {Array} priorities - Sorting priorities
 * @param {boolean} verticalStacking - Stacking preference
 * @returns {Array} - Array of cubes with packed games
 */
export const packGamesIntoCubes = (games, priorities, verticalStacking) => {
  // Calculate oriented dimensions for all games
  const gamesWithDims = games.map(game => ({
    ...game,
    orientedDims: calculateOrientedDimensions(game.dimensions, verticalStacking),
  }));
  
  // Sort games initially by priorities (for tie-breaking)
  const sortedGames = [...gamesWithDims].sort((a, b) => 
    compareGames(a, b, priorities)
  );
  
  const cubes = [];
  const remainingGames = [...sortedGames];
  
  while (remainingGames.length > 0) {
    // Start a new cube
    const cube = {
      id: cubes.length + 1,
      games: [],
      currentHeight: 0,
      currentWidth: 0,
    };
    
    // Keep packing games into this cube
    while (true) {
      const bestIndex = findBestFit(remainingGames, cube, priorities, verticalStacking);
      
      if (bestIndex === -1) {
        // No more games fit in this cube
        break;
      }
      
      const game = remainingGames[bestIndex];
      cube.games.push(game);
      
      // Update cube state
      if (verticalStacking) {
        cube.currentHeight += game.orientedDims.y;
      } else {
        cube.currentWidth += game.orientedDims.x;
      }
      
      // Remove game from remaining
      remainingGames.splice(bestIndex, 1);
    }
    
    cubes.push(cube);
  }
  
  return cubes;
};

/**
 * Calculate utilization statistics for cubes
 * @param {Array} cubes - Packed cubes
 * @param {boolean} verticalStacking
 * @returns {Object} - Statistics
 */
export const calculateStats = (cubes, verticalStacking) => {
  const totalGames = cubes.reduce((sum, cube) => sum + cube.games.length, 0);
  const avgGamesPerCube = totalGames / cubes.length;
  
  const utilizations = cubes.map(cube => {
    if (verticalStacking) {
      return (cube.currentHeight / KALLAX_HEIGHT) * 100;
    } else {
      return (cube.currentWidth / KALLAX_WIDTH) * 100;
    }
  });
  
  const avgUtilization = utilizations.reduce((sum, u) => sum + u, 0) / cubes.length;
  
  return {
    totalGames,
    totalCubes: cubes.length,
    avgGamesPerCube: avgGamesPerCube.toFixed(1),
    avgUtilization: avgUtilization.toFixed(1),
  };
};

