import { hasMissingDimensions } from '../utils/gameProcessingHelpers.js';
import { calculateStatsSummary, getOversizedStuffedGames } from './packingService.js';
import { PACKING_DISPLAY_CONSTANTS } from './packingCubeService.js';

const DIMENSION_PRIORITY = ['user', 'version', 'guessed', 'default'];
const STATUS_KEYS = [
  'own',
  'prevowned',
  'fortrade',
  'want',
  'wanttobuy',
  'wanttoplay',
  'wishlist',
  'preordered',
];

const normalizePositiveNumber = (value) =>
  Number.isFinite(value) && value > 0 ? value : null;

const normalizeNumber = (value, fallback = 0) =>
  Number.isFinite(value) ? value : fallback;

const toIntegerOrFallback = (value, fallback = -1) =>
  Number.isInteger(value) ? value : fallback;

const cloneList = (value) => (Array.isArray(value) ? [...value] : []);

const CUBE_DISPLAY_AREA =
  PACKING_DISPLAY_CONSTANTS.DISPLAY_KALLAX_WIDTH *
  PACKING_DISPLAY_CONSTANTS.DISPLAY_KALLAX_HEIGHT;

const clampPercentage = (value) => Math.min(Math.max(value, 0), 100);

const computeGameArea = (game) => {
  if (Number.isFinite(game.area) && game.area > 0) {
    return game.area;
  }

  const length =
    Number.isFinite(game.dimensions?.length) && game.dimensions.length > 0
      ? game.dimensions.length
      : null;
  const width =
    Number.isFinite(game.dimensions?.width) && game.dimensions.width > 0
      ? game.dimensions.width
      : null;

  if (length && width) {
    return length * width;
  }

  const packedWidth =
    Number.isFinite(game.packedDims?.x) && game.packedDims.x > 0
      ? game.packedDims.x
      : null;
  const packedHeight =
    Number.isFinite(game.packedDims?.y) && game.packedDims.y > 0
      ? game.packedDims.y
      : null;

  if (packedWidth && packedHeight) {
    return packedWidth * packedHeight;
  }

  return 0;
};

const buildDimensionEntry = (type, source) => {
  if (!source) {
    return null;
  }

  return {
    type,
    length: normalizePositiveNumber(source.length),
    width: normalizePositiveNumber(source.width),
    depth: normalizePositiveNumber(source.depth),
    weight: normalizePositiveNumber(source.weight),
    missingDimensions: Boolean(source.missingDimensions),
  };
};

const buildDimensions = (game) => {
  const sources = game.dimensionSources || {};
  const entries = [];

  for (const type of DIMENSION_PRIORITY) {
    const entry = buildDimensionEntry(type, sources[type]);
    if (entry) {
      entries.push(entry);
    }
  }

  if (entries.length === 0) {
    const fallback = {
      length: game.dimensions?.length,
      width: game.dimensions?.width,
      depth: game.dimensions?.depth,
      weight: game.dimensions?.weight,
      missingDimensions: game.dimensions?.missingDimensions ?? true,
    };
    const entry = buildDimensionEntry(
      game.selectedDimensionSource || 'version',
      fallback,
    );
    if (entry) {
      entries.push(entry);
    }
  }

  return entries;
};

const buildStatuses = (statuses = {}) => {
  return STATUS_KEYS.reduce((acc, key) => {
    acc[key] = Boolean(statuses[key]);
    return acc;
  }, {});
};

const buildStartPosition = (game) => ({
  x: normalizeNumber(game.position?.x, 0),
  y: normalizeNumber(game.position?.y, 0),
});

const buildOversized = (game) => {
  const oversizedX = Boolean(game.oversizedX);
  const oversizedY = Boolean(game.oversizedY);
  return {
    x: oversizedX,
    y: oversizedY,
    isOversized: oversizedX || oversizedY,
  };
};

const buildOrientation = (game) => {
  const forced = game.forcedOrientation ?? null;
  let applied = game.appliedOrientation ?? null;

  if (!applied) {
    const width = game.packedDims?.x ?? game.dimensions?.width ?? 0;
    const height = game.packedDims?.y ?? game.dimensions?.depth ?? 0;
    applied = width >= height ? 'horizontal' : 'vertical';
  }

  return {
    forced,
    applied,
  };
};

