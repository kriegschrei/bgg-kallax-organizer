import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import { parseString } from 'xml2js';
import { promisify } from 'util';
import {
  getCollection,
  setCollection,
  getGame,
  setGame,
  getVersion,
  setVersion,
  hashData,
  extractCollectionData,
  extractGameData,
  extractVersionData,
  cleanup,
  getStats,
  clearCache
} from './cache.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const BGG_API_BASE = 'https://boardgamegeek.com/xmlapi2';
const BGG_TOKEN = process.env.BGG_API_TOKEN;

// Middleware
app.use(cors());
app.use(express.json());

// Increase timeout for long-running requests (2 minutes)
app.timeout = 120000; // 2 minutes in milliseconds
app.use((req, res, next) => {
  req.setTimeout(120000);
  res.setTimeout(120000);
  next();
});

// Store progress for each request (SSE)
const progressStore = new Map();

// Helper function to send progress updates via SSE
function sendProgress(requestId, message, data = {}) {
  const res = progressStore.get(requestId);
  if (res && !res.writableEnded) {
    try {
      res.write(`data: ${JSON.stringify({ message, ...data, timestamp: Date.now() })}\n\n`);
    } catch (error) {
      // Connection may have closed, remove from store
      progressStore.delete(requestId);
    }
  }
}

// Helper to create BGG-style slug from a game name
function slugifyName(name) {
  if (!name || typeof name !== 'string') {
    return 'game';
  }

  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'game';
}

function buildVersionsUrl(gameId, gameName) {
  const slug = slugifyName(gameName);
  return `https://boardgamegeek.com/boardgame/${gameId}/${slug}/versions`;
}

function buildCorrectionUrl(versionId) {
  if (!versionId) {
    return null;
  }
  return `https://boardgamegeek.com/item/correction/boardgameversion/${versionId}`;
}

function extractVersionId(game, fallbackVersionId = null) {
  if (game?.selectedVersionId) {
    return game.selectedVersionId;
  }

  if (game?.id && typeof game.id === 'string' && game.id.includes('-')) {
    const parts = game.id.split('-');
    const possibleVersionId = parts[parts.length - 1];
    if (possibleVersionId && possibleVersionId !== 'default' && possibleVersionId !== 'no-version') {
      return possibleVersionId;
    }
  }

  if (fallbackVersionId && fallbackVersionId !== 'default' && fallbackVersionId !== 'no-version') {
    return fallbackVersionId;
  }

  return null;
}

// Helper function to normalize username to lowercase for case-insensitive operations
function normalizeUsername(username) {
  return username ? username.toLowerCase() : username;
}

