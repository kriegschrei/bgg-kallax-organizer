import { getGame, setGame, getVersion, setVersion, extractGameData } from '../../cache.js';
import { bggApiRequest, parseBggXml, processGameItem } from './bggService.js';
import { buildVersionsUrl, buildCorrectionUrl, extractVersionId } from '../utils/gameUtils.js';
import {
  getFallbackVersionLabel,
  setupGameVersionMetadata,
  updateGameCorrectionUrl,
  removeInternalProperties,
  extractVersionIdFromGameId,
} from '../utils/gameProcessingHelpers.js';
import { BGG_API_BASE, BGG_API_TOKEN } from './configService.js';

export const buildVersionMap = (items, missingVersionGames) => {
  const versionMap = new Map();

  items.forEach((item) => {
    const gameId = item.$.objectid;
    const versionItem = item.version?.[0];

    if (versionItem && versionItem.item && versionItem.item.length > 0) {
      const versionId = versionItem.item[0].$?.id || 'default';
      const versionName = versionItem.item[0].name?.[0]?.$?.value || null;
      const width = versionItem.item[0].width?.[0]?.$?.value;
      const length = versionItem.item[0].length?.[0]?.$?.value;
      const depth = versionItem.item[0].depth?.[0]?.$?.value;

      const widthNum = Number.parseFloat(width);
      const lengthNum = Number.parseFloat(length);
      const depthNum = Number.parseFloat(depth);
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
        const key = `${gameId}-${versionId}`;
        versionMap.set(key, versionInfo);
      }
    }
  });

  return versionMap;
};

export const buildGameDetailsMap = (items) => {
  const gameDetailsNeeded = new Map();

  items.forEach((item) => {
    const gameId = item.$.objectid;
    const versionId = item.version?.[0]?.item?.[0]?.$?.id || 'default';

    if (!gameDetailsNeeded.has(gameId)) {
      gameDetailsNeeded.set(gameId, []);
    }

    gameDetailsNeeded.get(gameId).push({
      collectionItem: item,
      versionId,
    });
  });

  return gameDetailsNeeded;
};

export const fetchAndProcessGames = async (
  gamesToFetch,
  gameDetailsNeeded,
  versionMap,
  missingVersionGames,
  requestId,
  progress,
) => {
  const batchSize = 10;
  const allGames = [];
  const cachedGames = new Map();

  for (let i = 0; i < gamesToFetch.length; i += batchSize) {
    const batch = gamesToFetch.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(gamesToFetch.length / batchSize);
    console.log(`📦 Fetching batch ${batchNum}/${totalBatches} (${batch.length} games)`);
    progress(requestId, `Fetching game data: batch ${batchNum}/${totalBatches}`, {
      step: 'games',
      batch: batchNum,
      totalBatches,
      gamesInBatch: batch.length,
    });

    const batchUnique = [...new Set(batch)];
    if (batchUnique.length < batch.length) {
      console.log(`   ⚠️  Batch has ${batch.length - batchUnique.length} duplicate ID(s)`);
    }

    const thingParams = new URLSearchParams({
      id: batchUnique.join(','),
      stats: 1,
    });

    const thingResponse = await bggApiRequest(
      `${BGG_API_BASE}/thing?${thingParams.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${BGG_API_TOKEN}`,
          Accept: 'application/xml',
        },
      },
    );

    const thingData = await parseBggXml(thingResponse.data);

    if (!thingData.items || !thingData.items.item) {
      continue;
    }

    const thingItems = Array.isArray(thingData.items.item)
      ? thingData.items.item
      : [thingData.items.item];

    for (const item of thingItems) {
      try {
        const gameId = item.$.id;

        const gameData = extractGameData(item);
        setGame(gameId, gameData);
        cachedGames.set(gameId, gameData);

        const versions = gameDetailsNeeded.get(gameId) || [];

        versions.forEach(({ versionId }) => {
          const key = `${gameId}-${versionId}`;
          const versionInfo = versionMap.get(key);
          const game = processGameItem(item, versionInfo, versionId);

          if (!game.versionName && versionInfo?.name) {
            game.versionName = versionInfo.name;
          }

          const missingVersionInfo = missingVersionGames.get(gameId);
          setupGameVersionMetadata(game, gameId, versionId, missingVersionInfo);

          game.id = key;
          if (!game.baseGameId && game.isExpansion) {
            console.warn(`   ⚠️  Expansion "${game.name}" (${game.id}) doesn't have baseGameId`);
          }

          allGames.push(game);
        });
      } catch (error) {
        console.error(`Error processing game ${item.$.id}:`, error.message);
      }
    }
  }

  return { allGames, cachedGames };
};

