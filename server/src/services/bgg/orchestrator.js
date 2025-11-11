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
import { buildCorrectionUrl, buildVersionsUrl } from '../../utils/gameUtils.js';

const COLLECTION_MAX_RETRIES = 5;
const BATCH_SIZE = 20;

const ensureArray = (value) => {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
};

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
        const length =
          Number.isFinite(cachedVersion.length) && cachedVersion.length > 0
            ? cachedVersion.length
            : dimensions?.length;
        const width =
          Number.isFinite(cachedVersion.width) && cachedVersion.width > 0
            ? cachedVersion.width
            : dimensions?.width;
        const depth =
          Number.isFinite(cachedVersion.depth) && cachedVersion.depth > 0
            ? cachedVersion.depth
            : dimensions?.depth;
        const hasValidDimensions =
          Number.isFinite(length) &&
          Number.isFinite(width) &&
          Number.isFinite(depth) &&
          length > 0 &&
          width > 0 &&
          depth > 0;

        if (hasValidDimensions) {
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

const DEFAULT_DIMENSIONS = {
  length: -1,
  width: -1,
  depth: -1,
};

const unescapeName = (value) =>
  typeof value === 'string' ? value.replace(/\\'/g, "'") : value;

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
  const missingDimensions = versionData ? versionData.missingDimensions : true;
  const derivedDimensions = versionData
    ? {
        length: versionData.length,
        width: versionData.width,
        depth: versionData.depth,
        missingDimensions,
      }
    : {
        ...DEFAULT_DIMENSIONS,
        missingDimensions: true,
      };
  const volume =
    !missingDimensions && versionData && Number.isFinite(versionData.volume)
      ? versionData.volume
      : -1;
  const area =
    !missingDimensions && versionData && Number.isFinite(versionData.area)
      ? versionData.area
      : -1;
  const versionKey =
    versionData?.versionKey ||
    `${gameId}-${normalizedVersionId !== -1 ? normalizedVersionId : 'default'}`;
  const versionNameRaw = versionData?.name || item.versionName || item.name || game?.name || null;
  const versionName = unescapeName(versionNameRaw);
  const gameName = unescapeName(item.name || game?.name || versionNameRaw || `Game ${gameId}`);
  const versionsUrl = buildVersionsUrl(gameId, gameName);
  const correctionUrl =
    normalizedVersionId > 0 ? buildCorrectionUrl(normalizedVersionId) : null;

  const alternateVersions =
    missingDimensions || normalizedVersionId === -1
      ? collectAvailableVersions(versionLookup, gameId)
          .filter(
            (candidate) =>
              candidate.versionId !== normalizedVersionId && !candidate.missingDimensions,
          )
          .map((version) => {
            const cleanedName = unescapeName(version.name);
            const volumeValue =
              Number.isFinite(version.volume) && version.volume > 0
                ? version.volume
                : version.length * version.width * version.depth;
            const areaValue =
              Number.isFinite(version.area) && version.area > 0
                ? version.area
                : (() => {
                    const dims = [version.length, version.width, version.depth]
                      .filter((value) => Number.isFinite(value) && value > 0)
                      .sort((a, b) => a - b);
                    return dims.length >= 2 ? dims[0] * dims[1] : -1;
                  })();

            return {
              versionId: version.versionId,
              versionKey: version.versionKey,
              name: cleanedName,
              dimensions: {
                length: version.length,
                width: version.width,
                depth: version.depth,
              },
              volume: volumeValue,
              area: areaValue,
              language: version.language,
              versionYearPublished: version.versionYearPublished,
            };
          })
      : [];

  return {
    versionKey,
    versionId: normalizedVersionId,
    gameId,
    collectionId,
    preferred,
    name: versionName || gameName,
    versionName,
    objecttype: game?.type || item.subtype || item.objecttype,
    subtype: item.subtype,
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
    bgg: {
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
    },
    baseGameId: game?.baseGameId || gameId,
    isExpansion: Boolean(game?.isExpansion || item.subtype === 'boardgameexpansion'),
    dimensions: derivedDimensions,
    volume,
    area,
    missingDimensions,
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