// SSE endpoint for progress updates
app.get('/api/games/:username/progress', (req, res) => {
  const username = normalizeUsername(req.params.username);
  const requestId = req.query.requestId || `${username}-${Date.now()}`;
  
  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.setHeader('Access-Control-Allow-Origin', '*'); // Allow CORS for SSE
  
  // Send initial connection message
  res.write(`data: ${JSON.stringify({ status: 'connected', requestId })}\n\n`);
  
  // Store the response object for this request
  progressStore.set(requestId, res);
  
  // Send keep-alive every 10 seconds to prevent connection timeout
  const keepAliveInterval = setInterval(() => {
    if (!res.writableEnded) {
      res.write(`: keep-alive\n\n`);
    } else {
      clearInterval(keepAliveInterval);
      progressStore.delete(requestId);
    }
  }, 10000);
  
  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(keepAliveInterval);
    progressStore.delete(requestId);
    res.end();
  });
});

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
      // Success - return immediately, no delay
      return response;
    } catch (error) {
      // Check if it's a rate limit or server busy error (429, 500, 503)
      const status = error.response?.status;
      if (status === 429 || status === 500 || status === 503) {
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
        
        console.log(`   ⚠️  Server error (${status}). Waiting ${(waitTime / 1000).toFixed(1)}s before retry ${retries}/${maxRetries}...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      // For other errors, throw immediately (no retry, no delay)
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

// ============================================================================
// GROUPING FUNCTIONS
// ============================================================================

// Helper function to detect circular references in an object
function detectCircularRefs(obj, path = 'root', visited = new WeakSet(), maxDepth = 10) {
  if (maxDepth <= 0) return false;
  
  if (obj === null || typeof obj !== 'object') {
    return false;
  }
  
  if (visited.has(obj)) {
    console.error(`   🔄 CIRCULAR REFERENCE DETECTED at path: ${path}`);
    return true;
  }
  
  visited.add(obj);
  
  if (Array.isArray(obj)) {
    for (let i = 0; i < Math.min(obj.length, 5); i++) { // Only check first 5 items
      if (detectCircularRefs(obj[i], `${path}[${i}]`, visited, maxDepth - 1)) {
        return true;
      }
    }
  } else {
    const keys = Object.keys(obj).slice(0, 10); // Only check first 10 keys
    for (const key of keys) {
      if (key === '_group') {
        console.error(`   ⚠️  Found _group property at ${path}.${key}`);
      }
      if (detectCircularRefs(obj[key], `${path}.${key}`, visited, maxDepth - 1)) {
        return true;
      }
    }
  }
  
  visited.delete(obj);
  return false;
}

// Group expansions with their base games
function groupExpansionsWithBaseGames(games, allGameIds) {
  console.log(`   🔍 Grouping expansions: checking ${games.length} games for circular refs...`);
  
  // Check for circular refs before grouping
  let circularRefCount = 0;
  for (let i = 0; i < Math.min(games.length, 10); i++) {
    if (detectCircularRefs(games[i], `games[${i}]`)) {
      circularRefCount++;
      if (circularRefCount <= 3) {
        console.error(`   ❌ Found circular ref in game "${games[i].name || 'unknown'}" (id: ${games[i].id})`);
      }
    }
  }
  if (circularRefCount > 0) {
    console.error(`   ⚠️  WARNING: Found ${circularRefCount} games with circular references before grouping!`);
  }
  
  const groups = new Map(); // groupId (baseGameId) -> Game[]
  const expansionGameIds = new Set();
  
  // Helper to extract base game ID from versioned ID
  const getBaseId = (game) => {
    // For versioned games, ID format is "gameId-versionId", extract just gameId
    if (game.id && game.id.includes('-')) {
      const parts = game.id.split('-');
      // Check if first part is numeric (it's a game ID)
      if (/^\d+$/.test(parts[0])) {
        return parts[0];
      }
    }
    return game.id;
  };
  
  // First pass: identify expansions and create groups
  for (const game of games) {
    if (game.isExpansion && game.baseGameId) {
      const baseId = game.baseGameId;
      
      // Only group if base game is in the collection
      // Check if baseGameId matches any game's base ID in the collection
      const baseGameInCollection = allGameIds.has(baseId) || 
        Array.from(allGameIds).some(id => {
          const gameBaseId = getBaseId({ id });
          return gameBaseId === baseId;
        });
      
      if (baseGameInCollection) {
        if (!groups.has(baseId)) {
          groups.set(baseId, []);
        }
        groups.get(baseId).push(game);
        expansionGameIds.add(game.id);
      }
    }
  }
  
  // Second pass: add base games to their groups
  for (const game of games) {
    if (game.isExpansion) continue; // Skip expansions in this pass
    
    const gameBaseId = getBaseId(game);
    
    // Check if this game's base ID matches any expansion group
    if (groups.has(gameBaseId)) {
      const group = groups.get(gameBaseId);
      // Check if base game is already in the group
      const baseGameInGroup = group.some(g => {
        if (g.isExpansion) return false;
        const gBaseId = getBaseId(g);
        return gBaseId === gameBaseId;
      });
      
      if (!baseGameInGroup) {
        // Insert base game at the beginning of the group
        group.unshift(game);
      }
    }
  }
  
  // Filter out groups that only have expansions (base game not in collection)
  const validGroups = new Map();
  for (const [groupId, groupGames] of groups.entries()) {
    // Check if group has at least one non-expansion game (base game)
    const hasBaseGame = groupGames.some(g => {
      if (g.isExpansion) return false;
      const gBaseId = getBaseId(g);
      return gBaseId === groupId;
    });
    
    if (hasBaseGame && groupGames.length > 1) {
      // Only create group if it has base game + at least one expansion
      validGroups.set(groupId, groupGames);
    }
  }
  
  return { groups: validGroups, expansionGameIds };
}

// Group games by series/family
function groupGamesBySeries(games, excludeExpansionGroups = new Set()) {
  const familyGroups = new Map(); // familyId -> Game[]
  const gameToFamilies = new Map(); // gameId -> Set<familyId>
  
  // First pass: collect all family memberships
  for (const game of games) {
    // Skip games that are already in expansion groups if excludeExpansionGroups is enabled
    if (excludeExpansionGroups.has(game.id)) {
      continue;
    }
    
    if (game.familyIds && game.familyIds.length > 0) {
      const families = new Set();
      for (const familyId of game.familyIds) {
        if (!familyGroups.has(familyId)) {
          familyGroups.set(familyId, []);
        }
        families.add(familyId);
      }
      gameToFamilies.set(game.id, families);
    }
  }
  
  // Second pass: assign games to families
  // For games in multiple families, choose the most specific one (smallest group)
  for (const game of games) {
    if (excludeExpansionGroups.has(game.id)) {
      continue;
    }
    
    const families = gameToFamilies.get(game.id);
    if (families && families.size > 0) {
      // If game is in multiple families, choose the one with fewest members
      // (more specific/smaller series)
      let chosenFamily = null;
      let minSize = Infinity;
      
      for (const familyId of families) {
        const currentSize = familyGroups.get(familyId)?.length || 0;
        if (currentSize < minSize) {
          minSize = currentSize;
          chosenFamily = familyId;
        }
      }
      
      if (chosenFamily) {
        familyGroups.get(chosenFamily).push(game);
      }
    }
  }
  
  // Filter out groups with only one game (no grouping benefit)
  const validGroups = new Map();
  for (const [familyId, groupGames] of familyGroups.entries()) {
    if (groupGames.length > 1) {
      validGroups.set(familyId, groupGames);
    }
  }
  
  return validGroups;
}

// Create game groups based on options
function createGameGroups(games, groupExpansions, groupSeries) {
  const allGameIds = new Set(games.map(g => g.id));
  
  // Step 1: Group expansions if enabled
  let expansionGroups = new Map();
  let expansionGameIds = new Set();
  
  if (groupExpansions) {
    const expansionResult = groupExpansionsWithBaseGames(games, allGameIds);
    expansionGroups = expansionResult.groups;
    expansionGameIds = expansionResult.expansionGameIds;
    console.log(`   📦 Created ${expansionGroups.size} expansion groups`);
  }
  
  // Step 2: Group by series if enabled (excluding games already in expansion groups)
  let seriesGroups = new Map();
  
  if (groupSeries) {
    seriesGroups = groupGamesBySeries(games, expansionGameIds);
    console.log(`   📚 Created ${seriesGroups.size} series groups`);
  }
  
  // Step 3: Combine groups (expansion groups take priority)
  const finalGroups = new Map();
  const groupedGameIds = new Set();
  
  // Add expansion groups first
  for (const [groupId, groupGames] of expansionGroups.entries()) {
    finalGroups.set(`expansion:${groupId}`, groupGames);
    for (const game of groupGames) {
      groupedGameIds.add(game.id);
    }
  }
  
  // Add series groups (only for games not in expansion groups)
  for (const [familyId, groupGames] of seriesGroups.entries()) {
    // Filter out games already in expansion groups
    const filteredGames = groupGames.filter(g => !groupedGameIds.has(g.id));
    if (filteredGames.length > 1) {
      finalGroups.set(`series:${familyId}`, filteredGames);
      for (const game of filteredGames) {
        groupedGameIds.add(game.id);
      }
    }
  }
  
  // Find standalone games (not in any group)
  const standaloneGames = games.filter(g => !groupedGameIds.has(g.id));
  
  return {
    groups: finalGroups,
    standaloneGames,
    groupedGameIds
  };
}

// Calculate total area of a group
function calculateGroupArea(group, primaryOrder) {
  let totalArea = 0;
  
  for (const game of group) {
    if (game.dims2D) {
      totalArea += game.dims2D.x * game.dims2D.y;
    }
  }
  
  return totalArea;
}

// Split oversized groups into smaller groups that fit in a cube
function splitOversizedGroup(group, maxArea, primaryOrder) {
  const CUBE_AREA = CUBE_SIZE * CUBE_SIZE; // 12.8 * 12.8 = 163.84 sq in, but we use 16384 for safety
  const MAX_GROUP_AREA = maxArea || (CUBE_SIZE * CUBE_SIZE * 0.95); // 95% of cube area to leave some margin
  
  // Calculate current area
  const currentArea = calculateGroupArea(group, primaryOrder);
  
  if (currentArea <= MAX_GROUP_AREA) {
    return [group]; // Group fits, no splitting needed
  }
  
  console.log(`   ✂️  Splitting oversized group (${group.length} games, ${currentArea.toFixed(1)} sq in > ${MAX_GROUP_AREA.toFixed(1)})`);
  
  // Sort games by area (descending) - keep largest games together
  const sortedGames = [...group].sort((a, b) => {
    const areaA = (a.dims2D?.x || 0) * (a.dims2D?.y || 0);
    const areaB = (b.dims2D?.x || 0) * (b.dims2D?.y || 0);
    return areaB - areaA;
  });
  
  // Identify base game (first non-expansion, or first game if all are expansions)
  const baseGameIndex = sortedGames.findIndex(g => !g.isExpansion);
  const baseGame = baseGameIndex >= 0 ? sortedGames[baseGameIndex] : sortedGames[0];
  
  // Remove base game from sorted list
  const otherGames = sortedGames.filter((g, i) => i !== (baseGameIndex >= 0 ? baseGameIndex : 0));
  
  // Create first group with base game
  const subGroups = [[baseGame]];
  let currentGroupArea = (baseGame.dims2D?.x || 0) * (baseGame.dims2D?.y || 0);
  
  // Distribute remaining games
  for (const game of otherGames) {
    const gameArea = (game.dims2D?.x || 0) * (game.dims2D?.y || 0);
    
    // Try to add to existing groups (starting with first group to keep base game group together)
    let added = false;
    for (let i = 0; i < subGroups.length; i++) {
      const groupArea = calculateGroupArea(subGroups[i], primaryOrder);
      if (groupArea + gameArea <= MAX_GROUP_AREA) {
        subGroups[i].push(game);
        added = true;
        break;
      }
    }
    
    // If doesn't fit in any existing group, create new group
    if (!added) {
      subGroups.push([game]);
    }
  }
  
  console.log(`      → Split into ${subGroups.length} sub-groups`);
  
  return subGroups;
}

// Main packing function
function packGamesIntoCubes(games, priorities, verticalStacking, allowAlternateRotation, optimizeSpace, respectSortOrder, ensureSupport, groupExpansions = false, groupSeries = false) {
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
  
  // Step 1.5: Create groups if grouping is enabled (GROUPS TAKE PRECEDENCE)
  let gameGroups = new Map();
  let standaloneGames = [...validGames];
  const MAX_GROUP_AREA = CUBE_SIZE * CUBE_SIZE * 0.95; // 95% of cube area
  
  if (groupExpansions || groupSeries) {
    console.log(`   🔗 Creating game groups (expansions: ${groupExpansions}, series: ${groupSeries})...`);
    const groupingResult = createGameGroups(validGames, groupExpansions, groupSeries);
    
    // Split oversized groups
    const splitGroups = new Map();
    for (const [groupId, group] of groupingResult.groups.entries()) {
      const subGroups = splitOversizedGroup(group, MAX_GROUP_AREA, primaryOrder);
      if (subGroups.length === 1) {
        splitGroups.set(groupId, subGroups[0]);
      } else {
        // Multiple sub-groups, rename them
        subGroups.forEach((subGroup, index) => {
          splitGroups.set(`${groupId}_split${index}`, subGroup);
        });
      }
    }
    
    gameGroups = splitGroups;
    standaloneGames = groupingResult.standaloneGames;
    
    // Store group ID on each game for packing logic (but not the group array to avoid circular refs)
    console.log(`   🔍 Checking for circular refs in ${gameGroups.size} groups...`);
    for (const [groupId, group] of gameGroups.entries()) {
      // Check if the group array itself creates a circular ref
      for (let i = 0; i < group.length; i++) {
        const game = group[i];
        
        // CRITICAL: Check if accessing game properties creates circular ref
        try {
          // Test accessing the game object
          const testAccess = game.name;
          
          // Check if game already has _group (shouldn't happen, but check)
          if (game._group !== undefined || '_group' in game) {
            console.error(`   ❌ ERROR: Game "${game.name}" (id: ${game.id}) ALREADY HAS _group before we set _groupId!`);
            console.error(`      Group: ${groupId}, Index in group: ${i}`);
            delete game._group;
          }
          
          // Set only _groupId, NEVER _group
          game._groupId = groupId;
          
          // Verify we didn't accidentally create a circular ref
          // If game._group points to group, and group contains game, that's circular
          if (game._group === group || (game._group && Array.isArray(game._group) && game._group.includes(game))) {
            console.error(`   ❌ CRITICAL: Circular ref detected! game._group points to group containing game!`);
            delete game._group;
          }
        } catch (e) {
          console.error(`   ❌ Error processing game "${game?.name || 'unknown'}" in group ${groupId}:`, e.message);
        }
      }
    }
    
    // After setting _groupId, check if any circular refs were created
    console.log(`   🔍 Verifying no circular refs were created...`);
    let postGroupCircularRefs = 0;
    for (const [groupId, group] of gameGroups.entries()) {
      for (const game of group) {
        if (detectCircularRefs(game, `group[${groupId}].game[${game.id}]`)) {
          postGroupCircularRefs++;
          if (postGroupCircularRefs <= 3) {
            console.error(`   ❌ Found circular ref in game "${game.name}" after setting _groupId!`);
          }
        }
      }
    }
    if (postGroupCircularRefs > 0) {
      console.error(`   ⚠️  WARNING: Found ${postGroupCircularRefs} games with circular references after grouping!`);
    }
    
    console.log(`   ✓ Created ${gameGroups.size} groups, ${standaloneGames.length} standalone games`);
    
    // Immediately clean up any _group properties that might have been set (defensive)
    let cleanupCount1 = 0;
    for (const game of validGames) {
      if (game._group !== undefined) {
        console.error(`   ⚠️  Found _group on "${game.name}" during initial cleanup!`);
        delete game._group;
        cleanupCount1++;
      }
    }
    if (cleanupCount1 > 0) {
      console.log(`   🧹 Initial cleanup removed ${cleanupCount1} _group properties`);
    }
  }
  
  // Step 2: Sort groups and standalone games separately
  // Groups are sorted as units, standalone games are sorted individually
  // Helper function to get representative game for a group (base game or first game)
  function getGroupRepresentative(group) {
    // For expansion groups, prefer the base game (non-expansion)
    const baseGame = group.find(g => !g.isExpansion);
    return baseGame || group[0];
  }
  
  // Calculate total area of a group
  function getGroupTotalArea(group) {
    let totalArea = 0;
    for (const game of group) {
      if (game.dims2D) {
        totalArea += game.dims2D.x * game.dims2D.y;
      }
    }
    return totalArea;
  }
  
  // Sort groups as units
  const sortedGroups = [];
  if (gameGroups.size > 0) {
    for (const [groupId, group] of gameGroups.entries()) {
      sortedGroups.push({ groupId, group });
    }
    
    if (optimizeSpace) {
      // Sort groups by total area (largest first) when optimizing for space
      sortedGroups.sort((a, b) => {
        const areaA = getGroupTotalArea(a.group);
        const areaB = getGroupTotalArea(b.group);
        if (Math.abs(areaA - areaB) > 0.01) return areaB - areaA;
        
        // If areas are equal, compare by representative game
        const repA = getGroupRepresentative(a.group);
        const repB = getGroupRepresentative(b.group);
        return (repA.name || '').localeCompare(repB.name || '');
      });
      console.log(`   Sorted ${sortedGroups.length} groups by total area (optimized)`);
    } else {
      // Sort groups by their representative game using user priorities
      sortedGroups.sort((a, b) => {
        const repA = getGroupRepresentative(a.group);
        const repB = getGroupRepresentative(b.group);
        return compareGames(repA, repB, priorities);
      });
      console.log(`   Sorted ${sortedGroups.length} groups by priorities`);
    }
  }
  
  // Sort standalone games
  if (standaloneGames.length > 0) {
    if (optimizeSpace) {
      // Sort by area descending, then dimensions, then name
      standaloneGames.sort((a, b) => {
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
      console.log(`   Sorted ${standaloneGames.length} standalone games by area (optimized)`);
    } else {
      standaloneGames.sort((a, b) => compareGames(a, b, priorities));
      console.log(`   Sorted ${standaloneGames.length} standalone games by priorities`);
    }
  }
  
  // Step 3: Pack games into cubes
  // PRIORITY: Groups first (in sorted order), then standalone games (in sorted order)
  const cubes = [];
  const placed = new Set();
  
  // Helper function to try placing a group together
  function tryPlaceGroup(cube, group, requireSupport) {
    // Check if all games in group can fit in this cube
    const tempCube = { games: [...cube.games], rows: [] };
    const groupPlaced = [];
    
    // Sort group by size (largest first) for better packing within the group
    const sortedGroup = [...group].sort((a, b) => {
      const areaA = (a.dims2D?.x || 0) * (a.dims2D?.y || 0);
      const areaB = (b.dims2D?.x || 0) * (b.dims2D?.y || 0);
      return areaB - areaA;
    });
    
    for (const game of sortedGroup) {
      if (placed.has(game.id)) continue;
      
      const orientations = [];
      orientations.push({ x: game.dims2D.x, y: game.dims2D.y });
      if (allowAlternateRotation && Math.abs(game.dims2D.x - game.dims2D.y) > 0.01) {
        orientations.push({ x: game.dims2D.y, y: game.dims2D.x });
      }
      
      let gamePlaced = false;
      for (const orientation of orientations) {
        if (tryPlaceGame(tempCube, game, orientation.x, orientation.y, requireSupport)) {
          groupPlaced.push(game);
          gamePlaced = true;
          break;
        }
      }
      
      if (!gamePlaced) {
        // Can't place this game, abort group placement
        return false;
      }
    }
    
    // All games in group can be placed, commit to cube
    cube.games = tempCube.games;
    for (const game of groupPlaced) {
      placed.add(game.id);
    }
    
    return true;
  }
  
  // FIRST: Place all groups in sorted order (GROUPS TAKE PRECEDENCE)
  if (sortedGroups.length > 0) {
    for (const { groupId, group } of sortedGroups) {
      // Check if all games in group are already placed
      if (group.every(g => placed.has(g.id))) {
        continue;
      }
      
      let groupPlaced = false;
      
      // Determine which cubes to check based on optimizeSpace and respectSortOrder
      let cubesToCheck = [];
      if (optimizeSpace) {
        // When optimizing for space, try all cubes to find best fit
        // Sort cubes by available space (descending) to prefer cubes with more space
        cubesToCheck = [...cubes].sort((a, b) => {
          const occupiedA = calculateOccupiedArea(a);
          const occupiedB = calculateOccupiedArea(b);
          return occupiedB - occupiedA; // More space first (less occupied)
        });
      } else if (respectSortOrder) {
        // Strict sort order: only check last cube
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
      
      // Try to place group in existing cubes
      for (const cube of cubesToCheck) {
        if (tryPlaceGroup(cube, group, requireSupport)) {
          groupPlaced = true;
          console.log(`   ✅ Placed group "${groupId}" (${group.length} games) together`);
          break;
        }
      }
      
      // Create new cube for group if it doesn't fit anywhere
      if (!groupPlaced) {
        const newCube = { games: [], rows: [] };
        if (tryPlaceGroup(newCube, group, requireSupport)) {
          cubes.push(newCube);
          const baseGame = getGroupRepresentative(group);
          console.log(`   Created cube ${cubes.length} for group "${groupId}" (${group.length} games) starting with "${baseGame.name}"`);
          groupPlaced = true;
        } else {
          // Group too large or can't be placed together - add games to standalone list
          console.log(`   ⚠️  Group "${groupId}" couldn't be placed together, will pack individually`);
        }
      }
    }
  }
  
  // Collect any games from groups that couldn't be placed together
  // These need to be packed individually after standalone games
  const unplacedGroupGames = [];
  if (sortedGroups.length > 0) {
    for (const { groupId, group } of sortedGroups) {
      for (const game of group) {
        if (!placed.has(game.id)) {
          unplacedGroupGames.push(game);
        }
      }
    }
  }
  
  // Sort unplaced group games using the same logic as standalone games
  if (unplacedGroupGames.length > 0) {
    if (optimizeSpace) {
      unplacedGroupGames.sort((a, b) => {
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
    } else {
      unplacedGroupGames.sort((a, b) => compareGames(a, b, priorities));
    }
    // Add to standalone games (after all standalone games are processed)
    console.log(`   Adding ${unplacedGroupGames.length} unplaced group games to pack individually`);
  }
  
  // SECOND: Pack standalone games (in sorted order)
  for (const game of standaloneGames) {
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
      // When optimizing for space, try all cubes to find best fit
      // Sort cubes by available space (descending) to prefer cubes with more space
      cubesToCheck = [...cubes].sort((a, b) => {
        const occupiedA = calculateOccupiedArea(a);
        const occupiedB = calculateOccupiedArea(b);
        return occupiedB - occupiedA; // More space first (less occupied)
      });
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
  
  // THIRD: Pack any games from groups that couldn't be placed together (in sorted order)
  for (const game of unplacedGroupGames) {
    if (placed.has(game.id)) continue;
    
    const orientations = [];
    
    // Primary orientation (respects user's stacking preference)
    orientations.push({ x: game.dims2D.x, y: game.dims2D.y });
    
    // Alternate orientation (if rotation allowed and dimensions different)
    if (allowAlternateRotation && Math.abs(game.dims2D.x - game.dims2D.y) > 0.01) {
      orientations.push({ x: game.dims2D.y, y: game.dims2D.x });
    }
    
    let wasPlaced = false;
    
    // Determine which cubes to check
    let cubesToCheck = [];
    if (optimizeSpace) {
      // When optimizing for space, try all cubes to find best fit
      cubesToCheck = [...cubes].sort((a, b) => {
        const occupiedA = calculateOccupiedArea(a);
        const occupiedB = calculateOccupiedArea(b);
        return occupiedB - occupiedA; // More space first (less occupied)
      });
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
    
    // Clean up temporary properties from all games in this cube FIRST
    for (const game of cube.games) {
      delete game._group;
      delete game._groupId;
    }
    
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
        
        // Ensure temporary grouping properties are removed (defensive cleanup)
        delete game._group;
        delete game._groupId;
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
  
  // Final cleanup pass: remove temporary properties from all games in all cubes
  // This ensures we catch any games that might have been missed
  // Use a Set to track cleaned games to avoid processing the same object twice
  const cleanedGames = new WeakSet();
  let cleanupCount = 0;
  let _groupCount = 0;
  
  for (const cube of cubes) {
    for (const game of cube.games) {
      if (!cleanedGames.has(game)) {
        // Force delete and nullify to break any references
        if ('_group' in game) {
          _groupCount++;
          console.error(`   ❌ FOUND _group on game "${game.name}" (id: ${game.id}) in cube ${cube.id}!`);
          try {
            const groupRef = game._group;
            console.error(`      _group is:`, Array.isArray(groupRef) ? `Array with ${groupRef.length} items` : typeof groupRef);
            delete game._group;
            // Verify it's actually deleted
            if ('_group' in game) {
              console.error(`      ⚠️  _group still exists after delete!`);
              game._group = undefined;
              delete game._group;
            }
            cleanupCount++;
          } catch (e) {
            console.error(`      ❌ Error deleting _group:`, e.message);
          }
        }
        if ('_groupId' in game) {
          delete game._groupId;
          cleanupCount++;
        }
        cleanedGames.add(game);
      }
    }
    // Also clean up games in rows (they're the same objects, but be thorough)
    for (const row of cube.rows) {
      for (const game of row.games) {
        if (!cleanedGames.has(game)) {
          if ('_group' in game) {
            _groupCount++;
            console.error(`   ❌ FOUND _group on game "${game.name}" (id: ${game.id}) in row!`);
            try {
              delete game._group;
              cleanupCount++;
            } catch (e) {
              console.error(`      ❌ Error deleting _group:`, e.message);
            }
          }
          if ('_groupId' in game) {
            delete game._groupId;
            cleanupCount++;
          }
          cleanedGames.add(game);
        }
      }
    }
  }
  
  if (_groupCount > 0) {
    console.error(`   ⚠️  WARNING: Found ${_groupCount} games with _group property before return!`);
  }
  console.log(`✅ Packed into ${cubes.length} cubes (cleaned ${cleanupCount} properties)`);
  return cubes;
}

// New endpoint that returns processed JSON with packed cubes
app.get('/api/games/:username', async (req, res) => {
  // Normalize username to lowercase for case-insensitive caching
  const username = normalizeUsername(req.params.username);
  const requestId = req.query.requestId || `${username}-${Date.now()}`;
  
  try {
    const { includePreordered, includeExpansions, priorities, verticalStacking, allowAlternateRotation, optimizeSpace, respectSortOrder, ensureSupport, groupExpansions, groupSeries, skipVersionCheck } = req.query;
    const shouldSkipVersionCheck = skipVersionCheck === 'true';
    
    if (!BGG_TOKEN) {
      console.error('❌ BGG API token not configured');
      sendProgress(requestId, 'Error: BGG API token not configured', { error: true });
      return res.status(500).json({ 
        error: 'BGG API token not configured' 
      });
    }

    console.log('🎮 Processing games for user:', username);
    console.log('   Options:', { includePreordered, includeExpansions, allowAlternateRotation, optimizeSpace, groupExpansions, groupSeries });
    
    sendProgress(requestId, 'Starting to process your collection...', { step: 'init' });

    // Step 1: Fetch collection with version info (check cache first)
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
    const collectionKey = `user:${username}:${includePreordered === 'true'}:${includeExpansions === 'true'}`;
    
    let collection;
    let collectionResponse;
    let collectionHash = null;
    let cachedCollection = null;
    
    // Try cache first (we'll hash the response after fetching to compare)
    console.log('📥 Checking cache for collection...');
    sendProgress(requestId, 'Fetching your collection from BoardGameGeek...', { step: 'collection' });
    
    // We need to fetch to get the hash, but we can check if we have a cached version
    // For now, we'll fetch and then check cache with the hash
    
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
        sendProgress(requestId, `Collection is being prepared, waiting ${2 + retries} seconds...`, { step: 'collection', retry: retries + 1 });
        await new Promise(resolve => setTimeout(resolve, (2 + retries) * 1000));
        retries++;
      } else {
        console.log('   ✅ Collection ready (200)');
        break;
      }
    }
    
    if (collectionResponse.status === 202) {
      sendProgress(requestId, 'Collection generation timed out', { error: true });
      throw new Error('Collection generation timed out. Please try again in a few moments.');
    }

    // Hash the raw XML response
    collectionHash = hashData(collectionResponse.data);
    
    // Check cache with hash
    cachedCollection = getCollection(collectionKey, collectionHash);
    
    if (cachedCollection) {
      console.log('   ✅ Using cached collection data');
      sendProgress(requestId, 'Using cached collection data', { step: 'collection', cached: true });
      // Reconstruct items from cached data (we need the full item structure for processing)
      // For now, we'll still parse XML but use cached data for the item list structure
      collection = await parseXmlString(collectionResponse.data);
    } else {
      console.log('   📥 Collection not in cache or changed, parsing and caching...');
      sendProgress(requestId, 'Processing collection data...', { step: 'collection', cached: false });
      collection = await parseXmlString(collectionResponse.data);
      
      // Extract and cache minimal collection data
      const collectionData = extractCollectionData(collection);
      setCollection(collectionKey, collectionHash, collectionData);
    }
    
    if (!collection.items || !collection.items.item) {
      console.warn('⚠️  No items in collection');
      return res.json({ cubes: [], totalGames: 0 });
    }

    let items = Array.isArray(collection.items.item) 
      ? collection.items.item 
      : [collection.items.item];

    console.log(`   Found ${items.length} items in collection`);
    sendProgress(requestId, `Found ${items.length} games in your collection`, { step: 'collection', count: items.length });

    const missingVersionGames = new Map();

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
      const gameName = item.name?.[0]?._ || item.name?.[0] || `ID:${gameId}`;

      if (!versionItem || !versionItem.item || versionItem.item.length === 0) {
        if (!missingVersionGames.has(gameId)) {
          missingVersionGames.set(gameId, {
            id: gameId,
            name: gameName,
            versionsUrl: buildVersionsUrl(gameId, gameName)
          });
        }
      }
      
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

    if (!shouldSkipVersionCheck && missingVersionGames.size > 0) {
      const warningGames = Array.from(missingVersionGames.values()).sort((a, b) => a.name.localeCompare(b.name));
      const warningMessage = `${warningGames.length} game${warningGames.length !== 1 ? 's' : ''} do not have a specific BoardGameGeek version selected. Selecting a version helps ensure accurate dimensions.`;
      const secondaryMessage = 'We can try to guess dimensions by checking the most recent English version first. This can take a while and may still require manual adjustments later.';

      sendProgress(requestId, 'Missing game versions detected. Waiting for user confirmation...', { step: 'warning', warningType: 'missing_versions' });

      res.json({
        status: 'missing_versions',
        requestId,
        message: warningMessage,
        details: secondaryMessage,
        games: warningGames
      });

      setTimeout(() => {
        progressStore.delete(requestId);
      }, 5000);
      return;
    }

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
    
    // Check cache for games first
    const gamesToFetch = [];
    const cachedGames = new Map();
    
    console.log(`🔍 Checking cache for ${gameIds.length} games...`);
    sendProgress(requestId, `Checking cache for ${gameIds.length} games...`, { step: 'games', total: gameIds.length });
    for (const gameId of gameIds) {
      const cached = getGame(gameId);
      if (cached) {
        cachedGames.set(gameId, cached);
      } else {
        gamesToFetch.push(gameId);
      }
    }
    
    console.log(`   ✅ ${cachedGames.size} games from cache, ${gamesToFetch.length} need fetching`);
    sendProgress(requestId, `Found ${cachedGames.size} games in cache, fetching ${gamesToFetch.length}...`, { step: 'games', cached: cachedGames.size, fetching: gamesToFetch.length });
    
    // Fetch games that aren't cached
    const batchSize = 10;
    let allGames = []; // Use 'let' so we can reassign during expansion filtering

    for (let i = 0; i < gamesToFetch.length; i += batchSize) {
      const batch = gamesToFetch.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(gamesToFetch.length / batchSize);
      console.log(`📦 Fetching batch ${batchNum}/${totalBatches} (${batch.length} games)`);
      sendProgress(requestId, `Fetching game data: batch ${batchNum}/${totalBatches}`, { step: 'games', batch: batchNum, totalBatches, gamesInBatch: batch.length });
      
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
          
          // Extract and cache game data
          const gameData = extractGameData(item);
          setGame(gameId, gameData);
          cachedGames.set(gameId, gameData);
          
          // Get all versions of this game from the collection
          const versions = gameDetailsNeeded.get(gameId) || [];
          
          // Process each version separately
          versions.forEach(({versionId}) => {
            const key = `${gameId}-${versionId}`;
            const versionInfo = versionMap.get(key);
            const game = processGameItem(item, versionInfo, versionId);

            const missingVersionInfo = missingVersionGames.get(gameId);
            game.missingVersion = !!missingVersionInfo;
            if (missingVersionInfo) {
              game.versionsUrl = missingVersionInfo.versionsUrl;
            }

            const normalizedVersionId = extractVersionId(game, versionId);
            game.selectedVersionId = normalizedVersionId;
            if (!game.versionsUrl) {
              game.versionsUrl = buildVersionsUrl(gameId, item.name?.[0]?._ || item.name?.[0] || `ID:${gameId}`);
            }
            game.usedAlternateVersionDims = false;
            game.correctionUrl = null;

            // Use gameId-versionId as unique ID
            game.id = key;
            // Preserve baseGameId from processGameItem (for expansions)
            // baseGameId is only set for expansions (pointing to their base game)
            // For regular games, it should remain null
            // Don't overwrite it - processGameItem already sets it correctly
            if (!game.baseGameId && game.isExpansion) {
              // This shouldn't happen, but if an expansion doesn't have baseGameId, something is wrong
              console.warn(`   ⚠️  Expansion "${game.name}" (${game.id}) doesn't have baseGameId`);
            }
            
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

      // No delay between batches - bggApiRequest handles rate limiting with retries
    }
    
    // Process cached games (reconstruct from cache)
    for (const gameId of Array.from(cachedGames.keys())) {
      try {
        const gameData = cachedGames.get(gameId);
        
        // CRITICAL: Check if cached game data has _group property (shouldn't happen, but check)
        if (gameData && (gameData._group !== undefined || '_group' in gameData)) {
          console.error(`   ❌ WARNING: Cached game data for ${gameId} has _group property!`);
          console.error(`      Game name: ${gameData.name || 'unknown'}`);
          delete gameData._group;
        }
        
        const versions = gameDetailsNeeded.get(gameId) || [];
        
        // Process each version
        versions.forEach(({versionId}) => {
          const key = `${gameId}-${versionId}`;
          
          // Check version cache first, then versionMap from collection
          let dimensions = null;
          const cachedVersion = getVersion(gameId, versionId);
          if (cachedVersion && cachedVersion.dimensions && !cachedVersion.dimensions.missingDimensions) {
            dimensions = cachedVersion.dimensions;
          } else {
            // Fall back to versionMap from collection
            const versionInfo = versionMap.get(key);
            if (versionInfo) {
              dimensions = {
                length: parseFloat(versionInfo.length),
                width: parseFloat(versionInfo.width),
                depth: parseFloat(versionInfo.depth),
                missingDimensions: false
              };
            }
          }
          
          // Reconstruct game from cached data - explicitly exclude _group and _groupId
          const game = {
            id: gameData.id,
            name: gameData.name,
            categories: gameData.categories,
            families: gameData.families,
            bggRank: gameData.bggRank,
            minPlayers: gameData.minPlayers,
            maxPlayers: gameData.maxPlayers,
            bestPlayerCount: gameData.bestPlayerCount,
            minPlaytime: gameData.minPlaytime,
            maxPlaytime: gameData.maxPlaytime,
            age: gameData.age,
            communityAge: gameData.communityAge,
            weight: gameData.weight,
            bggRating: gameData.bggRating,
            baseGameId: gameData.baseGameId || null,
            isExpansion: gameData.isExpansion || false,
            familyIds: gameData.familyIds || [],
            dimensions: dimensions || {
              length: 0,
              width: 0,
              depth: 0,
              missingDimensions: true
            }
          };
          
          const missingVersionInfo = missingVersionGames.get(gameId);
          game.missingVersion = !!missingVersionInfo;
          if (missingVersionInfo) {
            game.versionsUrl = missingVersionInfo.versionsUrl;
          }

          game.id = key;

          const normalizedVersionId = extractVersionId(game, versionId);
          game.selectedVersionId = normalizedVersionId;
          if (!game.versionsUrl) {
            game.versionsUrl = buildVersionsUrl(gameId, game.name || `ID:${gameId}`);
          }
          game.usedAlternateVersionDims = false;
          game.correctionUrl = null;

          if (game.dimensions?.missingDimensions || (game.dimensions.length === 0 && game.dimensions.width === 0 && game.dimensions.depth === 0)) {
            const versionIdForCorrection = extractVersionId(game, versionId);
            if (versionIdForCorrection) {
              game.correctionUrl = buildCorrectionUrl(versionIdForCorrection);
            }
          }

          if (cachedVersion?.usedAlternateVersionDims) {
            game.usedAlternateVersionDims = true;
            const versionIdForCorrection = extractVersionId(game, versionId);
            if (versionIdForCorrection) {
              game.correctionUrl = buildCorrectionUrl(versionIdForCorrection);
            } else {
              game.correctionUrl = null;
            }
            console.log(`      ↺ Using cached alternate-version dimensions for ${game.name} (version ${versionIdForCorrection || 'default'})`);
          }
          
          // Verify no _group properties slipped in
          if (game._group !== undefined || '_group' in game) {
            console.error(`   ❌ ERROR: Reconstructed game "${game.name}" (${game.id}) has _group property!`);
            delete game._group;
          }
          if (game._groupId !== undefined || '_groupId' in game) {
            delete game._groupId;
          }
          
          allGames.push(game);
        });
      } catch (error) {
        console.error(`Error processing cached game ${gameId}:`, error.message);
      }
    }

    console.log(`✅ Processed ${allGames.length} games`);
    sendProgress(requestId, `Processed ${allGames.length} games`, { step: 'games', total: allGames.length });
    
    // Step 2.5: Fetch dimensions for games with missing dimensions
    // First, check cache for any missing dimensions
    const gamesNeedingFetch = [];
    for (const game of allGames) {
      if (game.dimensions.missingDimensions || 
          (game.dimensions.length === 0 && game.dimensions.width === 0 && game.dimensions.depth === 0)) {
        // Extract versionId from game.id (format: "gameId-versionId")
        // Use baseGameId which is already set on the game object
        if (game.baseGameId && game.id) {
          const parts = game.id.split('-');
          if (parts.length >= 2) {
            // Take last part as versionId (gameId is numeric, so this is safe)
            const versionId = parts[parts.length - 1];
            const cachedVersion = getVersion(game.baseGameId, versionId);
            if (cachedVersion && cachedVersion.dimensions && !cachedVersion.dimensions.missingDimensions) {
              // Found in cache!
              game.dimensions = cachedVersion.dimensions;
              console.log(`      ✓ Found dimensions in cache for ${game.name}: ${cachedVersion.dimensions.width}"×${cachedVersion.dimensions.length}"×${cachedVersion.dimensions.depth}"`);
            } else {
              gamesNeedingFetch.push(game);
            }
          } else {
            gamesNeedingFetch.push(game);
          }
        } else {
          gamesNeedingFetch.push(game);
        }
      }
    }
    
    if (gamesNeedingFetch.length > 0) {
      console.log(`📏 Fetching dimensions for ${gamesNeedingFetch.length} games...`);
      sendProgress(requestId, `Fetching dimensions for ${gamesNeedingFetch.length} games...`, { step: 'dimensions', count: gamesNeedingFetch.length });
      
      // Process in smaller batches to avoid memory issues
      const dimBatchSize = 5;
      for (let i = 0; i < gamesNeedingFetch.length; i += dimBatchSize) {
        const batch = gamesNeedingFetch.slice(i, i + dimBatchSize);
        const batchIds = batch.map(g => g.baseGameId).filter(Boolean);
        
        if (batchIds.length === 0) continue;
        
        const dimBatchNum = Math.floor(i / dimBatchSize) + 1;
        const dimTotalBatches = Math.ceil(gamesNeedingFetch.length / dimBatchSize);
        console.log(`   📦 Dimension batch ${dimBatchNum}/${dimTotalBatches}`);
        sendProgress(requestId, `Fetching dimensions: batch ${dimBatchNum}/${dimTotalBatches}`, { step: 'dimensions', batch: dimBatchNum, totalBatches: dimTotalBatches });
        
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
              const versions = item.versions?.[0]?.item || [];
              
              // Process and cache each version
              if (Array.isArray(versions)) {
                versions.forEach(versionItem => {
                  const versionData = extractVersionData(versionItem);
                  if (versionData.versionId) {
                    setVersion(gameId, versionData.versionId, versionData);
                  }
                });
              }
              
              const dimensions = findDimensionsFromVersions(item);
              
              // Update all games with this base game ID and cache with user's versionId
              batch.forEach(game => {
                if (game.baseGameId === gameId) {
                  // Extract versionId from game.id (format: "gameId-versionId")
                  if (game.baseGameId && game.id) {
                    const parts = game.id.split('-');
                    if (parts.length >= 2) {
                      // Take last part as versionId (gameId is numeric, so this is safe)
                      const versionId = parts[parts.length - 1];
                      
                      if (dimensions && !dimensions.missingDimensions) {
                        // Found dimensions from alternate version
                        game.dimensions = dimensions;
                        console.log(`      ✓ Found dimensions for ${game.name}: ${dimensions.width}"×${dimensions.length}"×${dimensions.depth}"`);
                        
                        // Cache the dimensions with the user's actual versionId
                        const versionDataToCache = {
                          versionId: versionId,
                          name: null,
                          yearPublished: null,
                          dimensions: dimensions,
                          usedAlternateVersionDims: !game.missingVersion
                        };
                        setVersion(game.baseGameId, versionId, versionDataToCache);

                        if (!game.missingVersion) {
                          game.usedAlternateVersionDims = true;
                          const versionIdForCorrection = extractVersionId(game, versionId);
                          if (versionIdForCorrection) {
                            game.correctionUrl = buildCorrectionUrl(versionIdForCorrection);
                          } else {
                            game.correctionUrl = null;
                          }
                          console.log(`      🔄 Used alternate version dimensions for selected version of ${game.name} (version ${versionIdForCorrection || 'default'})`);
                        }
                      } else {
                        // No dimensions found - cache default dimensions
                        const defaultDimensions = {
                          length: 12.8,
                          width: 12.8,
                          depth: 1.8,
                          missingDimensions: true
                        };
                        
                        const versionDataToCache = {
                          versionId: versionId,
                          name: null,
                          yearPublished: null,
                          dimensions: defaultDimensions,
                          usedAlternateVersionDims: false
                        };
                        setVersion(game.baseGameId, versionId, versionDataToCache);
                        game.usedAlternateVersionDims = false;
                        const versionIdForCorrection = extractVersionId(game, versionId);
                        if (versionIdForCorrection) {
                          game.correctionUrl = buildCorrectionUrl(versionIdForCorrection);
                        } else {
                          game.correctionUrl = null;
                        }
                      }
                    }
                  }
                }
              });
            });
          }
          
          // No delay between batches - bggApiRequest handles rate limiting with retries
        } catch (error) {
          console.error(`   ❌ Error fetching dimensions for batch: ${error.message}`);
        }
      }
    }
    
    // Step 2.6: Apply default dimensions to any games still missing dimensions and cache them
    let gamesWithDefaultDimensions = 0;
    allGames.forEach(game => {
      if (game.dimensions.length === 0 && game.dimensions.width === 0 && game.dimensions.depth === 0) {
        const defaultDimensions = {
          length: 12.8,
          width: 12.8,
          depth: 1.8,
          missingDimensions: true,
        };
        game.dimensions = defaultDimensions;
        game.usedAlternateVersionDims = false;
        if (game.selectedVersionId) {
          game.correctionUrl = buildCorrectionUrl(game.selectedVersionId);
        } else {
          game.correctionUrl = null;
        }
        gamesWithDefaultDimensions++;
        
        // Cache default dimensions with the user's actual versionId
        if (game.baseGameId && game.id) {
          const parts = game.id.split('-');
          if (parts.length >= 2) {
            const versionId = parts[parts.length - 1];
            const versionDataToCache = {
              versionId: versionId,
              name: null,
              yearPublished: null,
              dimensions: defaultDimensions,
              usedAlternateVersionDims: false
            };
            setVersion(game.baseGameId, versionId, versionDataToCache);
          }
        }
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
    sendProgress(requestId, `Packing ${uniqueGames.length} games into cubes...`, { step: 'packing', gameCount: uniqueGames.length });
    const parsedPriorities = priorities ? JSON.parse(priorities) : [];
    const isVertical = verticalStacking === 'true';
    const allowAltRotation = allowAlternateRotation === 'true';
    const shouldOptimizeSpace = optimizeSpace === 'true';
    const strictSortOrder = respectSortOrder === 'true';
    const shouldEnsureSupport = ensureSupport === 'true';
    const shouldGroupExpansions = !shouldOptimizeSpace && groupExpansions === 'true' && includeExpansions === 'true';
    const shouldGroupSeries = !shouldOptimizeSpace && groupSeries === 'true';

    if (shouldOptimizeSpace && (groupExpansions === 'true' || groupSeries === 'true')) {
      console.log('   ℹ️  Optimize for space enabled – grouping options disabled for this run');
    }
    
    const packedCubes = packGamesIntoCubes(uniqueGames, parsedPriorities, isVertical, allowAltRotation, shouldOptimizeSpace, strictSortOrder, shouldEnsureSupport, shouldGroupExpansions, shouldGroupSeries);
    
    sendProgress(requestId, `Complete! Packed into ${packedCubes.length} cubes`, { step: 'complete', cubes: packedCubes.length, games: uniqueGames.length });
    
    // CRITICAL: Check for circular refs BEFORE attempting serialization
    console.log('   🔍 Deep circular reference check before serialization...');
    console.log(`   Checking ${packedCubes.length} cubes...`);
    
    let lastGoodCube = -1;
    let lastGoodRow = -1;
    let lastGoodGame = -1;
    
    // Iterate through cubes, rows, and games to find the problematic one
    for (let cubeIdx = 0; cubeIdx < packedCubes.length; cubeIdx++) {
      const cube = packedCubes[cubeIdx];
      console.log(`   Checking cube ${cubeIdx + 1}/${packedCubes.length} (id: ${cube.id})...`);
      
      // Check games directly on cube
      if (cube.games && Array.isArray(cube.games)) {
        for (let gameIdx = 0; gameIdx < cube.games.length; gameIdx++) {
          const game = cube.games[gameIdx];
          try {
            // Try to serialize just this game to see if it has circular refs
            JSON.stringify(game, (key, value) => {
              if (key === '_group') {
                console.error(`   ❌ FOUND _group property on game "${game.name}" (id: ${game.id}) in cube ${cubeIdx + 1}, game index ${gameIdx}`);
                console.error(`      Path: cube[${cubeIdx}].games[${gameIdx}].${key}`);
                return undefined; // Remove _group from serialization
              }
              if (key === '_groupId') {
                return undefined; // Remove _groupId too
              }
              return value;
            });
            lastGoodGame = gameIdx;
            lastGoodCube = cubeIdx;
          } catch (e) {
            console.error(`   ❌ CIRCULAR REF ERROR at cube ${cubeIdx + 1}, game index ${gameIdx}`);
            console.error(`      Game: "${game?.name || 'unknown'}" (id: ${game?.id || 'unknown'})`);
            console.error(`      Error: ${e.message}`);
            console.error(`      Last good position: cube ${lastGoodCube + 1}, game ${lastGoodGame}`);
            
            // Try to identify the circular path
            const allProps = Object.getOwnPropertyNames(game);
            console.error(`      Game properties: ${allProps.slice(0, 20).join(', ')}`);
            if (allProps.includes('_group')) {
              console.error(`      ⚠️  _group property exists!`);
              try {
                const groupValue = game._group;
                console.error(`      _group type: ${typeof groupValue}, isArray: ${Array.isArray(groupValue)}`);
                if (Array.isArray(groupValue)) {
                  console.error(`      _group length: ${groupValue.length}`);
                  if (groupValue.includes(game)) {
                    console.error(`      ❌ CIRCULAR: _group array contains the game itself!`);
                  }
                }
              } catch (e2) {
                console.error(`      Error inspecting _group: ${e2.message}`);
              }
            }
            
            // Don't throw, continue to check others
          }
        }
      }
      
      // Check games in rows
      if (cube.rows && Array.isArray(cube.rows)) {
        for (let rowIdx = 0; rowIdx < cube.rows.length; rowIdx++) {
          const row = cube.rows[rowIdx];
          if (row.games && Array.isArray(row.games)) {
            for (let gameIdx = 0; gameIdx < row.games.length; gameIdx++) {
              const game = row.games[gameIdx];
              try {
                // Try to serialize just this game
                JSON.stringify(game, (key, value) => {
                  if (key === '_group') {
                    console.error(`   ❌ FOUND _group property on game "${game.name}" (id: ${game.id}) in cube ${cubeIdx + 1}, row ${rowIdx}, game index ${gameIdx}`);
                    console.error(`      Path: cube[${cubeIdx}].rows[${rowIdx}].games[${gameIdx}].${key}`);
                    return undefined;
                  }
                  if (key === '_groupId') {
                    return undefined;
                  }
                  return value;
                });
                lastGoodRow = rowIdx;
                lastGoodGame = gameIdx;
              } catch (e) {
                console.error(`   ❌ CIRCULAR REF ERROR at cube ${cubeIdx + 1}, row ${rowIdx}, game index ${gameIdx}`);
                console.error(`      Game: "${game?.name || 'unknown'}" (id: ${game?.id || 'unknown'})`);
                console.error(`      Error: ${e.message}`);
                console.error(`      Last good position: cube ${lastGoodCube + 1}, row ${lastGoodRow}, game ${lastGoodGame}`);
                
                // Try to identify the circular path
                const allProps = Object.getOwnPropertyNames(game);
                console.error(`      Game properties: ${allProps.slice(0, 20).join(', ')}`);
                if (allProps.includes('_group')) {
                  console.error(`      ⚠️  _group property exists!`);
                  try {
                    const groupValue = game._group;
                    console.error(`      _group type: ${typeof groupValue}, isArray: ${Array.isArray(groupValue)}`);
                    if (Array.isArray(groupValue)) {
                      console.error(`      _group length: ${groupValue.length}`);
                      if (groupValue.includes(game)) {
                        console.error(`      ❌ CIRCULAR: _group array contains the game itself!`);
                      }
                    }
                  } catch (e2) {
                    console.error(`      Error inspecting _group: ${e2.message}`);
                  }
                }
              }
            }
          }
        }
      }
    }
    
    console.log(`   ✅ Circular ref check complete. Last good position: cube ${lastGoodCube + 1}, row ${lastGoodRow}, game ${lastGoodGame}`);
    
    // Skip all cleanup attempts - go straight to creating clean copies
    // This avoids any issues with circular references during cleanup
    console.log('   🧹 Creating clean copies of all objects (bypassing cleanup)...');
    
    try {
      const cleanCubes = [];
      let gameCount = 0;
      
      for (let cubeIdx = 0; cubeIdx < packedCubes.length; cubeIdx++) {
        const cube = packedCubes[cubeIdx];
        const cleanCube = {
          id: cube.id,
          currentHeight: cube.currentHeight,
          currentWidth: cube.currentWidth,
          rows: [],
          games: []
        };
        
        // Copy rows with clean games
        for (const row of cube.rows || []) {
          const cleanRow = {
            heightUsed: row.heightUsed,
            widthUsed: row.widthUsed,
            games: []
          };
          
          for (const game of row.games || []) {
            gameCount++;
            try {
              // Check if game has _group before accessing any properties
              if (game && typeof game === 'object') {
                const gameProps = Object.getOwnPropertyNames(game);
                if (gameProps.includes('_group')) {
                  console.error(`   ⚠️  Game "${game.name || 'unknown'}" (id: ${game.id || 'no-id'}) has _group property in row of cube ${cubeIdx + 1}`);
                }
              }
              
              // Create a completely new object with only the properties we want
              // Use safe property access and create new objects for nested properties
              const cleanGame = {
                id: game.id,
                name: game.name,
                dimensions: game.dimensions ? { ...game.dimensions } : game.dimensions,
                position: game.position ? { ...game.position } : game.position,
                packedDims: game.packedDims ? { ...game.packedDims } : game.packedDims,
                actualDims: game.actualDims ? { ...game.actualDims } : game.actualDims,
                orientedDims: game.orientedDims ? { ...game.orientedDims } : game.orientedDims,
                actualOrientedDims: game.actualOrientedDims ? { ...game.actualOrientedDims } : game.actualOrientedDims,
                oversizedX: game.oversizedX,
                oversizedY: game.oversizedY,
                categories: game.categories ? [...(game.categories || [])] : [],
                families: game.families ? [...(game.families || [])] : [],
                bggRank: game.bggRank,
                minPlayers: game.minPlayers,
                maxPlayers: game.maxPlayers,
                bestPlayerCount: game.bestPlayerCount,
                minPlaytime: game.minPlaytime,
                maxPlaytime: game.maxPlaytime,
                age: game.age,
                communityAge: game.communityAge,
                weight: game.weight,
                bggRating: game.bggRating,
                baseGameId: game.baseGameId,
                isExpansion: game.isExpansion,
                familyIds: game.familyIds ? [...(game.familyIds || [])] : [],
                missingVersion: !!game.missingVersion,
                versionsUrl: game.versionsUrl || null,
                usedAlternateVersionDims: !!game.usedAlternateVersionDims,
                correctionUrl: game.correctionUrl || null
              };
              
              // Explicitly verify _group and _groupId are NOT in cleanGame
              // (they shouldn't be since we're creating from scratch)
              if ('_group' in cleanGame) {
                console.error(`   ⚠️  ERROR: _group appeared in cleanGame for "${game.name}"! This shouldn't happen!`);
                delete cleanGame._group;
              }
              if ('_groupId' in cleanGame) {
                delete cleanGame._groupId;
              }
              
              cleanRow.games.push(cleanGame);
            } catch (gameError) {
              console.error(`   ❌ Error creating cleanGame for "${game?.name || 'unknown'}" in row:`, gameError.message);
              console.error(`   Stack:`, gameError.stack);
              // Skip this game if we can't create a clean copy
            }
          }
          
          cleanCube.rows.push(cleanRow);
        }
        
        // Copy games directly on cube
        for (const game of cube.games || []) {
          try {
            // Check for _group before creating cleanGame
            if (game && typeof game === 'object') {
              const gameProps = Object.getOwnPropertyNames(game);
              if (gameProps.includes('_group')) {
                console.error(`   ⚠️  Game "${game.name || 'unknown'}" (id: ${game.id || 'no-id'}) has _group property in cube.games of cube ${cubeIdx + 1}`);
              }
            }
            
            const cleanGame = {
              id: game.id,
              name: game.name,
              dimensions: game.dimensions ? { ...game.dimensions } : game.dimensions,
              position: game.position ? { ...game.position } : game.position,
              packedDims: game.packedDims ? { ...game.packedDims } : game.packedDims,
              actualDims: game.actualDims ? { ...game.actualDims } : game.actualDims,
              orientedDims: game.orientedDims ? { ...game.orientedDims } : game.orientedDims,
              actualOrientedDims: game.actualOrientedDims ? { ...game.actualOrientedDims } : game.actualOrientedDims,
              oversizedX: game.oversizedX,
              oversizedY: game.oversizedY,
              categories: game.categories ? [...(game.categories || [])] : [],
              families: game.families ? [...(game.families || [])] : [],
              bggRank: game.bggRank,
              minPlayers: game.minPlayers,
              maxPlayers: game.maxPlayers,
              bestPlayerCount: game.bestPlayerCount,
              minPlaytime: game.minPlaytime,
              maxPlaytime: game.maxPlaytime,
              age: game.age,
              communityAge: game.communityAge,
              weight: game.weight,
              bggRating: game.bggRating,
              baseGameId: game.baseGameId,
              isExpansion: game.isExpansion,
              familyIds: game.familyIds ? [...(game.familyIds || [])] : [],
              missingVersion: !!game.missingVersion,
              versionsUrl: game.versionsUrl || null,
              usedAlternateVersionDims: !!game.usedAlternateVersionDims,
              correctionUrl: game.correctionUrl || null
            };
            
            // Verify _group is NOT in cleanGame (it shouldn't be)
            if ('_group' in cleanGame) {
              console.error(`   ⚠️  ERROR: _group appeared in cleanGame for "${game.name}" in cube.games! This shouldn't happen!`);
              delete cleanGame._group;
            }
            if ('_groupId' in cleanGame) {
              delete cleanGame._groupId;
            }
            
            cleanCube.games.push(cleanGame);
          } catch (gameError) {
            console.error(`   ❌ Error creating cleanGame for "${game?.name || 'unknown'}" in cube.games:`, gameError.message);
            // Skip this game if we can't create a clean copy
          }
        }
        
        cleanCubes.push(cleanCube);
      }
      
      console.log(`   ✅ Clean copies created for ${gameCount} games in ${cleanCubes.length} cubes`);
      console.log('   📤 Attempting JSON serialization...');

      const dimensionSummary = {
        guessedVersionCount: 0,
        selectedVersionFallbackCount: 0,
        missingDimensionCount: 0,
        exceedingCapacityCount: 0,
      };

      for (const cube of cleanCubes) {
        for (const game of cube.games) {
          if (game.missingVersion) {
            dimensionSummary.guessedVersionCount++;
          }
          if (game.usedAlternateVersionDims) {
            dimensionSummary.selectedVersionFallbackCount++;
          }
          if (game.dimensions?.missingDimensions) {
            dimensionSummary.missingDimensionCount++;
          }
          if (game.oversizedX || game.oversizedY) {
            dimensionSummary.exceedingCapacityCount++;
          }
        }
      }

      console.log('   ℹ️ Dimension summary:', dimensionSummary);
      
      // Final check - make absolutely sure no _group properties exist
      let finalCheckCount = 0;
      for (const cube of cleanCubes) {
        for (const row of cube.rows) {
          for (const game of row.games) {
            if ('_group' in game || '_groupId' in game) {
              finalCheckCount++;
              console.error(`   ❌ FINAL CHECK: Found _group in clean copy of "${game.name}"!`);
              delete game._group;
              delete game._groupId;
            }
          }
        }
        for (const game of cube.games) {
          if ('_group' in game || '_groupId' in game) {
            finalCheckCount++;
            console.error(`   ❌ FINAL CHECK: Found _group in clean copy of "${game.name}"!`);
            delete game._group;
            delete game._groupId;
          }
        }
      }
      
      if (finalCheckCount > 0) {
        console.error(`   ⚠️  WARNING: Found ${finalCheckCount} _group properties in clean copies!`);
      }
      
      res.json({ cubes: cleanCubes, totalGames: uniqueGames.length, dimensionSummary });
      console.log('   ✅ JSON response sent successfully');
      
    } catch (jsonError) {
      console.error('   ❌ JSON serialization error:', jsonError.message);
      console.error('   Stack:', jsonError.stack);
      res.status(500).json({ error: 'Failed to serialize response. Please try again.' });
    }
    
    // Clean up progress store after a delay
    setTimeout(() => {
      progressStore.delete(requestId);
    }, 5000);

  } catch (error) {
    console.error('❌ Error processing games:', error.message);
    console.error('   Stack trace:', error.stack);
    sendProgress(requestId, `Error: ${error.message}`, { error: true, message: error.message });
    res.status(500).json({ error: error.message });
    
    // Clean up progress store
    setTimeout(() => {
      progressStore.delete(requestId);
    }, 5000);
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
  
  // Extract family IDs (for series grouping)
  const familyIds = item.link
    ?.filter(l => l.$.type === 'boardgamefamily')
    .map(l => l.$.id) || [];
  
  // Extract expansion relationships (base game ID if this is an expansion)
  const expansionLinks = item.link
    ?.filter(l => l.$.type === 'boardgameexpansion') || [];
  
  let baseGameId = null;
  if (expansionLinks.length > 0) {
    // Take the first expansion link's ID as the base game
    // (expansions typically link to one base game)
    baseGameId = expansionLinks[0].$.id || null;
  }
  
  // Determine if this is an expansion
  const isExpansion = baseGameId !== null || 
    item.$.type === 'boardgameexpansion' ||
    categories.includes('Expansion for Base-game');

  const resolvedBaseGameId = baseGameId || gameId;

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
    // Grouping fields
    baseGameId: resolvedBaseGameId,   // Use base game ID or self ID for grouping/cache
    isExpansion,  // True if this game is an expansion
    familyIds,    // Array of family/series IDs for grouping
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
    // Normalize username to lowercase for case-insensitive caching
    const username = normalizeUsername(req.params.username);
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

// Admin endpoints for cache management
const CACHE_ADMIN_PASSWORD = process.env.CACHE_ADMIN_PASSWORD;

// Middleware to check admin password
const checkAdminAuth = (req, res, next) => {
  const providedPassword = req.headers['x-admin-password'] || req.body.password;
  
  if (!CACHE_ADMIN_PASSWORD) {
    return res.status(500).json({ error: 'Admin password not configured' });
  }
  
  if (providedPassword !== CACHE_ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  next();
};

// Get cache statistics
app.get('/api/admin/cache/stats', checkAdminAuth, (req, res) => {
  try {
    const stats = getStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting cache stats:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Clear cache
app.post('/api/admin/cache/clear', checkAdminAuth, (req, res) => {
  try {
    const success = clearCache();
    if (success) {
      res.json({ message: 'Cache cleared successfully' });
    } else {
      res.status(500).json({ error: 'Failed to clear cache' });
    }
  } catch (error) {
    console.error('Error clearing cache:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Run cleanup
app.post('/api/admin/cache/cleanup', checkAdminAuth, (req, res) => {
  try {
    const result = cleanup();
    if (result) {
      res.json({ message: 'Cleanup completed', result });
    } else {
      res.status(500).json({ error: 'Cleanup failed' });
    }
  } catch (error) {
    console.error('Error running cleanup:', error.message);
    res.status(500).json({ error: error.message });
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
  
  // Run cleanup on startup
  console.log('🧹 Running initial cache cleanup...');
  cleanup();
  
  // Schedule hourly cleanup
  setInterval(() => {
    console.log('🧹 Running scheduled cache cleanup...');
    cleanup();
  }, 3600 * 1000); // 1 hour
  
  console.log('✅ Cache cleanup scheduled (every hour)');
});