export const processCachedGames = (
  cachedGames,
  gameDetailsNeeded,
  versionMap,
  missingVersionGames,
) => {
  const allGames = [];

  for (const gameId of Array.from(cachedGames.keys())) {
    try {
      const gameData = cachedGames.get(gameId);

      removeInternalProperties(gameData);

      const versions = gameDetailsNeeded.get(gameId) || [];

      versions.forEach(({ versionId }) => {
        const key = `${gameId}-${versionId}`;

        let dimensions = null;
        let versionName = null;
        const cachedVersion = getVersion(gameId, versionId);
        if (cachedVersion) {
          if (cachedVersion.dimensions && !cachedVersion.dimensions.missingDimensions) {
            dimensions = cachedVersion.dimensions;
          }
          if (cachedVersion.name) {
            versionName = cachedVersion.name;
          }
        }

        if (!dimensions) {
          const versionInfo = versionMap.get(key);
          if (versionInfo) {
            dimensions = {
              length: Number.parseFloat(versionInfo.length),
              width: Number.parseFloat(versionInfo.width),
              depth: Number.parseFloat(versionInfo.depth),
              missingDimensions: false,
            };
            if (!versionName && versionInfo.name) {
              versionName = versionInfo.name;
            }
          }
        }

        const fallbackVersionLabel =
          versionName ||
          gameData.versionName ||
          getFallbackVersionLabel({ name: gameData.name }) ||
          null;
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
          versionName: fallbackVersionLabel,
          dimensions:
            dimensions || {
              length: 0,
              width: 0,
              depth: 0,
              missingDimensions: true,
            },
        };
        if (!gameData.versionName && fallbackVersionLabel) {
          gameData.versionName = fallbackVersionLabel;
        }

        const missingVersionInfo = missingVersionGames.get(gameId);
        game.missingVersion = !!missingVersionInfo;
        if (missingVersionInfo) {
          game.versionsUrl = missingVersionInfo.versionsUrl;
        }

        game.id = key;

        setupGameVersionMetadata(game, gameId, versionId, missingVersionInfo);

        updateGameCorrectionUrl(game, versionId);

        if (cachedVersion?.usedAlternateVersionDims) {
          game.usedAlternateVersionDims = true;
          const versionIdForCorrection = extractVersionId(game, versionId);
          if (versionIdForCorrection) {
            game.correctionUrl = buildCorrectionUrl(versionIdForCorrection);
          } else {
            game.correctionUrl = null;
          }
          console.log(
            `      ↺ Using cached alternate-version dimensions for ${game.name} (version ${versionIdForCorrection || 'default'})`,
          );
        }

        removeInternalProperties(game);

        allGames.push(game);
      });
    } catch (error) {
      console.error(`Error processing cached game ${gameId}:`, error.message);
    }
  }

  return allGames;
};

export const filterExpansionsFromGames = (allGames, includeExpansionsFlag) => {
  if (includeExpansionsFlag) {
    return allGames;
  }

  const beforeExpansionFilter = allGames.length;
  const filtered = [];

  for (const game of allGames) {
    const allTags = [...(game.categories || []), ...(game.families || [])];
    const isExpansion = allTags.some(
      (tag) =>
        tag === 'Expansion for Base-game' ||
        tag.includes('Expansion for') ||
        tag.includes('expansion for'),
    );
    if (!isExpansion) {
      filtered.push(game);
    }
  }

  if (beforeExpansionFilter > filtered.length) {
    console.log(
      `   → Filtered ${beforeExpansionFilter - filtered.length} expansions after full data fetch`,
    );
  }

  return filtered;
};

export const removeDuplicateGames = (allGames) => {
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

  return uniqueGames;
};

