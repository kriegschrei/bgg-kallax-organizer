import { checkMissingDimensions, normalizeDimensions } from '../utils/gameProcessingHelpers.js';
import { calculateStatsSummary, getOversizedStuffedGames } from './packingService.js';
import { PACKING_DISPLAY_CONSTANTS } from './packingCubeService.js';
import { getSafeGameArea } from '../utils/packingHelpers.js';
import {
  normalizePositiveNumber,
  normalizeNumber,
  toIntegerOrFallback,
} from '../utils/numberUtils.js';
import { cloneList } from '../utils/arrayUtils.js';
import { COLLECTION_STATUS_KEYS } from '../utils/gameUtils.js';

const DIMENSION_PRIORITY = ['user', 'version', 'guessed', 'default'];

const CUBE_DISPLAY_AREA =
  PACKING_DISPLAY_CONSTANTS.DISPLAY_KALLAX_WIDTH *
  PACKING_DISPLAY_CONSTANTS.DISPLAY_KALLAX_HEIGHT;

const clampPercentage = (value) => Math.min(Math.max(value, 0), 100);

const buildDimensionEntry = (type, source) => {
  if (!source) {
    return null;
  }

  // Normalize dimensions to ensure length >= width >= depth
  const normalized = normalizeDimensions(source);

  return {
    type,
    length: normalized.length,
    width: normalized.width,
    depth: normalized.depth,
    weight: normalized.weight,
    missing: normalized.missing,
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

  // If version dimension is missing but game has a versionId, include it as missing
  // This allows the frontend to detect missing dimensions correctly
  if (!sources.version && game.versionId !== undefined && game.versionId !== -1) {
    const noSelectedVersionEntry = {
      type: 'version',
      length: null,
      width: null,
      depth: null,
      weight: null,
      missing: true,
    };
    entries.unshift(noSelectedVersionEntry); // Add at the beginning to maintain priority order
  }

  if (entries.length === 0) {
    const fallback = {
      length: game.dimensions?.length,
      width: game.dimensions?.width,
      depth: game.dimensions?.depth,
      weight: game.dimensions?.weight,
      missing: game.dimensions?.missing ?? true,
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
  return COLLECTION_STATUS_KEYS.reduce((acc, key) => {
    acc[key] = Boolean(statuses[key]);
    return acc;
  }, {});
};

const buildPosition = (game) => ({
  x: normalizeNumber(game.position?.x, 0),
  y: normalizeNumber(game.position?.y, 0),
});

const buildPackedDims = (game) => ({
  x: normalizeNumber(game.packedDims?.x, 0),
  y: normalizeNumber(game.packedDims?.y, 0),
  z: normalizeNumber(game.packedDims?.z, 0),
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
    gameName: game.gameName,
    versionName: game.versionName,
    displayName: game.displayName,
    collectionId: toIntegerOrFallback(game.collectionId, -1),
    gamePublishedYear: toIntegerOrFallback(game.gamePublishedYear, -1),
    versionPublishedYear: toIntegerOrFallback(game.versionPublishedYear, -1),
    gameType: normalizedGameType,
    subType: normalizedSubtype,
    statuses: buildStatuses(game.statuses),
    dimensions: buildDimensions(game),
    position: buildPosition(game),
    packedDims: buildPackedDims(game),
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
    noSelectedVersion: Boolean(game.noSelectedVersion),
    versionsUrl: game.versionsUrl || null,
    usedAlternateVersionDims: Boolean(game.usedAlternateVersionDims),
    bggDefaultDimensions: Boolean(game.bggDefaultDimensions),
    allVersionsMissingDimensions: Boolean(game.allVersionsMissingDimensions),
    selectedVersionMissingDimensions: Boolean(game.selectedVersionMissingDimensions),
    guessedDueToNoVersion: Boolean(game.guessedDueToNoVersion),
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

const buildCubeStats = (cube) => {
  const totalGames = Array.isArray(cube.games) ? cube.games.length : 0;
  const totalAreaUsed = (cube.games || []).reduce(
    (sum, game) => sum + getSafeGameArea(game),
    0,
  );
  const cubeArea = CUBE_DISPLAY_AREA > 0 ? CUBE_DISPLAY_AREA : 1;
  const totalUtilization =
    cubeArea > 0
      ? Number(
          clampPercentage((totalAreaUsed / cubeArea) * 100).toFixed(1),
        )
      : 0;

  return {
    totalGames,
    areaUsed: Number(totalAreaUsed.toFixed(2)),
    areaCapacity: cubeArea,
    totalUtilization,
  };
};

const buildDimensionSummary = (cubes) => {
  const summary = {
    guessedVersionCount: 0,
    selectedVersionMissingDimensionsCount: 0,
    missingDimensionCount: 0,
    exceedingCapacityCount: 0,
  };

  for (const cube of cubes) {
    for (const game of cube.games || []) {
      if (game.selectedDimensionSource === 'guessed') {
        summary.guessedVersionCount += 1;
      }
      if (game.usedAlternateVersionDims) {
        summary.selectedVersionMissingDimensionsCount += 1;
      }
      if (checkMissingDimensions(game.dimensions)) {
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
      displayName: item.displayName,
      gameName: item.gameName || null,
      versionName: item.versionName || null,
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
        displayName: item.displayName,
        gameName: item.gameName || null,
        versionName: item.versionName || null,
        status: item.status || 'excluded',
        correctionUrl: item.correctionUrl ?? null,
        versionsUrl: item.versionsUrl ?? null,
        baseGameId: Number.isInteger(item.baseGameId) ? item.baseGameId : null,
      };
      if (item.dimensions) {
        // Normalize dimensions to ensure length >= width >= depth
        const normalized = normalizeDimensions(item.dimensions);
        entry.dimensions = {
          length: normalized.length,
          width: normalized.width,
          depth: normalized.depth,
        };
      }
      normalized.push(entry);
    }
  }

  return normalized;
};

export const serializeCubesResponse = (
  packedCubes,
  stacking,
  oversizedExcludedGames,
) => {
  console.log(`   📦 Preparing response for ${packedCubes.length} cubes`);

  const stats = calculateStatsSummary(packedCubes, stacking);
  const cubes = packedCubes.map((cube) => ({
    id: cube.id,
    stats: buildCubeStats(cube),
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

