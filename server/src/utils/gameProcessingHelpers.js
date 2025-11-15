import { normalizePositiveNumber } from './numberUtils.js';

/**
 * Checks if dimensions are missing (length, width, or depth are 0 or null).
 * If the dimensions object has a 'missing' property, uses that.
 * Otherwise, checks the length, width, and depth values directly.
 */
export const checkMissingDimensions = (dimensions) => {
  if (!dimensions) {
    return true;
  }
  
  // If missing property exists, use it
  if (typeof dimensions.missing === 'boolean') {
    return dimensions.missing;
  }
  
  // Otherwise check the dimension values directly
  const { length, width, depth } = dimensions;
  return (
    length == null || length === 0 ||
    width == null || width === 0 ||
    depth == null || depth === 0
  );
};

/**
 * Checks if dimensions are valid (all three dimensions are finite and positive).
 * @param {Object} dimensions - The dimensions object with length, width, and depth
 * @returns {boolean} True if all dimensions are valid
 */
export const hasValidDimensions = (dimensions) => {
  if (!dimensions) {
    return false;
  }
  return (
    Number.isFinite(dimensions.length) &&
    dimensions.length > 0 &&
    Number.isFinite(dimensions.width) &&
    dimensions.width > 0 &&
    Number.isFinite(dimensions.depth) &&
    dimensions.depth > 0
  );
};

/**
 * Extracts and normalizes dimensions from a game object.
 * @param {Object} game - The game object
 * @returns {Object} Normalized dimensions object with length, width, depth, weight, and missing
 */
export const extractDimensions = (game) => {
  if (!game || !game.dimensions) {
    return {
      length: null,
      width: null,
      depth: null,
      weight: null,
      missing: true,
    };
  }

  return {
    length: normalizePositiveNumber(game.dimensions.length),
    width: normalizePositiveNumber(game.dimensions.width),
    depth: normalizePositiveNumber(game.dimensions.depth),
    weight: normalizePositiveNumber(game.dimensions.weight),
    missing: game.dimensions.missing ?? checkMissingDimensions({
      length: game.dimensions.length,
      width: game.dimensions.width,
      depth: game.dimensions.depth,
    }),
  };
};

export const DEFAULT_DIMENSIONS = {
  length: 11.7,
  width: 11.7,
  depth: 2.8,
  weight: null,
  missing: true,
};

export const getFallbackVersionLabel = (game) => {
  if (game.versionName) {
    return game.versionName;
  }
  const name = game.name;
  if (!name || typeof name !== 'string') {
    return null;
  }
  const match = name.trim().match(/\(([^()]+)\)\s*$/);
  if (!match) {
    return null;
  }
  const label = match[1]?.trim();
  return label && label.length > 0 ? label : null;
};



export const setupGameVersionMetadata = (game, gameId, versionId, noSelectedVersionInfo) => {
  // Use versionId directly, or game.versionId if available
  game.selectedVersionId = Number.isInteger(game.versionId) && game.versionId !== -1 
    ? game.versionId 
    : (versionId && versionId !== 'default' ? versionId : null);
  
  // URLs should already be set from orchestrator
  // If noSelectedVersionInfo exists, use its URLs
  if (noSelectedVersionInfo) {
    game.versionsUrl = noSelectedVersionInfo.versionsUrl || game.versionsUrl || null;
  }
  
  game.noSelectedVersion = !!noSelectedVersionInfo;
  game.usedAlternateVersionDims = false;
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

