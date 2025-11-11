import { extractVersionLabelFromName, extractVersionId, buildVersionsUrl, buildCorrectionUrl } from './gameUtils.js';

export const DEFAULT_DIMENSIONS = {
  length: 12.8,
  width: 12.8,
  depth: 1.8,
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

export const createCleanGameObject = (game) => {
  const versionLabel = getFallbackVersionLabel(game);
  
  return {
    id: game.id,
    name: game.name,
    dimensions: game.dimensions ? { ...game.dimensions } : game.dimensions,
    position: game.position ? { ...game.position } : game.position,
    packedDims: game.packedDims ? { ...game.packedDims } : game.packedDims,
    actualDims: game.actualDims ? { ...game.actualDims } : game.actualDims,
    orientedDims: game.orientedDims ? { ...game.orientedDims } : game.orientedDims,
    actualOrientedDims: game.actualOrientedDims ? { ...game.actualOrientedDims } : game.actualOrientedDims,
    oversizedX: game.oversizedX,
    oversizedY: game.oversizedY,
    categories: game.categories ? [...(game.categories || [])] : [],
    families: game.families ? [...(game.families || [])] : [],
    bggRank: game.bggRank,
    minPlayers: game.minPlayers,
    maxPlayers: game.maxPlayers,
    bestPlayerCount: game.bestPlayerCount,
    minPlaytime: game.minPlaytime,
    maxPlaytime: game.maxPlaytime,
    age: game.age,
    communityAge: game.communityAge,
    weight: game.weight,
    bggRating: game.bggRating,
    baseGameId: game.baseGameId,
    isExpansion: game.isExpansion,
    familyIds: game.familyIds ? [...(game.familyIds || [])] : [],
    missingVersion: !!game.missingVersion,
    versionsUrl: game.versionsUrl || null,
    usedAlternateVersionDims: !!game.usedAlternateVersionDims,
    versionName: versionLabel,
    correctionUrl: game.correctionUrl || null,
    selectedVersionId: game.selectedVersionId || null,
    bggDimensions: game.bggDimensions ? { ...game.bggDimensions } : null,
    userDimensions: game.userDimensions ? { ...game.userDimensions } : null,
    forcedOrientation: game.forcedOrientation || null,
    appliedOrientation: game.appliedOrientation || null,
  };
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

