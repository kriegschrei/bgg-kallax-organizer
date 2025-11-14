const progressState = new Map();
const activeRequests = new Set();

// Board game themed progress messages
const BOARD_GAME_MESSAGES = [
  'Punching cardboard',
  'Painting minis',
  'Reading rules',
  'Organizing game night',
  'Shuffling decks',
  'Rolling dice',
  'Counting victory points',
  'Setting up the board',
  'Teaching new players',
  'Trading resources',
  'Building settlements',
  'Drafting cards',
  'Placing workers',
  'Moving meeples',
  'Collecting sets',
  'Negotiating trades',
  'Planning strategy',
  'Checking BGG ratings',
  'Comparing editions',
  'Measuring box sizes',
  'Sorting expansions',
  'Cataloging games',
  'Updating wishlist',
  'Reviewing rules',
  'Checking player counts',
  'Calculating playtime',
  'Organizing shelves',
  'Fitting in Kallax',
  'Optimizing space',
  'Grouping by theme',
  'Sorting by weight',
  'Arranging by size',
  'Stacking boxes',
  'Finding expansions',
  'Matching versions',
  'Verifying dimensions',
  'Checking cache',
  'Fetching details',
  'Parsing XML',
  'Mapping collections',
  'Building entries',
  'Processing versions',
  'Validating data',
  'Calculating volumes',
  'Finding alternates',
  'Applying overrides',
  'Filtering games',
  'Removing duplicates',
  'Preparing cubes',
  'Packing games',
  'Optimizing layout',
  'Rotating boxes',
  'Grouping series',
  'Matching expansions',
  'Checking dimensions',
  'Validating entries',
  'Building game objects',
  'Setting metadata',
  'Creating URLs',
  'Collecting versions',
  'Comparing editions',
  'Selecting best fit',
  'Organizing collection',
  'Processing batches',
  'Fetching from BGG',
  'Caching results',
  'Merging data',
  'Building responses',
  'Serializing cubes',
  'Finalizing results',
  'Checking statuses',
  'Filtering expansions',
  'Deduplicating entries',
  'Applying filters',
  'Building version keys',
  'Collecting cached data',
  'Refreshing games',
  'Merging collections',
  'Processing items',
  'Validating versions',
  'Finding dimensions',
  'Calculating areas',
  'Building entries',
  'Organizing metadata',
  'Preparing for packing',
  'Checking overrides',
  'Applying customizations',
  'Sorting games',
  'Grouping by series',
  'Matching base games',
  'Finding related items',
  'Building game list',
  'Preparing visualization',
  'Finalizing organization',
];

export const getRandomBoardGameMessage = () => {
  const randomIndex = Math.floor(Math.random() * BOARD_GAME_MESSAGES.length);
  return BOARD_GAME_MESSAGES[randomIndex];
};

export const registerRequest = (requestId) => {
  if (requestId) {
    activeRequests.add(requestId);
  }
};

export const sendProgressUpdate = (requestId, message, data = {}) => {
  if (!requestId) {
    return;
  }

  const payload = {
    requestId,
    message,
    ...data,
    timestamp: Date.now(),
  };

  progressState.set(requestId, payload);
};

export const getProgressById = (requestId) => {
  if (!requestId) {
    return null;
  }
  return progressState.get(requestId) ?? null;
};

export const clearProgress = (requestId) => {
  progressState.delete(requestId);
  activeRequests.delete(requestId);
};

export const scheduleProgressCleanup = (requestId, delayMs = 5000) => {
  if (!requestId) {
    return;
  }
  setTimeout(() => {
    clearProgress(requestId);
  }, delayMs);
};

export const isRequestRegistered = (requestId) => activeRequests.has(requestId);

