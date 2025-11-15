import { fetchUserCollectionWithDetails } from './bggService.js';
import { packGamesIntoCubes } from './packingService.js';
import { BGG_API_TOKEN } from './configService.js';
import { buildOverrideMaps, applyOverridesToGames } from './overrideService.js';
import { serializeCubesResponse } from './responseSerializer.js';
import { getRandomBoardGameMessage } from './progressService.js';
import {
  DEFAULT_DIMENSIONS,
  getFallbackVersionLabel,
  removeInternalProperties,
  setupGameVersionMetadata,
  checkMissingDimensions,
  hasValidDimensions,
} from '../utils/gameProcessingHelpers.js';
import {
  COLLECTION_STATUS_KEYS,
  createDisplayName,
} from '../utils/gameUtils.js';
import { normalizePositiveNumber, isPositiveFinite } from '../utils/numberUtils.js';
import { getMaxDepthDimension } from '../utils/packingHelpers.js';

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
    const key = entry.versionKey;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const detectnoSelectedVersionSelections = (entries) => {
  const missing = new Map();

  entries.forEach((entry) => {
    const gameId = entry.gameId;
    if (!gameId || gameId === -1) {
      return;
    }

    if ((entry.versionId === -1 || entry.versionId === null) && !missing.has(gameId)) {
      const gameName = entry.gameName || entry.name || `ID:${gameId}`;
      missing.set(gameId, {
        id: gameId,
        name: entry.name || `ID:${gameId}`,
        gameName,
        displayName: createDisplayName({ gameName, name: entry.name }, gameId),
        versionsUrl: entry.versionsUrl || null,
      });
    }
  });

  return missing;
};

const toDimensionsObject = (length, width, depth, weight) => ({
  length,
  width,
  depth,
  weight,
  missing: checkMissingDimensions({ length, width, depth }),
});

const resolveDimensionsForEntry = (entry) => {
  const dims = entry.dimensions || {};
  const normalizedWeight = isPositiveFinite(dims.weight) ? dims.weight : null;
  const dimensionsValid = hasValidDimensions(dims);

  if (dimensionsValid) {
    return {
      source: 'version',
      dimensions: toDimensionsObject(
        dims.length,
        dims.width,
        dims.depth,
        normalizedWeight
      ),
      volume: isPositiveFinite(entry.volume) ? entry.volume : -1,
      area: isPositiveFinite(entry.area) ? entry.area : -1,
      usedAlternate: false,
      alternateVersion: null,
    };
  }

  const alternate = entry.alternateVersions?.[0] || null;
  if (alternate) {
    const alternateWeight = isPositiveFinite(alternate.weight) ? alternate.weight : null;
    return {
      source: 'guessed',
      dimensions: toDimensionsObject(
        alternate.length,
        alternate.width,
        alternate.depth,
        alternateWeight
      ),
      volume: isPositiveFinite(alternate.volume) ? alternate.volume : -1,
      area: isPositiveFinite(alternate.area) ? alternate.area : -1,
      usedAlternate: true,
      alternateVersion: alternate,
    };
  }

  return {
    source: 'default',
    dimensions: toDimensionsObject(
      DEFAULT_DIMENSIONS.length,
      DEFAULT_DIMENSIONS.width,
      DEFAULT_DIMENSIONS.depth,
      DEFAULT_DIMENSIONS.weight ?? null,
    ),
    volume: -1,
    area: -1,
    usedAlternate: false,
    alternateVersion: null,
  };
};

const cloneDimensionSource = (dimension) => {
  if (!dimension) {
    return null;
  }

  const length = normalizePositiveNumber(dimension.length);
  const width = normalizePositiveNumber(dimension.width);
  const depth = normalizePositiveNumber(dimension.depth);

  // If all dimensions are null/missing, return null instead of an object with null values
  if (length == null && width == null && depth == null) {
    return null;
  }

  return {
    length,
    width,
    depth,
    weight: normalizePositiveNumber(dimension.weight),
    missing: dimension.missing ?? checkMissingDimensions({ length, width, depth }),
  };
};

