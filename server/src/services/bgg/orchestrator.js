import fs from 'fs';
import path from 'path';
import { BGG_API_BASE, BGG_API_TOKEN } from '../configService.js';
import {
  getCollection,
  setCollection,
  getGame,
  setGame,
  getVersion,
  setVersion,
} from '../cache/index.js';
import { bggApiRequest } from './apiClient.js';
import { xmlToJson } from './xmlParser.js';
import { mapCollectionItems, generateCollectionHash } from './collectionMapper.js';
import { mapThingItem, mapVersionItems } from './thingMapper.js';
import { buildGameUrls, buildVersionKey } from '../../utils/gameUtils.js';
import { ensureArray } from '../../utils/arrayUtils.js';
import { hasValidDimensions } from '../../utils/gameProcessingHelpers.js';
import { isPositiveFinite, isNonNegativeInteger, parseInteger } from '../../utils/numberUtils.js';
import { getRandomBoardGameMessage } from '../progressService.js';

const COLLECTION_MAX_RETRIES = 5;
const BATCH_SIZE = 20;
const COLLECTION_RETRY_DELAY_BASE_MS = 2000;

const buildCollectionKey = (username, includeStatuses = [], excludeStatuses = [], includeExpansions = true) => {
  const includeKeySegment = includeStatuses.slice().sort().join('|') || 'none';
  const excludeKeySegment = excludeStatuses.slice().sort().join('|') || 'none';
  return `user:${username}:includes:${includeKeySegment}:excludes:${excludeKeySegment}:expansions:${includeExpansions}`;
};

const buildCollectionUrl = (username, excludeStatuses = []) => {
  const params = new URLSearchParams({
    username,
    version: '1',
  });

  excludeStatuses.forEach((status) => params.append(status, '0'));

  return `${BGG_API_BASE}/collection?${params.toString()}`;
};

const fetchCollectionXml = async (url) => {
  let attempt = 0;
  let response;

  while (attempt < COLLECTION_MAX_RETRIES) {
    console.debug('📡 BGG collection request:', url);
    response = await bggApiRequest(url, {
      headers: {
        Authorization: `Bearer ${BGG_API_TOKEN}`,
        Accept: 'application/xml',
      },
      validateStatus: (status) => status === 200 || status === 202,
    });

    if (response.status === 200) {
      return response.data;
    }

    attempt += 1;
    const delay = (COLLECTION_RETRY_DELAY_BASE_MS / 1000 + attempt) * 1000;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  if (response?.status === 202) {
    throw new Error('Collection generation timed out. Please try again in a few moments.');
  }

  throw new Error(`Failed to fetch collection from BGG (${response?.status ?? 'unknown error'})`);
};

const fetchThingBatch = async (gameIds) => {
  if (gameIds.length === 0) {
    return {
      games: new Map(),
      versions: new Map(),
      returnedIds: new Set(),
    };
  }

  const params = new URLSearchParams({
    id: gameIds.join(','),
    stats: '1',
    versions: '1',
  });

  const url = `${BGG_API_BASE}/thing?${params.toString()}`;
  console.debug('📡 BGG thing request:', url);
  const response = await bggApiRequest(url, {
    headers: {
      Authorization: `Bearer ${BGG_API_TOKEN}`,
      Accept: 'application/xml',
    },
  });

  const parsed = await xmlToJson(response.data);
  const itemNodes = parsed?.items?.item || parsed?.item;
  const items = ensureArray(itemNodes);

  const games = new Map();
  const versions = new Map();
  const returnedIds = new Set();

  for (const rawItem of items) {
    const game = mapThingItem(rawItem);
    if (!game || game.id === -1) {
      continue;
    }

    games.set(game.id, game);
    returnedIds.add(game.id);

    const versionEntries = mapVersionItems(rawItem, game.id);
    versionEntries.forEach((version) => {
      versions.set(version.versionKey, version);
    });
  }

  return { games, versions, returnedIds };
};

const fetchThingDetailsWithRetries = async (gameIds, onProgress, requestId) => {
  const remaining = new Set(gameIds);
  const fetchedGames = new Map();
  const fetchedVersions = new Map();
  const totalBatches = Math.ceil(gameIds.length / BATCH_SIZE);
  let batchNumber = 0;

  const progress = typeof onProgress === 'function' ? onProgress : () => {};

  const fetchAndMerge = async (ids) => {
    if (ids.length === 0) {
      return;
    }

    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      batchNumber++;
      const batch = ids.slice(i, i + BATCH_SIZE);
      
      if (onProgress && requestId) {
        progress(requestId, `Getting games batch ${batchNumber}/${totalBatches}...`, {
          step: 'fetching',
          batch: batchNumber,
          totalBatches,
          current: Math.min(batchNumber * BATCH_SIZE, gameIds.length),
          total: gameIds.length,
        });
      }
      
      const { games, versions, returnedIds } = await fetchThingBatch(batch);

      games.forEach((game, id) => {
        fetchedGames.set(id, game);
        remaining.delete(id);
      });

      versions.forEach((version, key) => {
        fetchedVersions.set(key, version);
      });

      batch.forEach((id) => {
        if (returnedIds.has(id)) {
          remaining.delete(id);
        }
      });
    }
  };

  await fetchAndMerge(Array.from(remaining));

  if (remaining.size > 0) {
    await fetchAndMerge(Array.from(remaining));
  }

  if (remaining.size > 0) {
    const stillMissing = Array.from(remaining);
    remaining.clear();

    for (const id of stillMissing) {
      await fetchAndMerge([id]);
      if (!fetchedGames.has(id)) {
        remaining.add(id);
      }
    }
  }

  return { fetchedGames, fetchedVersions, missingIds: Array.from(remaining) };
};

