import { fetchUserCollectionWithDetails } from './bggService.js';
import { packGamesIntoCubes } from './packingService.js';
import { BGG_API_TOKEN } from './configService.js';
import { buildOverrideMaps, applyOverridesToGames } from './overrideService.js';
import { serializeCubesResponse } from './responseSerializer.js';
import {
  DEFAULT_DIMENSIONS,
  getFallbackVersionLabel,
  hasMissingDimensions,
  removeInternalProperties,
  setupGameVersionMetadata,
  updateGameCorrectionUrl,
} from '../utils/gameProcessingHelpers.js';
import { buildVersionsUrl, COLLECTION_STATUS_KEYS } from '../utils/gameUtils.js';

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

const matchesIncludeStatuses = (entry, includeStatuses) =>
  includeStatuses.some((status) => Boolean(entry.statuses?.[status]));

const matchesExcludeStatuses = (entry, excludeStatuses) =>
  excludeStatuses.some((status) => Boolean(entry.statuses?.[status]));

const filterVersionEntries = (entries, includeStatuses, excludeStatuses, includeExpansions) =>
  entries
    .filter((entry) => matchesIncludeStatuses(entry, includeStatuses))
    .filter((entry) => !matchesExcludeStatuses(entry, excludeStatuses))
    .filter((entry) => includeExpansions || !entry.isExpansion);

