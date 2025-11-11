import { getGame } from '../../cache.js';
import { COLLECTION_STATUS_KEYS } from '../utils/gameUtils.js';
import { packGamesIntoCubes } from './packingService.js';
import { BGG_API_TOKEN } from './configService.js';
import { fetchCollection, filterCollectionItems, removeDuplicateVersions, detectMissingVersions } from './collectionService.js';
import {
  buildVersionMap,
  buildGameDetailsMap,
  fetchAndProcessGames,
  processCachedGames,
  filterExpansionsFromGames,
  removeDuplicateGames,
} from './gameProcessingService.js';
import {
  findGamesNeedingDimensions,
  fetchDimensionsForGames,
  applyDefaultDimensions,
} from './dimensionService.js';
import { buildOverrideMaps, applyOverridesToGames } from './overrideService.js';
import { serializeCubesResponse } from './responseSerializer.js';

const getPrioritiesFromSort = (sort = []) =>
  Array.isArray(sort)
    ? sort
        .filter((rule) => rule?.field)
        .map((rule) => ({
          field: rule.field,
          order: rule.order === 'desc' ? 'desc' : 'asc',
        }))
    : [];

const normalizeBooleanFlag = (value, defaultValue = false) =>
  typeof value === 'boolean' ? value : defaultValue;

export const mapStatusesToIncludeExclude = (statuses = {}) => {
  const includeStatuses = [];
  const excludeStatuses = [];

  COLLECTION_STATUS_KEYS.forEach((key) => {
    const value = statuses[key];
    if (value === 'include') {
      includeStatuses.push(key);
    } else if (value === 'exclude') {
      excludeStatuses.push(key);
    }
  });

  if (includeStatuses.length === 0) {
    includeStatuses.push('own');
  }

  return { includeStatuses, excludeStatuses };
};

