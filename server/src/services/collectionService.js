import { bggApiRequest, parseBggXml } from './bggService.js';
import { getCollection, setCollection, hashData } from './cache/index.js';
import { BGG_API_BASE, BGG_API_TOKEN } from './configService.js';
import { isStatusActive, buildVersionsUrl } from '../utils/gameUtils.js';

export const fetchCollection = async (username, includeStatuses, includeExpansionsFlag, requestId, progress) => {
  const collectionParams = new URLSearchParams({
    username,
    stats: 1,
    version: 1,
  });

  includeStatuses.forEach((statusKey) => {
    collectionParams.append(statusKey, 1);
  });

  const collectionUrl = `${BGG_API_BASE}/collection?${collectionParams.toString()}`;
  const includeKeySegment = includeStatuses.slice().sort().join('|') || 'none';
  const collectionKey = `user:${username}:includes:${includeKeySegment}:expansions:${includeExpansionsFlag}`;

  console.log('📥 Checking cache for collection...');
  progress(requestId, 'Fetching your collection from BoardGameGeek...', {
    step: 'collection',
  });

  let retries = 0;
  const maxRetries = 5;
  let collectionResponse;

  while (retries < maxRetries) {
    collectionResponse = await bggApiRequest(collectionUrl, {
      headers: {
        Authorization: `Bearer ${BGG_API_TOKEN}`,
        Accept: 'application/xml',
      },
      validateStatus: (status) => status === 200 || status === 202,
    });

    if (collectionResponse.status === 202) {
      console.log(
        `   ⏳ Collection queued (202), retrying in ${2 + retries} seconds... (attempt ${
          retries + 1
        }/${maxRetries})`,
      );
      progress(requestId, `Collection is being prepared, waiting ${2 + retries} seconds...`, {
        step: 'collection',
        retry: retries + 1,
      });
      await new Promise((resolve) => setTimeout(resolve, (2 + retries) * 1000));
      retries += 1;
    } else {
      console.log('   ✅ Collection ready (200)');
      break;
    }
  }

  if (collectionResponse.status === 202) {
    progress(requestId, 'Collection generation timed out', { error: true });
    throw new Error('Collection generation timed out. Please try again in a few moments.');
  }

  const collectionHash = hashData(collectionResponse.data);
  const cachedCollection = getCollection(collectionKey, collectionHash);

  let collection;
  if (cachedCollection) {
    console.log('   ✅ Using cached collection data');
    progress(requestId, 'Using cached collection data', {
      step: 'collection',
      cached: true,
    });
    // Return cached parsed collection directly - no need to re-parse XML
    collection = cachedCollection;
  } else {
    console.log('   📥 Collection not in cache or changed, parsing and caching...');
    progress(requestId, 'Processing collection data...', {
      step: 'collection',
      cached: false,
    });
    // Parse XML and cache the full parsed collection
    collection = await parseBggXml(collectionResponse.data);
    setCollection(collectionKey, collectionHash, collection);
  }

  return { collection, collectionKey };
};

export const filterCollectionItems = (items, includeStatuses, excludeStatuses, includeExpansionsFlag) => {
  if (!items || items.length === 0) {
    return [];
  }

  let filtered = items.filter((item) => {
    const statusAttributes = item.status?.[0]?.$ || {};

    const matchesExclude = excludeStatuses.some((statusKey) =>
      isStatusActive(statusAttributes[statusKey]),
    );
    if (matchesExclude) {
      return false;
    }

    const matchesInclude = includeStatuses.some((statusKey) =>
      isStatusActive(statusAttributes[statusKey]),
    );
    return matchesInclude;
  });

  if (!includeExpansionsFlag) {
    filtered = filtered.filter((item) => {
      const subtype = item.$.subtype;

      if (subtype === 'boardgameexpansion') {
        return false;
      }

      const categories = item.link || [];
      const hasExpansionCategory = categories.some((link) => {
        const type = link.$.type;
        const value = link.$.value;
        return (
          (type === 'boardgamecategory' && value === 'Expansion for Base-game') ||
          (type === 'boardgamefamily' && value?.includes('Expansion'))
        );
      });

      if (hasExpansionCategory) {
        console.log(
          `   → Filtering expansion by category: ${item.name?.[0]?._ || item.name?.[0]}`,
        );
        return false;
      }

      return true;
    });
  }

  return filtered;
};

export const removeDuplicateVersions = (items) => {
  const seenGameVersions = new Map();
  const duplicatesRemoved = [];

  const filtered = items.filter((item) => {
    const gameId = item.$.objectid;
    const gameName = item.name?.[0]?._ || item.name?.[0] || `ID:${gameId}`;
    const versionId = item.version?.[0]?.item?.[0]?.$?.id || 'no-version';

    if (!seenGameVersions.has(gameId)) {
      seenGameVersions.set(gameId, new Set());
    }

    const versions = seenGameVersions.get(gameId);

    if (versions.has(versionId)) {
      duplicatesRemoved.push(`${gameName} (${versionId})`);
      return false;
    }

    versions.add(versionId);
    return true;
  });

  if (duplicatesRemoved.length > 0) {
    console.log(`   → Removed ${duplicatesRemoved.length} duplicate(s)`);
  }

  return filtered;
};

export const detectMissingVersions = (items) => {
  const missingVersionGames = new Map();

  items.forEach((item) => {
    const gameId = item.$.objectid;
    const versionItem = item.version?.[0];
    const gameName = item.name?.[0]?._ || item.name?.[0] || `ID:${gameId}`;

    if (!versionItem || !versionItem.item || versionItem.item.length === 0) {
      if (!missingVersionGames.has(gameId)) {
        missingVersionGames.set(gameId, {
          id: gameId,
          name: gameName,
          versionsUrl: buildVersionsUrl(gameId, gameName),
        });
      }
    }
  });

  return missingVersionGames;
};