const collectCachedData = (collectionItems) => {
  const cachedGames = new Map();
  const cachedVersions = new Map();
  const gamesToRefresh = new Set();

  collectionItems.forEach((item) => {
    const gameId = Number.isInteger(item.gameId) ? item.gameId : -1;

    if (!gameId || gameId === -1) {
      return;
    }

    const cachedGame = getGame(gameId);
    if (cachedGame) {
      cachedGames.set(gameId, cachedGame);
    } else {
      gamesToRefresh.add(gameId);
    }

    item.versions.forEach(({ versionId, versionKey }) => {
      const normalizedVersionId = Number.isInteger(versionId) ? versionId : -1;
      if (normalizedVersionId === -1) {
        gamesToRefresh.add(gameId);
        return;
      }

      const cachedVersion = getVersion(versionKey);
      if (cachedVersion) {
        const dimensions = cachedVersion.dimensions;
        const length = isPositiveFinite(cachedVersion.length)
          ? cachedVersion.length
          : dimensions?.length;
        const width = isPositiveFinite(cachedVersion.width)
          ? cachedVersion.width
          : dimensions?.width;
        const depth = isPositiveFinite(cachedVersion.depth)
          ? cachedVersion.depth
          : dimensions?.depth;

        if (hasValidDimensions({ length, width, depth })) {
          cachedVersions.set(versionKey, cachedVersion);
        } else {
          gamesToRefresh.add(gameId);
        }
      } else {
        gamesToRefresh.add(gameId);
      }
    });
  });

  return {
    cachedGames,
    cachedVersions,
    gamesToRefresh,
  };
};

const collectAvailableVersions = (versionLookup, gameId) => {
  return Array.from(versionLookup.values())
    .filter((version) => {
      // Validate gameId matches
      if (version.gameId !== gameId) {
        return false;
      }
      
      // Validate versionKey matches the gameId (extra safety check)
      if (version.versionKey) {
        const keyParts = version.versionKey.split('-');
        const keyGameId = parseInteger(keyParts[0], -1);
        if (keyGameId !== gameId) {
          console.warn(`⚠️  Version ${version.versionKey} has mismatched gameId: stored=${version.gameId}, key=${keyGameId}`);
          return false;
        }
      }
      
      return true;
    });
};

const compareAlternateVersions = (a, b) => {
  const normalizeYear = (value) =>
    Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
  const normalizeLanguage = (value) => {
    if (!value || typeof value !== 'string') {
      return 'zzzzzz';
    }
    return value.trim().toLowerCase();
  };

  const yearDelta =
    normalizeYear(b.versionYearPublished) - normalizeYear(a.versionYearPublished);
  if (yearDelta !== 0) {
    return yearDelta;
  }

  const langA = normalizeLanguage(a.language);
  const langB = normalizeLanguage(b.language);
  const isEnglishA = langA === 'english';
  const isEnglishB = langB === 'english';

  if (isEnglishA !== isEnglishB) {
    return isEnglishA ? -1 : 1;
  }

  const languageDelta = langA.localeCompare(langB);
  if (languageDelta !== 0) {
    return languageDelta;
  }

  return (b.versionId ?? 0) - (a.versionId ?? 0);
};