const buildGameFromVersionEntry = (entry, noSelectedVersionInfo) => {
  const {
    dimensions,
    volume,
    area,
    usedAlternate,
    alternateVersion,
    source: selectedDimensionSource,
  } = resolveDimensionsForEntry(entry);

  const versionKey = entry.versionKey;
  const gameName = entry.gameName || null;
  const versionName = entry.versionName || gameName;
  const gameType = entry.gameType || entry.objectType || entry.objecttype || entry.subtype || null;
  const subType = entry.subtype || null;
  const gamePublishedYear = Number.isInteger(entry.gamePublishedYear)
    ? entry.gamePublishedYear
    : -1;
  const versionPublishedYear = Number.isInteger(entry.versionPublishedYear)
    ? entry.versionPublishedYear
    : -1;

  const versionDimensions = cloneDimensionSource(entry.dimensions);
  const guessedDimensions = entry.alternateVersions?.[0]
    ? cloneDimensionSource({
        ...(entry.alternateVersions[0].dimensions || {}),
        weight:
          entry.alternateVersions[0].weight ??
          entry.alternateVersions[0].dimensions?.weight ??
          null,
      })
    : null;
  const defaultDimensions = cloneDimensionSource(DEFAULT_DIMENSIONS);

  const game = {
    id: versionKey,
    versionKey,
    gameKey: versionKey,
    gameId: entry.gameId,
    collectionId: entry.collectionId,
    name: versionName,
    gameName,
    versionName,
    thumbnail: entry.thumbnail || null,
    image: entry.image || null,
    categories: entry.categories || [],
    mechanics: entry.mechanics || [],
    families: entry.families || [],
    bggRank: entry.bggRank ?? -1,
    minPlayers: entry.minPlayers ?? -1,
    maxPlayers: entry.maxPlayers ?? -1,
    bestPlayerCount: entry.bestPlayerCount ?? -1,
    minPlaytime: entry.minPlaytime ?? -1,
    maxPlaytime: entry.maxPlaytime ?? -1,
    minAge: entry.minAge ?? -1,
    communityAge: entry.communityAge ?? -1,
    languageDependence: entry.languageDependence ?? -1,
    bggWeight: entry.bggWeight ?? -1,
    bggRating: entry.bggRating ?? -1,
    baseGameId: entry.baseGameId ?? entry.gameId,
    gameType,
    objectType: gameType,
    subType,
    isExpansion: Boolean(entry.isExpansion),
    numplays: entry.numplays ?? 0,
    statuses: entry.statuses || {},
    versionId: entry.versionId,
    preferred: Boolean(entry.preferred),
    versionName,
    dimensions,
    volume,
    area,
    maxDepth: getMaxDepthDimension(dimensions, true),
    alternateVersions: entry.alternateVersions || [],
    lastModified: entry.lastModified || null,
    correctionUrl: entry.correctionUrl || null,
    versionsUrl: entry.versionsUrl || null,
    gamePublishedYear,
    versionPublishedYear,
    dimensionSources: {
      user: null,
      version: versionDimensions,
      guessed: guessedDimensions,
      default: defaultDimensions,
    },
    selectedDimensionSource,
  };

  const statusFlags = entry.statuses || {};
  COLLECTION_STATUS_KEYS.forEach((key) => {
    game[key] = Boolean(statusFlags[key]);
  });

  setupGameVersionMetadata(
    game,
    entry.gameId,
    entry.versionId !== -1 ? entry.versionId : 'default',
    noSelectedVersionInfo,
  );

  // URLs are already set from orchestrator, use them directly
  game.correctionUrl = entry.correctionUrl || null;
  game.versionsUrl = entry.versionsUrl || null;

  game.usedAlternateVersionDims = usedAlternate;
  game.bggDefaultDimensions = Boolean(entry.bggDefaultDimensions); // Flag to indicate BGG defaults were filtered
  
  // Determine warning flags based on dimension source and availability
  // Check entry.dimensions directly (not cloned version) to detect if version dimension attempt existed
  // cloneDimensionSource returns null when all dimensions are missing, so we need to check the source
  const hasVersionDimensions = entry.dimensions != null;
  const versionDimensionsMissing = entry.dimensions?.missing === true || 
    (entry.dimensions != null && !hasValidDimensions(entry.dimensions));
  const hasGuessedDimensions = guessedDimensions !== null;

  // allVersionsMissingDimensions: version exists but missing, default used, no guessed
  game.allVersionsMissingDimensions = Boolean(
    selectedDimensionSource === 'default' &&
    hasVersionDimensions &&
    versionDimensionsMissing &&
    !hasGuessedDimensions
  );

  // selectedVersionMissingDimensions: version exists but missing, guessed used
  game.selectedVersionMissingDimensions = Boolean(
    selectedDimensionSource === 'guessed' &&
    hasVersionDimensions &&
    versionDimensionsMissing
  );

  // guessedDueToNoVersion: no version selected, guessed used
  game.guessedDueToNoVersion = Boolean(
    selectedDimensionSource === 'guessed' &&
    game.noSelectedVersion
  );
  
  if (usedAlternate && alternateVersion) {
    game.alternateVersionId = alternateVersion.versionId;
    game.alternateVersionName = alternateVersion.name || null;
  }

  removeInternalProperties(game);

  if (!game.versionName) {
    game.versionName = getFallbackVersionLabel(game);
  }

  game.displayName = createDisplayName(game, game.gameId);

  return game;
};

