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
 * Creates a dimension override entry from a game object and raw dimensions.
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

  return {
    ...identity,
    name: game?.displayName || game?.gameName || `ID:${identity.gameId}`,
    versionName: game?.versionName || null,
    length,
    width,
    height,
    depth: height,
  };
};