const transformGameForResponse = (game) => {
  const normalizedGameType =
    game.gameType || game.objectType || game.subType || 'boardgame';
  const normalizedSubtype = game.subType || normalizedGameType;

  const response = {
    gameId: toIntegerOrFallback(game.gameId, -1),
    versionId: toIntegerOrFallback(game.versionId, -1),
    versionKey: String(game.versionKey ?? game.id ?? ''),
    gameName: game.gameName || game.name || `ID:${game.gameId}`,
    versionName: game.versionName || game.name || `ID:${game.versionId}`,
    collectionId: toIntegerOrFallback(game.collectionId, -1),
    gamePublishedYear: toIntegerOrFallback(game.gamePublishedYear, -1),
    versionPublishedYear: toIntegerOrFallback(game.versionPublishedYear, -1),
    gameType: normalizedGameType,
    subType: normalizedSubtype,
    statuses: buildStatuses(game.statuses),
    dimensions: buildDimensions(game),
    startPosition: buildStartPosition(game),
    oversized: buildOversized(game),
    categories: cloneList(game.categories),
    mechanics: cloneList(game.mechanics),
    families: cloneList(game.families),
    bggRank: toIntegerOrFallback(game.bggRank, -1),
    minPlayers: toIntegerOrFallback(game.minPlayers, -1),
    maxPlayers: toIntegerOrFallback(game.maxPlayers, -1),
    bestPlayerCount: toIntegerOrFallback(game.bestPlayerCount, -1),
    minPlaytime: toIntegerOrFallback(game.minPlaytime, -1),
    maxPlaytime: toIntegerOrFallback(game.maxPlaytime, -1),
    minAge: toIntegerOrFallback(game.minAge, -1),
    communityAge: toIntegerOrFallback(game.communityAge, -1),
    languageDependence: toIntegerOrFallback(game.languageDependence, -1),
    bggWeight: Number.isFinite(game.bggWeight) ? game.bggWeight : -1,
    bggRating: Number.isFinite(game.bggRating) ? game.bggRating : -1,
    isExpansion: Boolean(game.isExpansion),
    numplays: toIntegerOrFallback(game.numplays, 0),
    volume: Number.isFinite(game.volume) ? game.volume : -1,
    area: Number.isFinite(game.area) ? game.area : -1,
    missingDimensions: Boolean(
      game.missingDimensions ?? hasMissingDimensions(game.dimensions),
    ),
    missingVersion: Boolean(game.missingVersion),
    versionsUrl: game.versionsUrl || null,
    usedAlternateVersionDims: Boolean(game.usedAlternateVersionDims),
    correctionUrl: game.correctionUrl || null,
    orientation: buildOrientation(game),
  };

  if (game.thumbnail) {
    response.thumbnail = game.thumbnail;
  }
  if (game.image) {
    response.image = game.image;
  }

  return response;
};

const buildCubeStats = (cube, stacking) => {
  const totalGames = Array.isArray(cube.games) ? cube.games.length : 0;
  const totalAreaUsed = (cube.games || []).reduce(
    (sum, game) => sum + computeGameArea(game),
    0,
  );
  const cubeArea = CUBE_DISPLAY_AREA > 0 ? CUBE_DISPLAY_AREA : 1;
  const utilization =
    cubeArea > 0
      ? Number(
          clampPercentage((totalAreaUsed / cubeArea) * 100).toFixed(1),
        )
      : 0;

  return {
    totalGames,
    areaUsed: Number(totalAreaUsed.toFixed(2)),
    areaCapacity: cubeArea,
    utilization,
  };
};

const buildDimensionSummary = (cubes) => {
  const summary = {
    guessedVersionCount: 0,
    selectedVersionFallbackCount: 0,
    missingDimensionCount: 0,
    exceedingCapacityCount: 0,
  };

  for (const cube of cubes) {
    for (const game of cube.games || []) {
      if (game.selectedDimensionSource === 'guessed') {
        summary.guessedVersionCount += 1;
      }
      if (game.usedAlternateVersionDims) {
        summary.selectedVersionFallbackCount += 1;
      }
      if (hasMissingDimensions(game.dimensions)) {
        summary.missingDimensionCount += 1;
      }
      if (game.oversizedX || game.oversizedY) {
        summary.exceedingCapacityCount += 1;
      }
    }
  }

  return summary;
};

const normalizeOversizedGames = (packedCubes, oversizedExcludedGames) => {
  const normalized = [];
  const stuffedGames = getOversizedStuffedGames(packedCubes) || [];

  for (const item of stuffedGames) {
    const entry = {
      id: String(item.id),
      name: item.name,
      status: item.status,
      correctionUrl: item.correctionUrl ?? null,
      versionsUrl: item.versionsUrl ?? null,
      baseGameId: Number.isInteger(item.baseGameId) ? item.baseGameId : null,
    };
    if (Number.isInteger(item.cubeId)) {
      entry.cubeId = item.cubeId;
    }
    normalized.push(entry);
  }

  if (Array.isArray(oversizedExcludedGames)) {
    for (const item of oversizedExcludedGames) {
      const entry = {
        id: String(item.id),
        name: item.name,
        status: item.status || 'excluded',
        correctionUrl: item.correctionUrl ?? null,
        versionsUrl: item.versionsUrl ?? null,
        baseGameId: Number.isInteger(item.baseGameId) ? item.baseGameId : null,
      };
      if (item.dimensions) {
        entry.dimensions = {
              length: normalizePositiveNumber(item.dimensions.length),
              width: normalizePositiveNumber(item.dimensions.width),
              depth: normalizePositiveNumber(item.dimensions.depth),
        };
      }
      normalized.push(entry);
    }
  }

  return normalized;
};

export const serializeCubesResponse = (
  packedCubes,
  _gamesToPack,
  stacking,
  oversizedExcludedGames,
) => {
  console.log(`   📦 Preparing response for ${packedCubes.length} cubes`);

  const stats = calculateStatsSummary(packedCubes, stacking);
  const cubes = packedCubes.map((cube) => ({
    id: cube.id,
    stats: buildCubeStats(cube, stacking),
    games: (cube.games || []).map(transformGameForResponse),
  }));

  const dimensionSummary = buildDimensionSummary(packedCubes);
  const oversizedGames = normalizeOversizedGames(packedCubes, oversizedExcludedGames);

  return {
    cubes,
    stats,
    dimensionSummary,
    oversizedGames,
  };
};

