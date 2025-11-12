import { extractVersionLabelFromName, extractVersionId, buildVersionsUrl, buildCorrectionUrl } from './gameUtils.js';

export const DEFAULT_DIMENSIONS = {
  length: 12.8,
  width: 1.8,
  depth: 12.8,
  weight: null,
  missingDimensions: true,
};

export const getFallbackVersionLabel = (game) => {
  return game.versionName || extractVersionLabelFromName(game.name) || null;
};

export const extractVersionIdFromGameId = (gameId) => {
  if (!gameId || typeof gameId !== 'string') return null;
  const parts = gameId.split('-');
  return parts.length >= 2 ? parts[parts.length - 1] : null;
};

export const hasMissingDimensions = (dimensions) => {
  if (!dimensions) return true;
  return (
    dimensions.missingDimensions ||
    (dimensions.length === 0 && dimensions.width === 0 && dimensions.depth === 0)
  );
};

export const setupGameVersionMetadata = (game, gameId, versionId, missingVersionInfo) => {
  const normalizedVersionId = extractVersionId(game, versionId);
  game.selectedVersionId = normalizedVersionId;
  
  if (!game.versionsUrl) {
    game.versionsUrl = missingVersionInfo?.versionsUrl || buildVersionsUrl(gameId, game.name || `ID:${gameId}`);
  }
  
  game.missingVersion = !!missingVersionInfo;
  if (missingVersionInfo) {
    game.versionsUrl = missingVersionInfo.versionsUrl;
  }
  
  game.usedAlternateVersionDims = false;
  game.correctionUrl = null;
};

export const updateGameCorrectionUrl = (game, versionId) => {
  if (hasMissingDimensions(game.dimensions)) {
    const versionIdForCorrection = extractVersionId(game, versionId);
    game.correctionUrl = versionIdForCorrection ? buildCorrectionUrl(versionIdForCorrection) : null;
  }
};

export const removeInternalProperties = (game) => {
  if (game._group !== undefined || '_group' in game) {
    console.error(`   ❌ ERROR: Game "${game.name}" (${game.id}) has _group property!`);
    delete game._group;
  }
  if (game._groupId !== undefined || '_groupId' in game) {
    delete game._groupId;
  }
};