const MISSING_DIMENSIONS_PLACEHOLDER = {
  length: -1,
  width: -1,
  depth: -1,
};

const buildVersionEntry = ({
  item,
  game,
  versionData,
  gameId,
  collectionId,
  preferred,
  versionId,
  versionLookup,
}) => {
  const normalizedVersionId = Number.isInteger(versionId) ? versionId : -1;
  const normalizedWeight = versionData && isPositiveFinite(versionData.weight)
    ? versionData.weight
    : null;
  
    const derivedDimensions = versionData
    ? {
        length: versionData.length,
        width: versionData.width,
        depth: versionData.depth,
        weight: normalizedWeight,
        missing: !hasValidDimensions({
          length: versionData.length,
          width: versionData.width,
          depth: versionData.depth,
        }),
      }
    : {
        length: MISSING_DIMENSIONS_PLACEHOLDER.length,
        width: MISSING_DIMENSIONS_PLACEHOLDER.width,
        depth: MISSING_DIMENSIONS_PLACEHOLDER.depth,
        weight: null,
        missing: true,
      };
  
  const allVersionsMissingDimensions = derivedDimensions.missing;
  const volume = !allVersionsMissingDimensions && versionData && isPositiveFinite(versionData.volume)
    ? versionData.volume
    : -1;
  const area = !allVersionsMissingDimensions && versionData && isPositiveFinite(versionData.area)
    ? versionData.area
    : -1;
  const versionKey = versionData?.versionKey || buildVersionKey(gameId, normalizedVersionId);
  const gameName = item.name || game?.name || versionData?.name || `Game ${gameId}`;
  const { correctionUrl, versionsUrl } = buildGameUrls(gameId, normalizedVersionId, gameName);

  const versionLanguage = versionData?.language || item.language || null;
  const versionYear = isNonNegativeInteger(versionData?.versionYearPublished) &&
    versionData.versionYearPublished > 0
      ? versionData.versionYearPublished
      : null;


  const alternateCandidates = collectAvailableVersions(versionLookup, gameId).filter(
    (candidate) =>
      candidate.versionId !== normalizedVersionId &&
      hasValidDimensions({
        length: candidate.length,
        width: candidate.width,
        depth: candidate.depth,
      }),
  );
  alternateCandidates.sort(compareAlternateVersions);

  if (alternateCandidates.length > 0 && (allVersionsMissingDimensions || normalizedVersionId === -1)) {
    const firstAlt = alternateCandidates[0];
    console.debug(`🔍 Selected alternate for gameId=${gameId}, versionId=${normalizedVersionId}: ${firstAlt.versionKey} (${firstAlt.length}" × ${firstAlt.width}" × ${firstAlt.depth}")`);
  }

  const alternateVersions =
    allVersionsMissingDimensions || normalizedVersionId === -1
      ? alternateCandidates.length > 0
        ? [
            (() => {
              const version = alternateCandidates[0];
              const altWeight = isPositiveFinite(version.weight) ? version.weight : null;

              return {
                versionId: version.versionId,
                versionKey: version.versionKey,
                name: version.name,
                length: version.length,
                width: version.width,
                depth: version.depth,
                weight: altWeight,
                dimensions: {
                  length: version.length,
                  width: version.width,
                  depth: version.depth,
                  weight: altWeight,
                  missing: false,
                },
                volume: isPositiveFinite(version.volume) ? version.volume : -1,
                area: isPositiveFinite(version.area) ? version.area : -1,
                language: version.language,
                versionYearPublished: version.versionYearPublished,
              };
            })(),
          ]
        : []
      : [];

  const objectType = game?.type || item.objecttype || item.subtype || null;
  const subtype = item.subtype || objectType || null;
  const gamePublishedYear = isNonNegativeInteger(game?.gamePublishedYear)
    ? game.gamePublishedYear
    : -1;
  const versionPublishedYear = isNonNegativeInteger(versionData?.versionYearPublished)
    ? versionData.versionYearPublished
    : -1;

  return {
    versionKey,
    versionId: normalizedVersionId,
    gameId,
    collectionId,
    preferred,
    versionName: versionData?.name,
    gameName,
    gamePublishedYear,
    versionPublishedYear,
    gameType: objectType,
    objectType,
    subtype,
    categories: game?.categories || [],
    mechanics: game?.mechanics || [],
    families: game?.families || [],
    bggRank: game?.bggRank ?? -1,
    minPlayers: game?.minPlayers ?? -1,
    maxPlayers: game?.maxPlayers ?? -1,
    bestPlayerCount: game?.bestPlayerCount ?? -1,
    minPlaytime: game?.minPlayTime ?? -1,
    maxPlaytime: game?.maxPlayTime ?? -1,
    minAge: game?.minAge ?? -1,
    communityAge: game?.communityAge ?? -1,
    languageDependence: game?.languageDependence ?? -1,
    bggWeight: game?.bggWeight ?? -1,
    bggRating: game?.bggRating ?? -1,
    statuses: {
      own: item.own,
      want: item.want,
      wanttobuy: item.wanttobuy,
      wanttoplay: item.wanttoplay,
      wishlist: item.wishlist,
      prevowned: item.prevowned,
      preordered: item.preordered,
      fortrade: item.fortrade,
    },
    thumbnail: game?.thumbnail || item.thumbnail || null,
    image: game?.image || item.image || null,
    baseGameId: game?.baseGameId || gameId,
    isExpansion: Boolean(game?.isExpansion || item.subtype === 'boardgameexpansion'),
    dimensions: derivedDimensions,
    volume,
    area,
    alternateVersions,
    lastModified: item.lastModified || null,
    numplays: item.numplays ?? 0,
    correctionUrl,
    versionsUrl,
    bggDefaultDimensions: Boolean(versionData?.bggDefaultDimensions), // Pass through the flag
  };
};

