import { toInteger, toPositiveNumber } from './helpers';

export const ORIENTATION_OPTIONS = new Set(['horizontal', 'vertical']);

export const buildOverrideKey = (gameId, versionId) => `${gameId}:${versionId}`;

export const resolveGameIdentity = (game) => {
  const gameId = toInteger(game?.gameId ?? game?.id ?? game?.gameID);
  const versionId = toInteger(game?.versionId ?? game?.version ?? game?.versionID);

  if (gameId === null || versionId === null) {
    return null;
  }

  return {
    gameId,
    versionId,
    key: buildOverrideKey(gameId, versionId),
  };
};

/**
 * Creates an excluded override entry from a game object.
 * @param {Object} game - The game object
 * @returns {Object|null} Override entry object or null if invalid
 */
export const createExcludedOverrideEntry = (game) => {
  const identity = resolveGameIdentity(game);
  if (!identity) {
    return null;
  }

  return {
    ...identity,
    name: game?.displayName || game?.gameName || `ID:${identity.gameId}`,
    versionName: game?.versionName || null,
  };
};

/**
 * Creates an orientation override entry from a game object and orientation.
 * @param {Object} game - The game object
 * @param {string} orientation - The orientation ('horizontal' or 'vertical')
 * @returns {Object|null} Override entry object or null if invalid
 */
export const createOrientationOverrideEntry = (game, orientation) => {
  const identity = resolveGameIdentity(game);
  if (!identity) {
    return null;
  }

  const normalizedOrientation =
    typeof orientation === 'string' && ORIENTATION_OPTIONS.has(orientation)
      ? orientation
      : null;

  if (!normalizedOrientation) {
    return null;
  }

  return {
    ...identity,
    name: game?.displayName || game?.gameName || `ID:${identity.gameId}`,
    versionName: game?.versionName || null,
    orientation: normalizedOrientation,
  };
};

/**
 * Normalizes dimensions by sorting them to ensure:
 * - length = largest dimension
 * - width = second largest dimension
 * - depth = smallest dimension
 * @param {number} dim1 - First dimension
 * @param {number} dim2 - Second dimension
 * @param {number} dim3 - Third dimension
 * @returns {Object} Normalized dimensions object with length, width, depth
 */
const normalizeDimensions = (dim1, dim2, dim3) => {
  const sorted = [dim1, dim2, dim3].sort((a, b) => b - a); // Sort descending
  return {
    length: sorted[0], // largest
    width: sorted[1],  // middle
    depth: sorted[2],  // smallest
  };
};

/**
 * Creates a dimension override entry from a game object and raw dimensions.
 * Dimensions are normalized so length >= width >= depth.
 * @param {Object} game - The game object
 * @param {Object} rawDimensions - Raw dimensions object with length, width, depth/height
 * @returns {Object|null} Override entry object or null if invalid
 */
export const createDimensionOverrideEntry = (game, rawDimensions) => {
  const identity = resolveGameIdentity(game);
  if (!identity) {
    return null;
  }

  const length = toPositiveNumber(rawDimensions?.length);
  const width = toPositiveNumber(rawDimensions?.width);
  const heightRaw = toPositiveNumber(rawDimensions?.depth ?? rawDimensions?.height);
  const height = heightRaw !== null ? Number(heightRaw.toFixed(3)) : null;

  if (length === null || width === null || height === null) {
    return null;
  }

  // Normalize dimensions: sort so length >= width >= depth
  const normalized = normalizeDimensions(length, width, height);

  return {
    ...identity,
    name: game?.displayName || game?.gameName || `ID:${identity.gameId}`,
    versionName: game?.versionName || null,
    length: normalized.length,
    width: normalized.width,
    height: normalized.depth,
    depth: normalized.depth,
  };
};

