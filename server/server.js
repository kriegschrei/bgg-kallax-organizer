import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import { parseString } from 'xml2js';
import { promisify } from 'util';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const BGG_API_BASE = 'https://boardgamegeek.com/xmlapi2';
const BGG_TOKEN = process.env.BGG_API_TOKEN;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    tokenConfigured: !!BGG_TOKEN,
    message: BGG_TOKEN ? 'BGG token is configured' : 'BGG token is not configured. Please set BGG_API_TOKEN in .env file'
  });
});

// Helper to parse XML to JSON on server
const parseXmlString = promisify(parseString);

// Helper function to make BGG API requests with rate limiting and retry logic
async function bggApiRequest(url, config = {}, maxRetries = 5) {
  let retries = 0;
  const baseDelay = 5000; // 5 seconds as recommended by BGG API wiki
  
  while (retries < maxRetries) {
    try {
      const response = await axios.get(url, config);
      return response;
    } catch (error) {
      // Check if it's a rate limit error (429)
      if (error.response?.status === 429) {
        retries++;
        
        // Check for Retry-After header
        const retryAfter = error.response?.headers['retry-after'];
        let waitTime = baseDelay;
        
        if (retryAfter) {
          // Retry-After can be in seconds (number) or HTTP date format
          const retryAfterNum = parseInt(retryAfter);
          if (!isNaN(retryAfterNum)) {
            waitTime = retryAfterNum * 1000; // Convert seconds to milliseconds
          } else {
            // Try parsing as HTTP date
            const retryDate = new Date(retryAfter);
            if (!isNaN(retryDate.getTime())) {
              waitTime = Math.max(retryDate.getTime() - Date.now(), 1000);
            }
          }
        } else {
          // Exponential backoff: 5s, 10s, 20s, 40s, 80s
          waitTime = baseDelay * Math.pow(2, retries - 1);
        }
        
        console.log(`   ⚠️  Rate limited (429). Waiting ${(waitTime / 1000).toFixed(1)}s before retry ${retries}/${maxRetries}...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      // For other errors, throw immediately
      throw error;
    }
  }
  
  throw new Error(`Rate limit exceeded after ${maxRetries} retries`);
}

// Kallax cube dimensions in inches
// Note: Using 12.8" for width/height calculations to allow clearance for maneuvering boxes
// Visual display still shows 13"x13" to represent the actual cube dimensions
const KALLAX_WIDTH = 12.8;
const KALLAX_HEIGHT = 12.8;
const KALLAX_DEPTH = 15;

// ============================================================================
// PACKING ALGORITHM - Complete Rewrite
// ============================================================================

const GRID_PRECISION = 0.1; // 0.1 inch precision
const CUBE_SIZE = 12.8; // Kallax cube is 12.8" x 12.8"
const OVERSIZED_THRESHOLD = 13;

// Compare games based on priorities for sorting
function compareGames(game1, game2, priorities) {
  for (const priority of priorities) {
    if (!priority.enabled) continue;
    
    const field = priority.field;
    const order = priority.order || 'asc';
    let val1, val2;
    
    switch (field) {
      case 'name':
        val1 = (game1[field] || '').toLowerCase();
        val2 = (game2[field] || '').toLowerCase();
        break;
      case 'categories':
      case 'families':
        val1 = game1[field]?.[0] || '';
        val2 = game2[field]?.[0] || '';
        break;
      case 'bggRank':
        val1 = game1[field] ?? Infinity;
        val2 = game2[field] ?? Infinity;
        break;
      default:
        val1 = game1[field] ?? 0;
        val2 = game2[field] ?? 0;
    }
    
    let comparison = 0;
    if (val1 < val2) comparison = -1;
    else if (val1 > val2) comparison = 1;
    
    if (order === 'desc') comparison = -comparison;
    
    if (comparison !== 0) return comparison;
  }
  
  return 0;
}

// Calculate 2D dimensions from 3D game dimensions
function calculate2DDimensions(dims3D, primaryOrder) {
  // Sort the three dimensions to find largest (depth/Z), and remaining two
  const sorted = [dims3D.length, dims3D.width, dims3D.depth].sort((a, b) => b - a);
  
  // Discard the largest dimension (it's the depth/Z that goes into the cube)
  // Keep the next two dimensions as our 2D footprint
  const dim1 = sorted[1]; // second largest
  const dim2 = sorted[2]; // smallest
  
  if (primaryOrder === 'vertical') {
    // Vertical: x is shorter, y is taller
    return {
      x: Math.min(dim1, dim2),  // shorter
      y: Math.max(dim1, dim2)   // taller
    };
  } else {
    // Horizontal: x is longer, y is shorter
    return {
      x: Math.max(dim1, dim2),  // longer
      y: Math.min(dim1, dim2)   // shorter
    };
  }
}

// Round to grid precision
function roundToGrid(value) {
  return Math.round(value / GRID_PRECISION) * GRID_PRECISION;
}

// Check if a rectangle collides with any existing games
function hasCollision(x, y, width, height, games) {
  const epsilon = GRID_PRECISION * 0.5;
  
  for (const game of games) {
    const gx = game.position.x;
    const gy = game.position.y;
    const gw = game.packedDims.x;
    const gh = game.packedDims.y;
    
    // Check for overlap (with small epsilon for floating point)
    if (!(x >= gx + gw - epsilon || 
          x + width <= gx + epsilon || 
          y >= gy + gh - epsilon || 
          y + height <= gy + epsilon)) {
      return true;
    }
  }
  return false;
}

// Check if a game has full support below it
function hasFullSupport(x, y, width, games) {
  if (y < GRID_PRECISION) return true; // On the ground
  
  const epsilon = GRID_PRECISION * 0.5;
  const targetY = y;
  
  // Check coverage along the bottom edge
  for (let testX = x; testX < x + width - epsilon; testX += GRID_PRECISION) {
    let supported = false;
    
    for (const game of games) {
      const gx = game.position.x;
      const gy = game.position.y;
      const gw = game.packedDims.x;
      const gh = game.packedDims.y;
      const topY = gy + gh;
      
      // Check if this game supports this point
      if (testX >= gx - epsilon && 
          testX < gx + gw - epsilon && 
          Math.abs(targetY - topY) < epsilon) {
        supported = true;
        break;
      }
    }
    
    if (!supported) return false;
  }
  
  return true;
}

// Find a valid position for a game in a cube
function findPosition(cube, width, height, requireSupport) {
  const maxX = CUBE_SIZE - width + GRID_PRECISION * 0.5;
  const maxY = CUBE_SIZE - height + GRID_PRECISION * 0.5;
  
  // Try positions from bottom-left, row by row
  for (let y = 0; y <= maxY; y = roundToGrid(y + GRID_PRECISION)) {
    for (let x = 0; x <= maxX; x = roundToGrid(x + GRID_PRECISION)) {
      // Check collision
      if (hasCollision(x, y, width, height, cube.games)) {
        continue;
      }
      
      // Check support if required
      if (requireSupport && y >= GRID_PRECISION) {
        if (!hasFullSupport(x, y, width, cube.games)) {
          continue;
        }
      }
      
      return { x: roundToGrid(x), y: roundToGrid(y) };
    }
  }
  
  return null;
}

// Calculate occupied area in a cube
function calculateOccupiedArea(cube) {
  let area = 0;
  for (const game of cube.games) {
    area += game.packedDims.x * game.packedDims.y;
  }
  return area;
}

// Find games that support a game at given position
function findSupportingGames(x, y, width, games) {
  if (y < GRID_PRECISION) return []; // On ground, no support needed
  
  const epsilon = GRID_PRECISION * 0.5;
  const supporters = [];
  
  for (const game of games) {
    const gx = game.position.x;
    const gy = game.position.y;
    const gw = game.packedDims.x;
    const gh = game.packedDims.y;
    const topY = gy + gh;
    
    // Check if this game's top edge touches the bottom of the placed game
    if (Math.abs(y - topY) < epsilon) {
      // Check if there's horizontal overlap
      if (!(x >= gx + gw - epsilon || x + width <= gx + epsilon)) {
        supporters.push(game);
      }
    }
  }
  
  return supporters;
}

// Check if swapping two games would improve stability
function trySwapForStability(cube, game1, game2, requireSupport) {
  // Don't swap if they're the same size
  if (Math.abs(game1.packedDims.x - game2.packedDims.x) < GRID_PRECISION) {
    return false;
  }
  
  // Determine which should be lower (wider game should be at bottom)
  const [lowerGame, upperGame] = game1.packedDims.x > game2.packedDims.x 
    ? [game1, game2] 
    : [game2, game1];
  
  // Save original states
  const originalLowerPos = { ...lowerGame.position };
  const originalUpperPos = { ...upperGame.position };
  
  // Determine target Y levels (swap their Y positions)
  const lowerTargetY = Math.min(originalLowerPos.y, originalUpperPos.y);
  const upperTargetY = Math.max(originalLowerPos.y, originalUpperPos.y);
  
  // Remove both games temporarily
  const index1 = cube.games.indexOf(game1);
  const index2 = cube.games.indexOf(game2);
  cube.games.splice(Math.max(index1, index2), 1);
  cube.games.splice(Math.min(index1, index2), 1);
  
  // Try to find a position for the wider game at the lower Y level
  let lowerNewPos = null;
  
  // First try the original X positions
  for (const tryX of [originalLowerPos.x, originalUpperPos.x]) {
    if (!hasCollision(tryX, lowerTargetY, lowerGame.packedDims.x, lowerGame.packedDims.y, cube.games)) {
      // Check support if needed
      if (!requireSupport || lowerTargetY < GRID_PRECISION || 
          hasFullSupport(tryX, lowerTargetY, lowerGame.packedDims.x, cube.games)) {
        lowerNewPos = { x: tryX, y: lowerTargetY };
        break;
      }
    }
  }
  
  // If original positions don't work, try scanning for a new position at this Y level
  if (!lowerNewPos) {
    const maxX = CUBE_SIZE - lowerGame.packedDims.x + GRID_PRECISION * 0.5;
    for (let testX = 0; testX <= maxX; testX = roundToGrid(testX + GRID_PRECISION)) {
      if (!hasCollision(testX, lowerTargetY, lowerGame.packedDims.x, lowerGame.packedDims.y, cube.games)) {
        if (!requireSupport || lowerTargetY < GRID_PRECISION || 
            hasFullSupport(testX, lowerTargetY, lowerGame.packedDims.x, cube.games)) {
          lowerNewPos = { x: testX, y: lowerTargetY };
          break;
        }
      }
    }
  }
  
  if (!lowerNewPos) {
    // Can't place lower game, restore and fail
    cube.games.splice(Math.min(index1, index2), 0, index1 < index2 ? game1 : game2);
    cube.games.splice(Math.max(index1, index2), 0, index1 < index2 ? game2 : game1);
    return false;
  }
  
  // Place the lower game temporarily
  lowerGame.position = lowerNewPos;
  const tempCubeWithLower = [lowerGame, ...cube.games];
  
  // Try to find a position for the narrower game at the upper Y level
  let upperNewPos = null;
  
  // First try the original X positions
  for (const tryX of [originalUpperPos.x, originalLowerPos.x]) {
    if (!hasCollision(tryX, upperTargetY, upperGame.packedDims.x, upperGame.packedDims.y, tempCubeWithLower)) {
      // Check support if needed
      if (!requireSupport || upperTargetY < GRID_PRECISION || 
          hasFullSupport(tryX, upperTargetY, upperGame.packedDims.x, tempCubeWithLower)) {
        upperNewPos = { x: tryX, y: upperTargetY };
        break;
      }
    }
  }
  
  // If original positions don't work, try scanning for a new position at this Y level
  if (!upperNewPos) {
    const maxX = CUBE_SIZE - upperGame.packedDims.x + GRID_PRECISION * 0.5;
    for (let testX = 0; testX <= maxX; testX = roundToGrid(testX + GRID_PRECISION)) {
      if (!hasCollision(testX, upperTargetY, upperGame.packedDims.x, upperGame.packedDims.y, tempCubeWithLower)) {
        if (!requireSupport || upperTargetY < GRID_PRECISION || 
            hasFullSupport(testX, upperTargetY, upperGame.packedDims.x, tempCubeWithLower)) {
          upperNewPos = { x: testX, y: upperTargetY };
          break;
        }
      }
    }
  }
  
  if (!upperNewPos) {
    // Can't place upper game, restore and fail
    cube.games.splice(Math.min(index1, index2), 0, index1 < index2 ? game1 : game2);
    cube.games.splice(Math.max(index1, index2), 0, index1 < index2 ? game2 : game1);
    lowerGame.position = originalLowerPos;
    upperGame.position = originalUpperPos;
    return false;
  }
  
  // Both positions found! Commit the swap
  upperGame.position = upperNewPos;
  cube.games.push(lowerGame);
  cube.games.push(upperGame);
  return true;
}

// Check stability after placing a game
function checkAndImproveStability(cube, placedGame, requireSupport) {
  // Only check if game is above ground
  if (placedGame.position.y < GRID_PRECISION) return;
  
  // Find all games supporting this game
  const supporters = findSupportingGames(
    placedGame.position.x, 
    placedGame.position.y, 
    placedGame.packedDims.x, 
    cube.games.filter(g => g !== placedGame)
  );
  
  if (supporters.length === 0) return;
  
  // Check if placed game is wider than any supporter
  for (const supporter of supporters) {
    if (placedGame.packedDims.x > supporter.packedDims.x + GRID_PRECISION) {
      // Try to swap them
      if (trySwapForStability(cube, placedGame, supporter, requireSupport)) {
        console.log(`   ♻️  Swapped "${placedGame.name}" with "${supporter.name}" for better stability`);
        // After successful swap, check again recursively
        checkAndImproveStability(cube, placedGame, requireSupport);
        break;
      }
    }
  }
}

// Aggressive reorganization: try to rearrange all games in cube to fit a new game
function tryAggressiveReorganization(cube, newGame, width, height, requireSupport, priorities, optimizeSpace) {
  console.log(`   🔄 Attempting aggressive reorganization for "${newGame.name}"`);
  
  // Check if there's theoretically enough space
  const gameArea = width * height;
  const cubeArea = CUBE_SIZE * CUBE_SIZE;
  const occupiedArea = calculateOccupiedArea(cube);
  
  if (occupiedArea + gameArea > cubeArea) {
    console.log(`      ❌ Not enough area (${(occupiedArea + gameArea).toFixed(1)} > ${cubeArea})`);
    return false;
  }
  
  // Save original state
  const originalGames = cube.games.map(g => ({
    game: g,
    position: { ...g.position },
    packedDims: { ...g.packedDims },
    actualDims: { ...g.actualDims },
  }));
  
  // Create a list of all games to pack (existing + new)
  const allGames = [...cube.games.map(g => ({
    ...g,
    isOriginal: true
  })), {
    ...newGame,
    packedDims: { x: width, y: height },
    isNew: true
  }];
  
  // Sort games by:
  // 1. If optimizeSpace: largest area first (for better packing)
  // 2. Otherwise: keep relative order from priorities, but put wider games first within same priority
  if (optimizeSpace) {
    allGames.sort((a, b) => {
      const aArea = (a.packedDims?.x || a.dims2D?.x || width) * (a.packedDims?.y || a.dims2D?.y || height);
      const bArea = (b.packedDims?.x || b.dims2D?.x || width) * (b.packedDims?.y || b.dims2D?.y || height);
      return bArea - aArea;
    });
  } else {
    // Keep relative order but prefer wider games for stability
    allGames.sort((a, b) => {
      const aWidth = a.packedDims?.x || a.dims2D?.x || 0;
      const bWidth = b.packedDims?.x || b.dims2D?.x || 0;
      // Wider games first for better stability
      if (Math.abs(aWidth - bWidth) > GRID_PRECISION) {
        return bWidth - aWidth;
      }
      // Keep original order otherwise
      return 0;
    });
  }
  
  // Clear the cube
  cube.games = [];
  
  // Try to place all games with support requirement
  let failedToPlace = null;
  for (const gameToPlace of allGames) {
    const gWidth = gameToPlace.packedDims?.x || gameToPlace.dims2D?.x || width;
    const gHeight = gameToPlace.packedDims?.y || gameToPlace.dims2D?.y || height;
    
    const position = findPosition(cube, gWidth, gHeight, requireSupport);
    
    if (position) {
      // Calculate z dimension
      const sorted = [gameToPlace.dimensions.length, gameToPlace.dimensions.width, gameToPlace.dimensions.depth].sort((a, b) => b - a);
      const depthDimension = sorted[0];
      
      gameToPlace.position = position;
      gameToPlace.packedDims = { x: gWidth, y: gHeight, z: depthDimension };
      gameToPlace.actualDims = gameToPlace.actualDims || { x: gWidth, y: gHeight, z: depthDimension };
      cube.games.push(gameToPlace);
    } else {
      failedToPlace = gameToPlace;
      break;
    }
  }
  
  // If we successfully placed all games (including the new one)
  if (!failedToPlace) {
    console.log(`      ✅ Reorganization successful! All ${allGames.length} games placed.`);
    return true;
  }
  
  // Reorganization failed - restore original state
  console.log(`      ❌ Reorganization failed, could not place "${failedToPlace.name}"`);
  cube.games = [];
  for (const orig of originalGames) {
    orig.game.position = orig.position;
    orig.game.packedDims = orig.packedDims;
    orig.game.actualDims = orig.actualDims;
    cube.games.push(orig.game);
  }
  
  return false;
}

// Try to place a game in a cube with given dimensions
function tryPlaceGame(cube, game, width, height, requireSupport) {
  const actualWidth = width;
  const actualHeight = height;
  const packedWidth = Math.min(width, CUBE_SIZE);
  const packedHeight = Math.min(height, CUBE_SIZE);
  
  // Calculate z dimension (the largest dimension that goes into the cube)
  const sorted = [game.dimensions.length, game.dimensions.width, game.dimensions.depth].sort((a, b) => b - a);
  const depthDimension = sorted[0]; // Largest dimension is the depth
  
  // Quick check: is there enough area?
  const gameArea = packedWidth * packedHeight;
  const cubeArea = CUBE_SIZE * CUBE_SIZE;
  const occupiedArea = calculateOccupiedArea(cube);
  
  if (occupiedArea + gameArea > cubeArea) {
    return false;
  }
  
  const position = findPosition(cube, packedWidth, packedHeight, requireSupport);
  
  if (position) {
    game.position = position;
    game.packedDims = { x: packedWidth, y: packedHeight, z: depthDimension };
    game.actualDims = { x: actualWidth, y: actualHeight, z: depthDimension };
    game.oversizedX = actualWidth > OVERSIZED_THRESHOLD;
    game.oversizedY = actualHeight > OVERSIZED_THRESHOLD;
    cube.games.push(game);
    
    // Check and improve stability after placement
    checkAndImproveStability(cube, game, requireSupport);
    
    return true;
  }
  
  return false;
}

// Main packing function
function packGamesIntoCubes(games, priorities, verticalStacking, allowAlternateRotation, optimizeSpace, respectSortOrder, ensureSupport) {
  console.log(`📦 Starting to pack ${games.length} games`);
  console.log(`   Options: vertical=${verticalStacking}, rotation=${allowAlternateRotation}, optimize=${optimizeSpace}, strict=${respectSortOrder}, ensureSupport=${ensureSupport}`);
  
  // Determine primary order
  const primaryOrder = verticalStacking ? 'vertical' : 'horizontal';
  // If ensureSupport is enabled, always require support. Otherwise, only for horizontal.
  const requireSupport = ensureSupport ? true : (primaryOrder === 'horizontal');
  
  // Step 1: Calculate 2D dimensions for all games
  for (const game of games) {
    if (!game.dimensions || !game.dimensions.length || !game.dimensions.width || !game.dimensions.depth) {
      console.error(`❌ Game "${game.name}" has invalid dimensions`);
      game.dims2D = null;
      continue;
    }
    game.dims2D = calculate2DDimensions(game.dimensions, primaryOrder);
  }
  
  // Filter valid games
  const validGames = games.filter(g => g.dims2D && g.dims2D.x > 0 && g.dims2D.y > 0);
  console.log(`   ✓ Valid games: ${validGames.length}/${games.length}`);
  
  if (validGames.length === 0) {
    return [];
  }
  
  // Step 2: Sort games
  if (optimizeSpace) {
    // Sort by area descending, then dimensions, then name
    validGames.sort((a, b) => {
      const areaA = a.dims2D.x * a.dims2D.y;
      const areaB = b.dims2D.x * b.dims2D.y;
      if (Math.abs(areaA - areaB) > 0.01) return areaB - areaA;
      
      const maxA = Math.max(a.dims2D.x, a.dims2D.y);
      const maxB = Math.max(b.dims2D.x, b.dims2D.y);
      if (Math.abs(maxA - maxB) > 0.01) return maxB - maxA;
      
      const minA = Math.min(a.dims2D.x, a.dims2D.y);
      const minB = Math.min(b.dims2D.x, b.dims2D.y);
      if (Math.abs(minA - minB) > 0.01) return minB - minA;
      
      return (a.name || '').localeCompare(b.name || '');
    });
    console.log('   Sorted by area (optimized)');
  } else {
    validGames.sort((a, b) => compareGames(a, b, priorities));
    console.log('   Sorted by priorities');
  }
  
  // Step 3: Pack games into cubes
  const cubes = [];
  const placed = new Set();
  
  for (const game of validGames) {
    if (placed.has(game.id)) continue;
    
    const orientations = [];
    
    // Primary orientation (respects user's stacking preference)
    orientations.push({ x: game.dims2D.x, y: game.dims2D.y });
    
    // Alternate orientation (if rotation allowed and dimensions different)
    // Always try as fallback, never prioritize over user's preference
    if (allowAlternateRotation && Math.abs(game.dims2D.x - game.dims2D.y) > 0.01) {
      orientations.push({ x: game.dims2D.y, y: game.dims2D.x });
    }
    
    let wasPlaced = false;
    
    // Determine which cubes to check
    let cubesToCheck = [];
    if (optimizeSpace) {
      // Check all cubes
      cubesToCheck = [...cubes];
    } else if (respectSortOrder) {
      // Only check last cube
      if (cubes.length > 0) {
        cubesToCheck = [cubes[cubes.length - 1]];
      }
    } else {
      // Check current and previous cube
      if (cubes.length > 0) {
        cubesToCheck = [cubes[cubes.length - 1]];
        if (cubes.length > 1) {
          cubesToCheck.unshift(cubes[cubes.length - 2]);
        }
      }
    }
    
    // Try to place in existing cubes
    for (const cube of cubesToCheck) {
      for (const orientation of orientations) {
        if (tryPlaceGame(cube, game, orientation.x, orientation.y, requireSupport)) {
          placed.add(game.id);
          wasPlaced = true;
          break;
        }
      }
      if (wasPlaced) break;
      
      // If normal placement failed and ensureSupport is enabled, try aggressive reorganization
      if (!wasPlaced && ensureSupport && requireSupport) {
        for (const orientation of orientations) {
          if (tryAggressiveReorganization(cube, game, orientation.x, orientation.y, requireSupport, priorities, optimizeSpace)) {
            placed.add(game.id);
            wasPlaced = true;
            break;
          }
        }
        if (wasPlaced) break;
      }
    }
    
    // Create new cube if not placed
    if (!wasPlaced) {
      const newCube = { games: [], rows: [] };
      
      for (const orientation of orientations) {
        if (tryPlaceGame(newCube, game, orientation.x, orientation.y, requireSupport)) {
          placed.add(game.id);
          cubes.push(newCube);
          console.log(`   Created cube ${cubes.length} for "${game.name}"`);
          break;
        }
      }
    }
  }
  
  // Step 4: Build row structure for visualization
  for (let i = 0; i < cubes.length; i++) {
    const cube = cubes[i];
    cube.id = i + 1;
    
    // Group games by Y position
    const gamesByY = new Map();
    for (const game of cube.games) {
      const y = roundToGrid(game.position.y);
      if (!gamesByY.has(y)) {
        gamesByY.set(y, []);
      }
      gamesByY.get(y).push(game);
    }
    
    // Create rows
    const yLevels = Array.from(gamesByY.keys()).sort((a, b) => a - b);
    for (const y of yLevels) {
      const rowGames = gamesByY.get(y);
      rowGames.sort((a, b) => a.position.x - b.position.x);
      
      // Update game objects to match expected output format
      for (const game of rowGames) {
        game.orientedDims = { ...game.packedDims };
        game.actualOrientedDims = { ...game.actualDims };
      }
      
      const maxHeight = Math.max(...rowGames.map(g => g.packedDims.y));
      const totalWidth = rowGames.reduce((sum, g) => sum + g.packedDims.x, 0);
      
      cube.rows.push({
        games: rowGames,
        heightUsed: maxHeight,
        widthUsed: totalWidth
      });
    }
    
    cube.currentHeight = cube.games.length > 0 
      ? Math.max(...cube.games.map(g => g.position.y + g.packedDims.y))
      : 0;
    cube.currentWidth = CUBE_SIZE;
    
    const occupiedArea = calculateOccupiedArea(cube);
    const utilization = (occupiedArea / (CUBE_SIZE * CUBE_SIZE) * 100).toFixed(1);
    console.log(`   Cube ${cube.id}: ${cube.games.length} games, ${utilization}% utilized`);
  }
  
  console.log(`✅ Packed into ${cubes.length} cubes`);
  return cubes;
}

// New endpoint that returns processed JSON with packed cubes
app.get('/api/games/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const { includePreordered, includeExpansions, priorities, verticalStacking, allowAlternateRotation, optimizeSpace, respectSortOrder, ensureSupport } = req.query;
    
    if (!BGG_TOKEN) {
      console.error('❌ BGG API token not configured');
      return res.status(500).json({ 
        error: 'BGG API token not configured' 
      });
    }

    console.log('🎮 Processing games for user:', username);
    console.log('   Options:', { includePreordered, includeExpansions, allowAlternateRotation, optimizeSpace });

    // Step 1: Fetch collection with version info
    const collectionParams = new URLSearchParams({
      username,
      own: 1,
      stats: 1,
      version: 1, // Include version info for each item
    });
    
    if (includePreordered === 'true') {
      collectionParams.append('preordered', 1);
    }

    const collectionUrl = `${BGG_API_BASE}/collection?${collectionParams.toString()}`;
    console.log('📥 Fetching collection with version info...');
    
    let collectionResponse;
    let retries = 0;
    const maxRetries = 5;
    
    // Handle 202 response (collection queued for generation)
    while (retries < maxRetries) {
      collectionResponse = await bggApiRequest(collectionUrl, {
        headers: {
          'Authorization': `Bearer ${BGG_TOKEN}`,
          'Accept': 'application/xml'
        },
        validateStatus: (status) => status === 200 || status === 202
      });
      
      if (collectionResponse.status === 202) {
        console.log(`   ⏳ Collection queued (202), retrying in ${2 + retries} seconds... (attempt ${retries + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, (2 + retries) * 1000));
        retries++;
      } else {
        console.log('   ✅ Collection ready (200)');
        break;
      }
    }
    
    if (collectionResponse.status === 202) {
      throw new Error('Collection generation timed out. Please try again in a few moments.');
    }

    const collection = await parseXmlString(collectionResponse.data);
    
    if (!collection.items || !collection.items.item) {
      console.warn('⚠️  No items in collection');
      return res.json({ cubes: [], totalGames: 0 });
    }

    let items = Array.isArray(collection.items.item) 
      ? collection.items.item 
      : [collection.items.item];

    console.log(`   Found ${items.length} items in collection`);

    // Filter expansions if needed (check both subtype and categories)
    if (includeExpansions !== 'true') {
      const beforeFilter = items.length;
      items = items.filter(item => {
        const subtype = item.$.subtype;
        
        // Filter by subtype
        if (subtype === 'boardgameexpansion') {
          return false;
        }
        
        // Also check categories for expansion markers
        const categories = item.link || [];
        const hasExpansionCategory = categories.some(link => {
          const type = link.$.type;
          const value = link.$.value;
          return (type === 'boardgamecategory' && value === 'Expansion for Base-game') ||
                 (type === 'boardgamefamily' && value?.includes('Expansion'));
        });
        
        if (hasExpansionCategory) {
          console.log(`   → Filtering expansion by category: ${item.name?.[0]?._ || item.name?.[0]}`);
          return false;
        }
        
        return true;
      });
      console.log(`   Filtered out ${beforeFilter - items.length} expansions`);
    }
    
    // Handle multiple versions: keep if different version IDs, dedupe if same
    const seenGameVersions = new Map(); // Map of gameId -> Set of versionIds
    const duplicatesRemoved = [];
    
    items = items.filter(item => {
      const gameId = item.$.objectid;
      const gameName = item.name?.[0]?._ || item.name?.[0] || `ID:${gameId}`;
      const versionId = item.version?.[0]?.item?.[0]?.$?.id || 'no-version';
      
      if (!seenGameVersions.has(gameId)) {
        seenGameVersions.set(gameId, new Set());
      }
      
      const versions = seenGameVersions.get(gameId);
      
      if (versions.has(versionId)) {
        // Already have this exact version
        duplicatesRemoved.push(`${gameName} (${versionId})`);
        return false;
      }
      
      versions.add(versionId);
      return true;
    });
    
    // Log which games have multiple versions
    const multiVersionGames = Array.from(seenGameVersions.entries())
      .filter(([gameId, versions]) => versions.size > 1);
    
    if (multiVersionGames.length > 0) {
      console.log(`   ℹ️  Found ${multiVersionGames.length} game(s) with multiple versions owned:`);
      multiVersionGames.forEach(([gameId, versions]) => {
        const item = items.find(i => i.$.objectid === gameId);
        const gameName = item?.name?.[0]?._ || item?.name?.[0] || `ID:${gameId}`;
        console.log(`      - ${gameName}: ${versions.size} versions`);
      });
    }
    
    if (duplicatesRemoved.length > 0) {
      console.log(`   → Removed ${duplicatesRemoved.length} duplicate(s):`);
      duplicatesRemoved.forEach(name => console.log(`      - ${name}`));
    }
    console.log(`   ${items.length} items after deduplication (includes multiple versions)`);

    if (items.length === 0) {
      return res.json({ cubes: [], totalGames: 0 });
    }

    // Extract version info from collection
    // Use gameId + versionId as key to support multiple versions of same game
    const versionMap = new Map();
    const gamesNeedingVersions = [];
    
    items.forEach(item => {
      const gameId = item.$.objectid;
      const versionItem = item.version?.[0];
      
      if (versionItem && versionItem.item && versionItem.item.length > 0) {
        const versionId = versionItem.item[0].$?.id || 'default';
        const versionName = versionItem.item[0].name?.[0]?.$?.value || null;
        const width = versionItem.item[0].width?.[0]?.$?.value;
        const length = versionItem.item[0].length?.[0]?.$?.value;
        const depth = versionItem.item[0].depth?.[0]?.$?.value;
        
        // Check if dimensions are valid (not 0x0x0 and not null/empty)
        const widthNum = parseFloat(width);
        const lengthNum = parseFloat(length);
        const depthNum = parseFloat(depth);
        const hasValidDimensions = widthNum > 0 && lengthNum > 0 && depthNum > 0;
        
        if (hasValidDimensions) {
          const versionInfo = {
            id: versionId,
            name: versionName,
            yearPublished: versionItem.item[0].yearpublished?.[0]?.$?.value,
            width,
            length,
            depth,
          };
          // Key is gameId-versionId to handle multiple versions
          const key = `${gameId}-${versionId}`;
          versionMap.set(key, versionInfo);
        } else {
          gamesNeedingVersions.push(gameId);
        }
      } else {
        gamesNeedingVersions.push(gameId);
      }
    });
    
    console.log(`   ${versionMap.size} game versions have dimensions from collection`);
    console.log(`   ${gamesNeedingVersions.length} games need version lookup`);

    // Step 2: Build a map to track which collection items need which game details
    // Key is gameId, value is array of {collectionItem, versionId}
    const gameDetailsNeeded = new Map();
    
    items.forEach(item => {
      const gameId = item.$.objectid;
      const versionId = item.version?.[0]?.item?.[0]?.$?.id || 'default';
      
      if (!gameDetailsNeeded.has(gameId)) {
        gameDetailsNeeded.set(gameId, []);
      }
      
      gameDetailsNeeded.get(gameId).push({
        collectionItem: item,
        versionId: versionId
      });
    });
    
    const gameIds = Array.from(gameDetailsNeeded.keys());
    
    const batchSize = 10;
    let allGames = []; // Use 'let' so we can reassign during expansion filtering

    for (let i = 0; i < gameIds.length; i += batchSize) {
      const batch = gameIds.slice(i, i + batchSize);
      console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(gameIds.length / batchSize)}`);
      
      // Check for duplicates within this batch
      const batchUnique = [...new Set(batch)];
      if (batchUnique.length < batch.length) {
        console.log(`   ⚠️  Batch has ${batch.length - batchUnique.length} duplicate ID(s)`);
        console.log(`      Batch IDs: ${batch.join(', ')}`);
      }

      const thingParams = new URLSearchParams({
        id: batchUnique.join(','), // Use deduplicated batch
        stats: 1,
        // DON'T fetch versions here to save memory
      });

      const thingResponse = await bggApiRequest(
        `${BGG_API_BASE}/thing?${thingParams.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${BGG_TOKEN}`,
            'Accept': 'application/xml'
          }
        }
      );

      const thingData = await parseXmlString(thingResponse.data);
      
      if (!thingData.items || !thingData.items.item) {
        continue;
      }

      const thingItems = Array.isArray(thingData.items.item) 
        ? thingData.items.item 
        : [thingData.items.item];

      for (const item of thingItems) {
        try {
          const gameId = item.$.id;
          
          // Get all versions of this game from the collection
          const versions = gameDetailsNeeded.get(gameId) || [];
          
          // Process each version separately
          versions.forEach(({versionId}) => {
            const key = `${gameId}-${versionId}`;
            const versionInfo = versionMap.get(key);
            const game = processGameItem(item, versionInfo, versionId);
            
            // Use gameId-versionId as unique ID
            game.id = key;
            game.baseGameId = gameId;
            
            allGames.push(game);
          });
        } catch (error) {
          console.error(`Error processing game ${item.$.id}:`, error.message);
        }
      }
      
      // Aggressively clear XML objects to free memory immediately
      for (let j = 0; j < thingItems.length; j++) {
        thingItems[j] = null;
      }
      thingItems.length = 0;

      // Delay between batches (5 seconds as recommended by BGG API wiki)
      if (i + batchSize < gameIds.length) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    console.log(`✅ Processed ${allGames.length} games`);
    
    // Step 2.5: Fetch dimensions for games with missing dimensions
    const gamesMissingDimensions = allGames.filter(game => 
      game.dimensions.missingDimensions || 
      (game.dimensions.length === 0 && game.dimensions.width === 0 && game.dimensions.depth === 0)
    );
    
    if (gamesMissingDimensions.length > 0) {
      console.log(`📏 Fetching dimensions for ${gamesMissingDimensions.length} games...`);
      
      // Process in smaller batches to avoid memory issues
      const dimBatchSize = 5;
      for (let i = 0; i < gamesMissingDimensions.length; i += dimBatchSize) {
        const batch = gamesMissingDimensions.slice(i, i + dimBatchSize);
        const batchIds = batch.map(g => g.baseGameId).filter(Boolean);
        
        if (batchIds.length === 0) continue;
        
        console.log(`   📦 Dimension batch ${Math.floor(i / dimBatchSize) + 1}/${Math.ceil(gamesMissingDimensions.length / dimBatchSize)}`);
        
        const versionParams = new URLSearchParams({
          id: batchIds.join(','),
          versions: 1,
        });
        
        try {
          const versionResponse = await bggApiRequest(
            `${BGG_API_BASE}/thing?${versionParams.toString()}`,
            {
              headers: {
                'Authorization': `Bearer ${BGG_TOKEN}`,
                'Accept': 'application/xml'
              }
            }
          );
          
          const versionData = await parseXmlString(versionResponse.data);
          
          if (versionData.items?.item) {
            const versionItems = Array.isArray(versionData.items.item) 
              ? versionData.items.item 
              : [versionData.items.item];
            
            versionItems.forEach(item => {
              const gameId = item.$.id;
              const dimensions = findDimensionsFromVersions(item);
              
              // Update all games with this base game ID
              batch.forEach(game => {
                if (game.baseGameId === gameId && dimensions && !dimensions.missingDimensions) {
                  game.dimensions = dimensions;
                  console.log(`      ✓ Found dimensions for ${game.name}: ${dimensions.width}"×${dimensions.length}"×${dimensions.depth}"`);
                }
              });
            });
          }
          
          // Delay between batches (5 seconds as recommended by BGG API wiki)
          if (i + dimBatchSize < gamesMissingDimensions.length) {
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        } catch (error) {
          console.error(`   ❌ Error fetching dimensions for batch: ${error.message}`);
        }
      }
    }
    
    // Step 2.6: Apply default dimensions to any games still missing dimensions
    let gamesWithDefaultDimensions = 0;
    allGames.forEach(game => {
      if (game.dimensions.length === 0 && game.dimensions.width === 0 && game.dimensions.depth === 0) {
        game.dimensions = {
          length: 12.8,
          width: 12.8,
          depth: 1.8,
          missingDimensions: true,
        };
        gamesWithDefaultDimensions++;
      }
    });
    
    if (gamesWithDefaultDimensions > 0) {
      console.log(`⚠️  Applied default dimensions (12.8"×12.8"×1.8") to ${gamesWithDefaultDimensions} games`);
    }
    
    // Filter out expansions based on full game data (if not including expansions)
    if (includeExpansions !== 'true') {
      const beforeExpansionFilter = allGames.length;
      allGames = allGames.filter(game => {
        // Check if any category or family indicates this is an expansion
        const allTags = [...(game.categories || []), ...(game.families || [])];
        const isExpansion = allTags.some(tag => 
          tag === 'Expansion for Base-game' ||
          tag.includes('Expansion for') ||
          tag.includes('expansion for')
        );
        
        if (isExpansion) {
          console.log(`   → Filtering expansion after processing: ${game.name}`);
          return false;
        }
        
        return true;
      });
      
      if (beforeExpansionFilter > allGames.length) {
        console.log(`   → Filtered ${beforeExpansionFilter - allGames.length} expansions after full data fetch`);
      }
    }
    
    // Final deduplication check - only remove true duplicates (same gameId-versionId)
    const uniqueGames = [];
    const seenIds = new Set();
    
    for (const game of allGames) {
      if (!seenIds.has(game.id)) {
        uniqueGames.push(game);
        seenIds.add(game.id);
      } else {
        console.log(`   ⚠️  Removing processing duplicate: ${game.name} (ID: ${game.id})`);
      }
    }
    
    if (uniqueGames.length < allGames.length) {
      console.log(`   → Final deduplication: ${allGames.length} → ${uniqueGames.length} items`);
    }
    
    console.log(`   ℹ️  Total items to pack: ${uniqueGames.length} (includes multiple versions of same games)`);
    
    // Free up the version map and collection items - we don't need them anymore
    versionMap.clear();
    items.length = 0;
    allGames.length = 0; // Clear the old array
    
    // Force garbage collection hint
    if (global.gc) {
      console.log('   🗑️  Running garbage collection...');
      global.gc();
    }
    
    // Step 3: Pack games into cubes
    const parsedPriorities = priorities ? JSON.parse(priorities) : [];
    const isVertical = verticalStacking === 'true';
    const allowAltRotation = allowAlternateRotation === 'true';
    const shouldOptimizeSpace = optimizeSpace === 'true';
    const strictSortOrder = respectSortOrder === 'true';
    const shouldEnsureSupport = ensureSupport === 'true';
    
    const packedCubes = packGamesIntoCubes(uniqueGames, parsedPriorities, isVertical, allowAltRotation, shouldOptimizeSpace, strictSortOrder, shouldEnsureSupport);
    
    res.json({ cubes: packedCubes, totalGames: uniqueGames.length });

  } catch (error) {
    console.error('❌ Error processing games:', error.message);
    console.error('   Stack trace:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

function processGameItem(item, versionInfo = null, versionId = null) {
  // Extract basic info
  const gameId = item.$.id;
  let name = item.name?.find(n => n.$.type === 'primary')?.$?.value || 'Unknown';
  
  // Add version name if available and not default
  if (versionInfo?.name && versionId && versionId !== 'default') {
    name = `${name} (${versionInfo.name})`;
  } else if (versionId && versionId !== 'default' && versionInfo?.yearPublished) {
    name = `${name} (${versionInfo.yearPublished} Edition)`;
  }
  
  const minPlayers = parseInt(item.minplayers?.[0]?.$?.value || 1);
  const maxPlayers = parseInt(item.maxplayers?.[0]?.$?.value || 1);
  const minPlaytime = parseInt(item.minplaytime?.[0]?.$?.value || 0);
  const maxPlaytime = parseInt(item.maxplaytime?.[0]?.$?.value || 0);
  const age = parseInt(item.minage?.[0]?.$?.value || 0);

  // Extract categories and families
  const categories = item.link
    ?.filter(l => l.$.type === 'boardgamecategory')
    .map(l => l.$.value) || [];
  
  const families = item.link
    ?.filter(l => l.$.type === 'boardgamefamily')
    .map(l => l.$.value) || [];

  // Extract stats
  const stats = item.statistics?.[0]?.ratings?.[0];
  const bggRating = parseFloat(stats?.average?.[0]?.$?.value || 0);
  const weight = parseFloat(stats?.averageweight?.[0]?.$?.value || 0);
  
  const ranks = stats?.ranks?.[0]?.rank || [];
  let bggRank = null;
  for (const rank of ranks) {
    if (rank.$.name === 'boardgame' && rank.$.value !== 'Not Ranked') {
      bggRank = parseInt(rank.$.value);
      break;
    }
  }

  // Extract poll data
  let bestPlayerCount = null;
  let communityAge = null;

  const polls = item.poll || [];
  for (const poll of polls) {
    if (poll.$.name === 'suggested_numplayers') {
      let maxBestVotes = 0;
      const results = poll.results || [];
      for (const result of results) {
        const numPlayers = result.$.numplayers;
        const bestResult = result.result?.find(r => r.$.value === 'Best');
        if (bestResult) {
          const votes = parseInt(bestResult.$.numvotes || 0);
          if (votes > maxBestVotes) {
            maxBestVotes = votes;
            bestPlayerCount = parseInt(numPlayers);
          }
        }
      }
    }
    
    if (poll.$.name === 'suggested_playerage') {
      let maxVotes = 0;
      const results = poll.results?.[0]?.result || [];
      for (const result of results) {
        const votes = parseInt(result.$.numvotes || 0);
        if (votes > maxVotes) {
          maxVotes = votes;
          communityAge = parseInt(result.$.value);
        }
      }
    }
  }

  // Use dimensions from version info if available
  let dimensions;
  if (versionInfo && versionInfo.width && versionInfo.length && versionInfo.depth) {
    const width = parseFloat(versionInfo.width);
    const length = parseFloat(versionInfo.length);
    const depth = parseFloat(versionInfo.depth);
    
    // Check if dimensions are valid (not 0x0x0)
    if (width > 0 && length > 0 && depth > 0) {
      dimensions = {
        length,
        width,
        depth,
        missingDimensions: false,
      };
    } else {
      // Version exists but has invalid dimensions (0x0x0)
      dimensions = {
        length: 0,
        width: 0,
        depth: 0,
        missingDimensions: true,
      };
    }
  } else {
    // No version info at all
    dimensions = {
      length: 0,
      width: 0,
      depth: 0,
      missingDimensions: true,
    };
  }

  // Return ONLY fields needed for sorting and packing - discard everything else
  return {
    id: gameId,
    name,
    // Dimensions (for packing)
    dimensions,
    // All sorting priority fields (keep complete arrays for categories/families)
    categories,  // Keep all categories for sorting
    families,    // Keep all families for sorting
    bggRank,
    minPlayers,
    maxPlayers,
    bestPlayerCount,
    minPlaytime,
    maxPlaytime,
    age,
    communityAge,
    weight,
    bggRating,
    // DISCARD: descriptions, designers, publishers, artists, yearpublished, 
    // mechanics, all raw XML data, version info, thumbnails, images, etc.
  };
}

function findDimensionsFromVersions(item) {
  try {
    const versions = item.versions?.[0]?.item || [];
    
    if (versions.length === 0) {
      return { length: 12.8, width: 12.8, depth: 1.8, missingDimensions: true };
    }

    // Parse all versions with their metadata
    const versionData = versions.map(v => {
      const yearPublished = parseInt(v.yearpublished?.[0]?.$?.value || 0);
      const language = v.link?.find(l => l.$.type === 'language')?.$?.value || '';
      const width = parseFloat(v.width?.[0]?.$?.value || 0);
      const length = parseFloat(v.length?.[0]?.$?.value || 0);
      const depth = parseFloat(v.depth?.[0]?.$?.value || 0);
      
      return {
        year: yearPublished,
        language,
        width,
        length,
        depth,
        hasValidDimensions: width > 0 && length > 0 && depth > 0,
      };
    });

    // Strategy 1: English versions with dimensions (newest first)
    const englishVersions = versionData
      .filter(v => v.hasValidDimensions && v.language === 'English')
      .sort((a, b) => b.year - a.year);
    
    if (englishVersions.length > 0) {
      const selected = englishVersions[0];
      return {
        length: selected.length,
        width: selected.width,
        depth: selected.depth,
        missingDimensions: false,
      };
    }

    // Strategy 2: Any version with dimensions (newest first)
    const allVersionsWithDims = versionData
      .filter(v => v.hasValidDimensions)
      .sort((a, b) => b.year - a.year);
    
    if (allVersionsWithDims.length > 0) {
      const selected = allVersionsWithDims[0];
      return {
        length: selected.length,
        width: selected.width,
        depth: selected.depth,
        missingDimensions: false,
      };
    }

    // Strategy 3: Use default
    return { length: 12.8, width: 12.8, depth: 1.8, missingDimensions: true };
  } catch (error) {
    console.error('Error in findDimensionsFromVersions:', error.message);
    return { length: 12.8, width: 12.8, depth: 1.8, missingDimensions: true };
  }
}

// Kept for backward compatibility
function extractDimensions(item) {
  return findDimensionsFromVersions(item);
}

// Keep old endpoints for backward compatibility
app.get('/api/collection/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const { own, preordered, stats } = req.query;
    
    if (!BGG_TOKEN) {
      console.error('❌ BGG API token not configured');
      return res.status(500).json({ 
        error: 'BGG API token not configured. Please set BGG_API_TOKEN in server/.env file' 
      });
    }

    const params = new URLSearchParams();
    if (username) params.append('username', username);
    if (own) params.append('own', own);
    if (preordered) params.append('preordered', preordered);
    if (stats) params.append('stats', stats);

    const url = `${BGG_API_BASE}/collection?${params.toString()}`;
    console.log('🔍 Fetching BGG collection:');
    console.log('   Username:', username);
    console.log('   URL:', url);
    console.log('   Parameters:', { own, preordered, stats });
    
    const response = await bggApiRequest(url, {
      headers: {
        'Authorization': `Bearer ${BGG_TOKEN}`,
        'Accept': 'application/xml'
      }
    });

    console.log('✅ BGG API Response:');
    console.log('   Status:', response.status);
    console.log('   Content-Type:', response.headers['content-type']);
    console.log('   Data length:', response.data.length);
    
    // Log first 500 chars of response for debugging
    console.log('   Response preview:', response.data.substring(0, 500));
    
    // Check if response contains error message
    if (response.data.includes('<error')) {
      console.warn('⚠️  BGG returned error in XML');
    }
    
    // Check if response contains items
    const itemMatches = response.data.match(/<item/g);
    if (itemMatches) {
      console.log('   Items found:', itemMatches.length);
    } else {
      console.warn('⚠️  No items found in response');
    }

    // Return the XML response
    res.set('Content-Type', 'application/xml');
    res.send(response.data);
    
  } catch (error) {
    console.error('❌ Error fetching collection:');
    console.error('   Message:', error.message);
    console.error('   Status:', error.response?.status);
    console.error('   Status Text:', error.response?.statusText);
    
    if (error.response?.data) {
      console.error('   Response data:', error.response.data.substring(0, 500));
    }
    
    if (error.response?.status === 401) {
      console.error('   → Token authentication failed');
      return res.status(401).json({ 
        error: 'BGG API authorization failed. Your token may be invalid or expired.' 
      });
    }
    
    if (error.response?.status === 202) {
      console.warn('   → Collection still processing');
      return res.status(202).json({ 
        error: 'BGG is still processing this collection. Please try again in a few moments.' 
      });
    }
    
    res.status(error.response?.status || 500).json({ 
      error: error.message || 'Failed to fetch collection from BGG' 
    });
  }
});