const mergeCollectionWithDetails = (collectionItems, gameLookup, versionLookup, onProgress, requestId) => {
  const versionEntries = [];
  const totalItems = collectionItems.length;
  const PROGRESS_INTERVAL = 20; // Send progress every 20 collection items
  let processedCount = 0;

  const progress = typeof onProgress === 'function' ? onProgress : () => {};

  collectionItems.forEach((item, index) => {
    const gameId = item.gameId;
    const game = gameLookup.get(gameId);
    const selectedVersionsRaw =
      item.versions && item.versions.length > 0 ? item.versions : [{ versionId: -1, versionKey: buildVersionKey(gameId, -1) }];

    selectedVersionsRaw.forEach(({ versionId, versionKey }) => {
      const versionData = versionId !== -1 ? versionLookup.get(versionKey) : null;

      const versionEntry = buildVersionEntry({
        item,
        game,
        versionData,
        gameId,
        collectionId: item.collectionId,
        preferred: versionId !== -1,
        versionId,
        versionLookup,
      });

      versionEntries.push(versionEntry);
    });

    processedCount++;

    // Send progress every PROGRESS_INTERVAL collection items
    if (onProgress && requestId && processedCount % PROGRESS_INTERVAL === 0) {
      progress(requestId, `Parsing games ${processedCount}/${totalItems}...`, {
        step: 'parsing',
        current: processedCount,
        total: totalItems,
      });
    }
  });

  console.debug(`   ✅ Built ${versionEntries.length} version entry(ies) for packing analysis`);

  return versionEntries;
};