const dedupeVersionEntries = (entries) => {
  const seen = new Set();
  return entries.filter((entry) => {
    const key = entry.versionKey || `${entry.gameId}-${entry.versionId ?? 'default'}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const detectMissingVersionSelections = (entries) => {
  const missing = new Map();

  entries.forEach((entry) => {
    const gameId = entry.gameId;
    if (!gameId || gameId === -1) {
      return;
    }

    if ((entry.versionId === -1 || entry.versionId === null) && !missing.has(gameId)) {
      const name = entry.name || `ID:${gameId}`;
      missing.set(gameId, {
        id: gameId,
        name,
        versionsUrl: buildVersionsUrl(gameId, name),
      });
    }
  });

  return missing;
};

const computeVolume = (length, width, depth) => {
  if (![length, width, depth].every((value) => Number.isFinite(value) && value > 0)) {
    return -1;
  }
  return length * width * depth;
};

const computeFootprintArea = (length, width, depth) => {
  if (![length, width, depth].every((value) => Number.isFinite(value) && value > 0)) {
    return -1;
  }
  const dims = [length, width, depth].sort((a, b) => a - b);
  return dims[0] * dims[1];
};

const toDimensionsObject = (length, width, depth, missingDimensions) => ({
  length,
  width,
  depth,
  missingDimensions,
});

const resolveDimensionsForEntry = (entry) => {
  const dims = entry.dimensions || {};
  const hasValidDimensions =
    Number.isFinite(dims.length) &&
    dims.length > 0 &&
    Number.isFinite(dims.width) &&
    dims.width > 0 &&
    Number.isFinite(dims.depth) &&
    dims.depth > 0;

  if (!entry.missingDimensions && hasValidDimensions) {
    return {
      dimensions: toDimensionsObject(dims.length, dims.width, dims.depth, false),
      volume: Number.isFinite(entry.volume) && entry.volume > 0 ? entry.volume : computeVolume(dims.length, dims.width, dims.depth),
      area: Number.isFinite(entry.area) && entry.area > 0 ? entry.area : computeFootprintArea(dims.length, dims.width, dims.depth),
      usedAlternate: false,
      alternateVersion: null,
    };
  }

  const alternate = (entry.alternateVersions || []).find((version) => !version.missingDimensions);
  if (alternate) {
    return {
      dimensions: toDimensionsObject(alternate.length, alternate.width, alternate.depth, false),
      volume: Number.isFinite(alternate.volume) && alternate.volume > 0
        ? alternate.volume
        : computeVolume(alternate.length, alternate.width, alternate.depth),
      area: Number.isFinite(alternate.area) && alternate.area > 0
        ? alternate.area
        : computeFootprintArea(alternate.length, alternate.width, alternate.depth),
      usedAlternate: true,
      alternateVersion: alternate,
    };
  }

  return {
    dimensions: toDimensionsObject(DEFAULT_DIMENSIONS.length, DEFAULT_DIMENSIONS.width, DEFAULT_DIMENSIONS.depth, true),
    volume: -1,
    area: -1,
    usedAlternate: false,
    alternateVersion: null,
  };
};

const buildGameFromVersionEntry = (entry, missingVersionInfo) => {
  const {
    dimensions,
    volume,
    area,
    usedAlternate,
    alternateVersion,
  } = resolveDimensionsForEntry(entry);

  const versionKey = entry.versionKey || `${entry.gameId}-${entry.versionId !== -1 ? entry.versionId : 'default'}`;
  const bgg = entry.bgg || {};

  const game = {
    id: versionKey,
    versionKey,
    gameKey: versionKey,
    gameId: entry.gameId,
    collectionId: entry.collectionId,
    name: entry.name || `ID:${entry.gameId}`,
    thumbnail: entry.thumbnail || null,
    image: entry.image || null,
    categories: bgg.categories || [],
    mechanics: bgg.mechanics || [],
    families: bgg.families || [],
    familyIds: bgg.familyIds || [],
    bggRank: bgg.bggRank ?? -1,
    minPlayers: bgg.minPlayers ?? -1,
    maxPlayers: bgg.maxPlayers ?? -1,
    bestPlayerCount: bgg.bestPlayerCount ?? -1,
    minPlaytime: bgg.minPlaytime ?? -1,
    maxPlaytime: bgg.maxPlaytime ?? -1,
    age: bgg.minAge ?? -1,
    communityAge: bgg.communityAge ?? -1,
    languageDependence: bgg.languageDependence ?? -1,
    weight: bgg.bggWeight ?? -1,
    bggRating: bgg.bggRating ?? -1,
    baseGameId: entry.baseGameId ?? entry.gameId,
    isExpansion: Boolean(entry.isExpansion),
    numplays: entry.numplays ?? 0,
    statuses: entry.statuses || {},
    versionId: entry.versionId,
    preferred: Boolean(entry.preferred),
    versionName: entry.versionName || entry.name,
    dimensions,
    volume,
    area,
    missingDimensions: dimensions.missingDimensions,
    alternateVersions: entry.alternateVersions || [],
    lastModified: entry.lastModified || null,
  };

  const statusFlags = entry.statuses || {};
  game.own = Boolean(statusFlags.own);
  game.prevowned = Boolean(statusFlags.prevowned);
  game.fortrade = Boolean(statusFlags.fortrade);
  game.want = Boolean(statusFlags.want);
  game.wanttoplay = Boolean(statusFlags.wanttoplay);
  game.wanttobuy = Boolean(statusFlags.wanttobuy);
  game.wishlist = Boolean(statusFlags.wishlist);
  game.preordered = Boolean(statusFlags.preordered);

  setupGameVersionMetadata(
    game,
    entry.gameId,
    entry.versionId !== -1 ? entry.versionId : 'default',
    missingVersionInfo,
  );

  game.usedAlternateVersionDims = usedAlternate;
  if (usedAlternate && alternateVersion) {
    game.alternateVersionId = alternateVersion.versionId;
    game.alternateVersionName = alternateVersion.name || null;
  }

  if (hasMissingDimensions(game.dimensions)) {
    updateGameCorrectionUrl(game, entry.versionId !== -1 ? entry.versionId : 'default');
  }

  removeInternalProperties(game);

  if (!game.versionName) {
    game.versionName = getFallbackVersionLabel(game);
  }

  return game;
};

const buildGamesFromVersionEntries = (entries, missingVersionMap) =>
  entries.map((entry) => {
    const missingInfo = missingVersionMap.get(entry.gameId);
    return buildGameFromVersionEntry(entry, missingInfo);
  });

const removeDuplicateGames = (games) => {
  const seen = new Set();
  return games.filter((game) => {
    if (seen.has(game.id)) {
      return false;
    }
    seen.add(game.id);
    return true;
  });
};

const filterExpansionsFromGames = (games, includeExpansions) =>
  includeExpansions ? games : games.filter((game) => !game.isExpansion);

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

  const collectionResult = await fetchUserCollectionWithDetails({
    username,
    includeStatuses,
    includeExpansions: includeExpansionsFlag,
  });

  const versionEntries = Array.isArray(collectionResult.items) ? collectionResult.items : [];

  if (versionEntries.length === 0) {
    console.warn('⚠️  No items in collection');
    return {
      cubes: [],
      totalGames: 0,
      message: 'No games were found in the BoardGameGeek collection for this username.',
    };
  }

  console.log(`   Found ${versionEntries.length} items in collection`);
  progress(requestId, `Found ${versionEntries.length} games in your collection`, {
    step: 'collection',
    count: versionEntries.length,
  });

  if (Array.isArray(collectionResult.missingThingIds) && collectionResult.missingThingIds.length > 0) {
    console.warn(
      `   ⚠️  BGG did not return data for ${collectionResult.missingThingIds.length} item(s):`,
      collectionResult.missingThingIds.join(', '),
    );
  }

  const filteredEntries = filterVersionEntries(
    versionEntries,
    includeStatuses,
    excludeStatuses,
    includeExpansionsFlag,
  );

  if (filteredEntries.length === 0) {
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

  const uniqueEntries = dedupeVersionEntries(filteredEntries);

  if (uniqueEntries.length === 0) {
    return {
      cubes: [],
      totalGames: 0,
      message: 'No games matched the selected filters.',
    };
  }

  const missingVersionGames = detectMissingVersionSelections(uniqueEntries);

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

  const allGames = buildGamesFromVersionEntries(uniqueEntries, missingVersionGames);

  console.log(`✅ Processed ${allGames.length} games`);
  progress(requestId, `Processed ${allGames.length} games`, {
    step: 'games',
    total: allGames.length,
  });

  const filteredGames = filterExpansionsFromGames(allGames, includeExpansionsFlag);
  const uniqueGames = removeDuplicateGames(filteredGames);

  uniqueGames.forEach((game) => {
    if (hasMissingDimensions(game.dimensions)) {
      game.dimensions = { ...DEFAULT_DIMENSIONS };
      game.usedAlternateVersionDims = true;
      updateGameCorrectionUrl(game, game.selectedVersionId || null);
    }
  });

  console.log(`   ℹ️  Total items to pack: ${uniqueGames.length} (includes multiple versions of same games)`);

  const overrideMaps = buildOverrideMaps(overridesPayload);
  const preparedGames = applyOverridesToGames(uniqueGames, overrideMaps);

  const gamesToPack = preparedGames;

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

  const responsePayload = serializeCubesResponse(packedCubes, gamesToPack, stacking, oversizedExcludedGames);

  return responsePayload;
};