// Proxy endpoint for BGG thing (game details)
app.get('/api/thing', async (req, res) => {
  try {
    const { id, stats, versions } = req.query;
    
    if (!BGG_TOKEN) {
      return res.status(500).json({ 
        error: 'BGG API token not configured. Please set BGG_API_TOKEN in server/.env file' 
      });
    }

    if (!id) {
      return res.status(400).json({ error: 'Game ID(s) required' });
    }

    const params = new URLSearchParams();
    params.append('id', id);
    if (stats) params.append('stats', stats);
    if (versions) params.append('versions', versions);

    const url = `${BGG_API_BASE}/thing?${params.toString()}`;
    console.log('🔍 Fetching thing details:');
    console.log('   IDs:', id);
    console.log('   URL:', url);

    const response = await bggApiRequest(url, {
      headers: {
        'Authorization': `Bearer ${BGG_TOKEN}`,
        'Accept': 'application/xml'
      }
    });

    console.log('✅ BGG Thing API Response:');
    console.log('   Status:', response.status);
    console.log('   Data length:', response.data.length);

    // Return the XML response
    res.set('Content-Type', 'application/xml');
    res.send(response.data);
    
  } catch (error) {
    console.error('❌ Error fetching thing:');
    console.error('   Message:', error.message);
    console.error('   Status:', error.response?.status);
    
    if (error.response?.status === 401) {
      console.error('   → Token authentication failed');
      return res.status(401).json({ 
        error: 'BGG API authorization failed. Your token may be invalid or expired.' 
      });
    }
    
    res.status(error.response?.status || 500).json({ 
      error: error.message || 'Failed to fetch game details from BGG' 
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 BGG Kallax Organizer Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  
  if (!BGG_TOKEN) {
    console.warn('⚠️  WARNING: BGG_API_TOKEN not set in environment variables');
    console.warn('   Please create a server/.env file with your BGG API token');
  } else {
    console.log('✅ BGG API token configured');
  }
});