const buildGamesFromVersionEntries = (entries, noSelectedVersionMap) =>
  entries.map((entry) => {
    const missingInfo = noSelectedVersionMap.get(entry.gameId);
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
    onProgress,
    requestId,
  });

  const versionEntries = Array.isArray(collectionResult.items) ? collectionResult.items : [];

  if (versionEntries.length === 0) {
    console.warn('⚠️  No items in collection');
    const emptyResult = {
      cubes: [],
      totalGames: 0,
      message: 'No games were found in the BoardGameGeek collection for this username.',
    };
    progress(requestId, 'No games found in collection', {
      ...emptyResult,
      status: 'complete',
    });
    return emptyResult;
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
    const noMatchesResult = {
      cubes: [],
      totalGames: 0,
      message: 'No games matched the selected collection filters.',
    };
    progress(requestId, 'No games matched the selected collection filters.', {
      ...noMatchesResult,
      status: 'complete',
      step: 'collection',
      count: 0,
    });
    return noMatchesResult;
  }

  const uniqueEntries = dedupeVersionEntries(filteredEntries);

  if (uniqueEntries.length === 0) {
    const noUniqueResult = {
      cubes: [],
      totalGames: 0,
      message: 'No games matched the selected filters.',
    };
    progress(requestId, 'No unique games found', {
      ...noUniqueResult,
      status: 'complete',
    });
    return noUniqueResult;
  }

  const noSelectedVersionGames = detectnoSelectedVersionSelections(uniqueEntries);

  if (!bypassVersionWarning && noSelectedVersionGames.size > 0) {
    const warningGames = Array.from(noSelectedVersionGames.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    const warningMessage = `${warningGames.length} game${
      warningGames.length !== 1 ? 's' : ''
    } do not have a specific BoardGameGeek version selected. Selecting a version helps ensure accurate dimensions.`;
    const secondaryMessage =
      'We can try to guess dimensions by checking the most recent English version first. This can take a while and may still require manual adjustments later.';

    const noSelectedVersionsResult = {
      status: 'missing_versions',
      requestId,
      message: warningMessage,
      details: secondaryMessage,
      games: warningGames,
    };

    // Store result in progress state for polling
    progress(requestId, 'Missing game versions detected. Waiting for user confirmation...', {
      ...noSelectedVersionsResult,
      step: 'warning',
      warningType: 'missing_versions',
    });

    return noSelectedVersionsResult;
  }

  const allGames = buildGamesFromVersionEntries(uniqueEntries, noSelectedVersionGames);

  console.log(`✅ Processed ${allGames.length} games`);
  progress(requestId, `Processed ${allGames.length} games`, {
    step: 'games',
    total: allGames.length,
  });

  const filteredGames = filterExpansionsFromGames(allGames, includeExpansionsFlag);
  const uniqueGames = removeDuplicateGames(filteredGames);

  
  console.log(`   ℹ️  Total items to pack: ${uniqueGames.length} (includes multiple versions of same games)`);

  const overrideMaps = buildOverrideMaps(overridesPayload);
  const preparedGames = applyOverridesToGames(uniqueGames, overrideMaps);

  const gamesToPack = preparedGames;

  // Transition 4: After processing games, before packing
  if (onProgress && requestId) {
    const catchyPhrase = getRandomBoardGameMessage();
    progress(requestId, `Packing ${gamesToPack.length} games into cubes... ${catchyPhrase}`, {
      step: 'packing',
      gameCount: gamesToPack.length,
    });
  } else {
    progress(requestId, `Packing ${gamesToPack.length} games into cubes...`, {
      step: 'packing',
      gameCount: gamesToPack.length,
    });
  }

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

  const responsePayload = serializeCubesResponse(packedCubes, stacking, oversizedExcludedGames);

  // Store final result in progress state for polling
  progress(requestId, 'Complete', {
    ...responsePayload,
    status: 'complete',
  });

  return responsePayload;
};