export const processGamesRequest = async ({
  payload,
  username,
  requestId,
  onProgress,
}) => {
  const progress = typeof onProgress === 'function' ? onProgress : () => {};
  
  if (!BGG_API_TOKEN) {
    console.error('❌ BGG API token not configured');
    progress(requestId, 'Error: BGG API token not configured', { error: true });
    throw new Error('BGG API token not configured');
  }

  const { includeStatuses, excludeStatuses } = mapStatusesToIncludeExclude(payload.statuses);

  const stacking = payload.stacking || 'horizontal';
  const lockRotationFlag = normalizeBooleanFlag(payload.lockRotation);
  const optimizeSpaceFlag = normalizeBooleanFlag(payload.optimizeSpace);
  const respectSortOrderFlag = normalizeBooleanFlag(payload.respectSortOrder);
  const fitOversizedFlag = normalizeBooleanFlag(payload.fitOversized);
  const groupExpansionsFlag = normalizeBooleanFlag(payload.groupExpansions);
  const groupSeriesFlag = normalizeBooleanFlag(payload.groupSeries);
  const includeExpansionsFlag = normalizeBooleanFlag(payload.includeExpansions);
  const bypassVersionWarning = normalizeBooleanFlag(payload.bypassVersionWarning);

  const sortRules = getPrioritiesFromSort(payload.sort);
  const overridesPayload = payload.overrides || {};

  console.log('🎮 Processing games for user:', username);
  console.log('   Options:', {
    includeStatuses,
    excludeStatuses,
    includeExpansions: includeExpansionsFlag,
    stacking,
    lockRotation: lockRotationFlag,
    optimizeSpace: optimizeSpaceFlag,
    fitOversized: fitOversizedFlag,
    groupExpansions: groupExpansionsFlag,
    groupSeries: groupSeriesFlag,
  });

  progress(requestId, 'Starting to process your collection...', { step: 'init' });

  // Fetch and parse collection
  const { collection } = await fetchCollection(
    username,
    includeStatuses,
    includeExpansionsFlag,
    requestId,
    progress,
  );

  if (!collection.items || !collection.items.item) {
    console.warn('⚠️  No items in collection');
    return {
      cubes: [],
      totalGames: 0,
      message: 'No games were found in the BoardGameGeek collection for this username.',
    };
  }

  let items = Array.isArray(collection.items.item)
    ? collection.items.item
    : [collection.items.item];

  console.log(`   Found ${items.length} items in collection`);
  progress(requestId, `Found ${items.length} games in your collection`, {
    step: 'collection',
    count: items.length,
  });

  // Filter collection items
  items = filterCollectionItems(items, includeStatuses, excludeStatuses, includeExpansionsFlag);

  if (items.length === 0) {
    progress(requestId, 'No games matched the selected collection filters.', {
      step: 'collection',
      count: 0,
    });
    return {
      cubes: [],
      totalGames: 0,
      message: 'No games matched the selected collection filters.',
    };
  }

  // Remove duplicate versions
  items = removeDuplicateVersions(items);

  if (items.length === 0) {
    return {
      cubes: [],
      totalGames: 0,
      message: 'No games matched the selected filters.',
    };
  }

  // Detect missing versions
  const missingVersionGames = detectMissingVersions(items);

  if (!bypassVersionWarning && missingVersionGames.size > 0) {
    const warningGames = Array.from(missingVersionGames.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    const warningMessage = `${warningGames.length} game${
      warningGames.length !== 1 ? 's' : ''
    } do not have a specific BoardGameGeek version selected. Selecting a version helps ensure accurate dimensions.`;
    const secondaryMessage =
      'We can try to guess dimensions by checking the most recent English version first. This can take a while and may still require manual adjustments later.';

    progress(requestId, 'Missing game versions detected. Waiting for user confirmation...', {
      step: 'warning',
      warningType: 'missing_versions',
    });

    return {
      status: 'missing_versions',
      requestId,
      message: warningMessage,
      details: secondaryMessage,
      games: warningGames,
    };
  }

  // Build version map and game details map
  const versionMap = buildVersionMap(items, missingVersionGames);
  const gameDetailsNeeded = buildGameDetailsMap(items);

  const gameIds = Array.from(gameDetailsNeeded.keys());

  // Check cache for games
  const gamesToFetch = [];
  const cachedGames = new Map();

  console.log(`🔍 Checking cache for ${gameIds.length} games...`);
  progress(requestId, `Checking cache for ${gameIds.length} games...`, {
    step: 'games',
    total: gameIds.length,
  });
  
  for (const gameId of gameIds) {
    const cached = getGame(gameId);
    if (cached) {
      cachedGames.set(gameId, cached);
    } else {
      gamesToFetch.push(gameId);
    }
  }

  console.log(
    `   ✅ ${cachedGames.size} games from cache, ${gamesToFetch.length} need fetching`,
  );
  progress(
    requestId,
    `Found ${cachedGames.size} games in cache, fetching ${gamesToFetch.length}...`,
    { step: 'games', cached: cachedGames.size, fetching: gamesToFetch.length },
  );

  // Fetch and process games
  const { allGames: fetchedGames, cachedGames: updatedCachedGames } =
    await fetchAndProcessGames(
      gamesToFetch,
      gameDetailsNeeded,
      versionMap,
      missingVersionGames,
      requestId,
      progress,
    );

  // Process cached games
  const cachedProcessedGames = processCachedGames(
    updatedCachedGames.size > 0 ? updatedCachedGames : cachedGames,
    gameDetailsNeeded,
    versionMap,
    missingVersionGames,
  );

  const allGames = [...fetchedGames, ...cachedProcessedGames];

  console.log(`✅ Processed ${allGames.length} games`);
  progress(requestId, `Processed ${allGames.length} games`, {
    step: 'games',
    total: allGames.length,
  });

  // Fetch dimensions for games that need them
  const gamesNeedingFetch = findGamesNeedingDimensions(allGames);
  await fetchDimensionsForGames(gamesNeedingFetch, requestId, progress);

  // Apply default dimensions where needed
  applyDefaultDimensions(allGames);

  // Filter expansions if needed
  const filteredGames = filterExpansionsFromGames(allGames, includeExpansionsFlag);

  // Remove duplicates
  const uniqueGames = removeDuplicateGames(filteredGames);

  console.log(
    `   ℹ️  Total items to pack: ${uniqueGames.length} (includes multiple versions of same games)`,
  );

  // Apply overrides
  const overrideMaps = buildOverrideMaps(overridesPayload);
  const preparedGames = applyOverridesToGames(uniqueGames, overrideMaps);

  const gamesToPack = preparedGames;

  // Clean up memory
  versionMap.clear();
  items.length = 0;
  allGames.length = 0;

  if (global.gc) {
    console.log('   🗑️  Running garbage collection...');
    global.gc();
  }

  progress(requestId, `Packing ${gamesToPack.length} games into cubes...`, {
    step: 'packing',
    gameCount: gamesToPack.length,
  });

  const shouldGroupExpansions =
    !optimizeSpaceFlag && groupExpansionsFlag && includeExpansionsFlag;
  const shouldGroupSeries = !optimizeSpaceFlag && groupSeriesFlag;

  if (optimizeSpaceFlag && (groupExpansionsFlag || groupSeriesFlag)) {
    console.log('   ℹ️  Optimize for space enabled – grouping options disabled for this run');
  }

  const { cubes: packedCubes, oversizedExcludedGames } = packGamesIntoCubes(
    gamesToPack,
    sortRules,
    stacking,
    lockRotationFlag,
    optimizeSpaceFlag,
    respectSortOrderFlag,
    fitOversizedFlag,
    shouldGroupExpansions,
    shouldGroupSeries,
  );

  progress(requestId, `Complete! Packed into ${packedCubes.length} cubes`, {
    step: 'complete',
    cubes: packedCubes.length,
    games: gamesToPack.length,
  });

  // Serialize response
  return serializeCubesResponse(packedCubes, gamesToPack, stacking, oversizedExcludedGames);
};
