
const toInteger = (value) => {
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
};

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

const toPositiveNumber = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return null;
  }
  return Number(number.toFixed(3));
};

export const createDimensionOverrideEntry = (game, rawDimensions) => {
  const identity = resolveGameIdentity(game);
  if (!identity) {
    return null;
  }

  const length = toPositiveNumber(rawDimensions?.length);
  const width = toPositiveNumber(rawDimensions?.width);
  const height = toPositiveNumber(rawDimensions?.depth ?? rawDimensions?.height);

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

