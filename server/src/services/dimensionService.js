import { getVersion, setVersion, extractVersionData } from '../../cache.js';
import { bggApiRequest, parseBggXml, findDimensionsFromVersions } from './bggService.js';
import { buildCorrectionUrl, extractVersionId, extractVersionLabelFromName } from '../utils/gameUtils.js';
import { BGG_API_BASE, BGG_API_TOKEN } from './configService.js';
import { DEFAULT_DIMENSIONS, hasMissingDimensions, getFallbackVersionLabel, extractVersionIdFromGameId } from '../utils/gameProcessingHelpers.js';

export const findGamesNeedingDimensions = (allGames) => {
  const gamesNeedingFetch = [];

  for (const game of allGames) {
    if (hasMissingDimensions(game.dimensions)) {
      if (game.baseGameId && game.id) {
        const versionId = extractVersionIdFromGameId(game.id);
        if (versionId) {
          const cachedVersion = getVersion(game.baseGameId, versionId);
          if (cachedVersion && cachedVersion.dimensions && !cachedVersion.dimensions.missingDimensions) {
            game.dimensions = cachedVersion.dimensions;
            console.log(
              `      ✓ Found dimensions in cache for ${game.name}: ${cachedVersion.dimensions.width}"×${cachedVersion.dimensions.length}"×${cachedVersion.dimensions.depth}"`,
            );
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

  return gamesNeedingFetch;
};

export const fetchDimensionsForGames = async (gamesNeedingFetch, requestId, progress) => {
  if (gamesNeedingFetch.length === 0) {
    return;
  }

  console.log(`📏 Fetching dimensions for ${gamesNeedingFetch.length} games...`);
  progress(requestId, `Fetching dimensions for ${gamesNeedingFetch.length} games...`, {
    step: 'dimensions',
    count: gamesNeedingFetch.length,
  });

  const dimBatchSize = 5;
  for (let i = 0; i < gamesNeedingFetch.length; i += dimBatchSize) {
    const batch = gamesNeedingFetch.slice(i, i + dimBatchSize);
    const batchIds = batch.map((g) => g.baseGameId).filter(Boolean);

    if (batchIds.length === 0) continue;

    const dimBatchNum = Math.floor(i / dimBatchSize) + 1;
    const dimTotalBatches = Math.ceil(gamesNeedingFetch.length / dimBatchSize);
    console.log(`   📦 Dimension batch ${dimBatchNum}/${dimTotalBatches}`);
    progress(requestId, `Fetching dimensions: batch ${dimBatchNum}/${dimTotalBatches}`, {
      step: 'dimensions',
      batch: dimBatchNum,
      totalBatches: dimTotalBatches,
    });

    const versionParams = new URLSearchParams({
      id: batchIds.join(','),
      versions: 1,
    });

    try {
      const versionResponse = await bggApiRequest(
        `${BGG_API_BASE}/thing?${versionParams.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${BGG_API_TOKEN}`,
            Accept: 'application/xml',
          },
        },
      );

      const versionData = await parseBggXml(versionResponse.data);

      if (versionData.items?.item) {
        const versionItems = Array.isArray(versionData.items.item)
          ? versionData.items.item
          : [versionData.items.item];

        versionItems.forEach((item) => {
          const gameId = item.$.id;
          const versions = item.versions?.[0]?.item || [];

          if (Array.isArray(versions)) {
            versions.forEach((versionItem) => {
              const versionInfo = extractVersionData(versionItem);
              if (versionInfo.versionId) {
                setVersion(gameId, versionInfo.versionId, versionInfo);
              }
            });
          }

          const dimensions = findDimensionsFromVersions(item);

          batch.forEach((game) => {
            if (game.baseGameId === gameId) {
              if (game.baseGameId && game.id) {
                const versionId = extractVersionIdFromGameId(game.id);
                if (versionId) {
                  if (dimensions && !dimensions.missingDimensions) {
                    game.dimensions = dimensions;
                    console.log(
                      `      ✓ Found dimensions for ${game.name}: ${dimensions.width}"×${dimensions.length}"×${dimensions.depth}"`,
                    );

                    const fallbackVersionLabel = getFallbackVersionLabel(game);
                    if (!game.versionName && fallbackVersionLabel) {
                      game.versionName = fallbackVersionLabel;
                    }
                    const versionDataToCache = {
                      versionId,
                      name: fallbackVersionLabel,
                      yearPublished: null,
                      dimensions,
                      usedAlternateVersionDims: !game.missingVersion,
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
                      console.log(
                        `      🔄 Used alternate version dimensions for selected version of ${game.name} (version ${versionIdForCorrection || 'default'})`,
                      );
                    }
                  } else {
                    const fallbackVersionLabel = getFallbackVersionLabel(game);
                    if (!game.versionName && fallbackVersionLabel) {
                      game.versionName = fallbackVersionLabel;
                    }
                    const versionDataToCache = {
                      versionId,
                      name: fallbackVersionLabel,
                      yearPublished: null,
                      dimensions: DEFAULT_DIMENSIONS,
                      usedAlternateVersionDims: false,
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
    } catch (error) {
      console.error(`   ❌ Error fetching dimensions for batch: ${error.message}`);
    }
  }
};

export const applyDefaultDimensions = (allGames) => {
  let gamesWithDefaultDimensions = 0;

  allGames.forEach((game) => {
    if (
      game.dimensions.length === 0 &&
      game.dimensions.width === 0 &&
      game.dimensions.depth === 0
    ) {
      game.dimensions = { ...DEFAULT_DIMENSIONS };
      game.usedAlternateVersionDims = false;
      if (game.selectedVersionId) {
        game.correctionUrl = buildCorrectionUrl(game.selectedVersionId);
      } else {
        game.correctionUrl = null;
      }
      gamesWithDefaultDimensions += 1;

      if (game.baseGameId && game.id) {
        const versionId = extractVersionIdFromGameId(game.id);
        if (versionId) {
          const fallbackVersionLabel = getFallbackVersionLabel(game);
          if (!game.versionName && fallbackVersionLabel) {
            game.versionName = fallbackVersionLabel;
          }
          const versionDataToCache = {
            versionId,
            name: fallbackVersionLabel,
            yearPublished: null,
            dimensions: game.dimensions,
            usedAlternateVersionDims: false,
          };
          setVersion(game.baseGameId, versionId, versionDataToCache);
        }
      }
    }
  });

  if (gamesWithDefaultDimensions > 0) {
    console.log(
      `⚠️  Applied default dimensions (12.8"×12.8"×1.8") to ${gamesWithDefaultDimensions} games`,
    );
  }
};