export const fetchUserCollectionWithDetails = async ({
  username,
  includeStatuses = [],
  excludeStatuses = [],
  includeExpansions = true,
  onProgress,
  requestId,
} = {}) => {
  if (!username) {
    throw new Error('Username is required to fetch collection data.');
  }

  const progress = typeof onProgress === 'function' ? onProgress : () => {};

  const collectionKey = buildCollectionKey(username, includeStatuses, excludeStatuses, includeExpansions);
  const collectionUrl = buildCollectionUrl(username, excludeStatuses);

  if (onProgress && requestId) {
    progress(requestId, 'Fetching collection from BoardGameGeek...', { step: 'collection_fetch' });
  }

  const xml = await fetchCollectionXml(collectionUrl);
  
  // Transition 1: After fetching collection, before parsing
  if (onProgress && requestId) {
    const catchyPhrase = getRandomBoardGameMessage();
    progress(requestId, `Parsing collection... ${catchyPhrase}`, { step: 'parsing_start' });
  }
  
  const collectionJson = await xmlToJson(xml);
  const collectionItems = mapCollectionItems(collectionJson);
  const collectionHash = generateCollectionHash(collectionItems);

  const cachedCollection = getCollection(collectionKey, collectionHash);
  const effectiveCollection = cachedCollection || collectionItems;

  if (!cachedCollection) {
    setCollection(collectionKey, collectionHash, collectionItems);
  }

  const { cachedGames, cachedVersions, gamesToRefresh } = collectCachedData(effectiveCollection);

  let fetchedGames = new Map();
  let fetchedVersions = new Map();
  let missingIds = [];

  if (gamesToRefresh.size > 0) {
    if (onProgress && requestId) {
      progress(requestId, `Found ${gamesToRefresh.size} games to fetch details for...`, {
        step: 'preparing_fetch',
        total: gamesToRefresh.size,
      });
    }

    const fetchResult = await fetchThingDetailsWithRetries(
      Array.from(gamesToRefresh),
      onProgress,
      requestId,
    );
    fetchedGames = fetchResult.fetchedGames;
    fetchedVersions = fetchResult.fetchedVersions;
    missingIds = fetchResult.missingIds;

    // Transition 2: After fetching all game details, before organizing
    if (onProgress && requestId) {
      const catchyPhrase = getRandomBoardGameMessage();
      progress(requestId, `Organizing game data... ${catchyPhrase}`, { step: 'organizing' });
    }

    fetchedGames.forEach((game, gameId) => setGame(gameId, game));
    fetchedVersions.forEach((version) => {
      if (version.gameId && version.versionId !== -1 && version.versionKey) {
        setVersion(version.versionKey, version);
      }
    });
  } else if (onProgress && requestId) {
    // When using cached data, still send progress updates
    progress(requestId, 'Using cached game data...', { step: 'cached' });
    // Transition 2: Even with cached data, we still organize it
    const catchyPhrase = getRandomBoardGameMessage();
    progress(requestId, `Organizing game data... ${catchyPhrase}`, { step: 'organizing' });
  }

  const combinedGames = new Map([...cachedGames, ...fetchedGames]);
  const combinedVersions = new Map([...cachedVersions, ...fetchedVersions]);

  if (onProgress && requestId && effectiveCollection.length > 0) {
    progress(requestId, `Building version entries from ${effectiveCollection.length} collection items...`, {
      step: 'building_entries',
      total: effectiveCollection.length,
    });
  }

  const versionEntries = mergeCollectionWithDetails(
    effectiveCollection,
    combinedGames,
    combinedVersions,
    onProgress,
    requestId,
  );

  // Transition 3: After building version entries, before processing in gamesService
  if (onProgress && requestId) {
    const catchyPhrase = getRandomBoardGameMessage();
    progress(requestId, `Preparing games for packing... ${catchyPhrase}`, { step: 'preparing' });
  }

  const debugOutputFile = process.env.BGG_DEBUG_OUTPUT_FILE;
  if (debugOutputFile) {
    try {
      const resolvedPath = path.isAbsolute(debugOutputFile)
        ? debugOutputFile
        : path.resolve(debugOutputFile);
      fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
      fs.writeFileSync(
        resolvedPath,
        JSON.stringify(
          {
            username,
            timestamp: new Date().toISOString(),
            collectionKey,
            versionEntries: versionEntries,
            missingIds: missingIds,
          },
          null,
          2,
        ),
        'utf-8',
      );
      console.debug(`📝 Wrote BGG debug output to ${resolvedPath}`);
    } catch (error) {
      console.error(`Failed to write BGG debug output: ${error.message}`);
    }
  }

  return {
    username,
    collectionHash,
    collectionKey,
    items: versionEntries,
    missingThingIds: missingIds,
    fetchedGameCount: fetchedGames.size,
    cachedGameCount: cachedGames.size,
  };
};


