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
import { buildGameUrls } from '../../utils/gameUtils.js';
import { ensureArray } from '../../utils/arrayUtils.js';
import { hasValidDimensions } from '../../utils/gameProcessingHelpers.js';
import { isPositiveFinite, isNonNegativeInteger } from '../../utils/numberUtils.js';

const COLLECTION_MAX_RETRIES = 5;
const BATCH_SIZE = 20;

const buildCollectionKey = (username, includeStatuses = [], includeExpansions = true) => {
  const includeKeySegment = includeStatuses.slice().sort().join('|') || 'none';
  return `user:${username}:includes:${includeKeySegment}:expansions:${includeExpansions}`;
};

const buildCollectionUrl = (username, includeStatuses = []) => {
  const params = new URLSearchParams({
    username,
    version: '1',
  });

  includeStatuses.forEach((status) => params.append(status, '1'));

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
    const delay = (2 + attempt) * 1000;
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

    const versionEntries = mapVersionItems(rawItem);
    versionEntries.forEach((version) => {
      const key = `${game.id}:${version.versionId}`;
      versions.set(key, version);
    });
  }

  return { games, versions, returnedIds };
};

const fetchThingDetailsWithRetries = async (gameIds) => {
  const remaining = new Set(gameIds);
  const fetchedGames = new Map();
  const fetchedVersions = new Map();

  const fetchAndMerge = async (ids) => {
    if (ids.length === 0) {
      return;
    }

    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
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

    item.versions.forEach(({ versionId }) => {
      const normalizedVersionId = Number.isInteger(versionId) ? versionId : -1;
      if (normalizedVersionId === -1) {
        gamesToRefresh.add(gameId);
        return;
      }

      const key = `${gameId}:${normalizedVersionId}`;
      const cachedVersion = getVersion(gameId, normalizedVersionId);
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
          cachedVersions.set(key, cachedVersion);
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
  const prefix = `${gameId}:`;
  return Array.from(versionLookup.entries())
    .filter(([key]) => key.startsWith(prefix))
    .map(([, version]) => version);
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

const DEFAULT_DIMENSIONS = {
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
        missing: versionData.missingDimensions ?? false,
      }
    : {
        length: DEFAULT_DIMENSIONS.length,
        width: DEFAULT_DIMENSIONS.width,
        depth: DEFAULT_DIMENSIONS.depth,
        weight: null,
        missing: true,
      };
  
  const missingDimensions = derivedDimensions.missing;
  const volume = !missingDimensions && versionData && isPositiveFinite(versionData.volume)
    ? versionData.volume
    : -1;
  const area = !missingDimensions && versionData && isPositiveFinite(versionData.area)
    ? versionData.area
    : -1;
  const versionKey =
    versionData?.versionKey ||
    `${gameId}-${normalizedVersionId !== -1 ? normalizedVersionId : 'default'}`;
  const gameName = item.name || game?.name || versionData?.name || `Game ${gameId}`;
  const { correctionUrl, versionsUrl } = buildGameUrls(gameId, normalizedVersionId, gameName);

  const versionLanguage = versionData?.language || item.language || null;
  const versionYear = isNonNegativeInteger(versionData?.versionYearPublished) &&
    versionData.versionYearPublished > 0
      ? versionData.versionYearPublished
      : null;


  const alternateCandidates = collectAvailableVersions(versionLookup, gameId).filter(
    (candidate) =>
      candidate.versionId !== normalizedVersionId && !candidate.missingDimensions,
  );
  alternateCandidates.sort(compareAlternateVersions);

  const alternateVersions =
    missingDimensions || normalizedVersionId === -1
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
  };
};

const mergeCollectionWithDetails = (collectionItems, gameLookup, versionLookup) => {
  const versionEntries = [];

  collectionItems.forEach((item) => {
    const gameId = item.gameId;
    const game = gameLookup.get(gameId);
    const selectedVersionsRaw =
      item.versions && item.versions.length > 0 ? item.versions : [{ versionId: -1 }];

    selectedVersionsRaw.forEach(({ versionId }) => {
      const key = `${gameId}:${versionId}`;
      const versionData = versionId !== -1 ? versionLookup.get(key) : null;

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
  });

  console.debug(`   ✅ Built ${versionEntries.length} version entry(ies) for packing analysis`);

  return versionEntries;
};

export const fetchUserCollectionWithDetails = async ({
  username,
  includeStatuses = [],
  includeExpansions = true,
} = {}) => {
  if (!username) {
    throw new Error('Username is required to fetch collection data.');
  }

  const collectionKey = buildCollectionKey(username, includeStatuses, includeExpansions);
  const collectionUrl = buildCollectionUrl(username, includeStatuses);

  const xml = await fetchCollectionXml(collectionUrl);
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
    const fetchResult = await fetchThingDetailsWithRetries(Array.from(gamesToRefresh));
    fetchedGames = fetchResult.fetchedGames;
    fetchedVersions = fetchResult.fetchedVersions;
    missingIds = fetchResult.missingIds;

    fetchedGames.forEach((game, gameId) => setGame(gameId, game));
    fetchedVersions.forEach((version, key) => {
      const [gameId, versionId] = key.split(':').map((part) => Number.parseInt(part, 10));
      if (!Number.isNaN(gameId) && !Number.isNaN(versionId)) {
        setVersion(gameId, versionId, version);
      }
    });
  }

  const combinedGames = new Map([...cachedGames, ...fetchedGames]);
  const combinedVersions = new Map([...cachedVersions, ...fetchedVersions]);


  const versionEntries = mergeCollectionWithDetails(effectiveCollection, combinedGames, combinedVersions);

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


