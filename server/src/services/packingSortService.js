import { extractBaseGameId, extractVersionId } from '../utils/gameUtils.js';

const normalizeSortValue = (value) => {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === 'string') {
    return value.toLowerCase();
  }
  return value;
};

const getGameSortValue = (game, field) => {
  switch (field) {
    case 'gameName':
      return normalizeSortValue(game.name);
    case 'versionName':
      return normalizeSortValue(game.versionName);
    case 'gameId': {
      const id = extractBaseGameId(game);
      return id ? Number.parseInt(id, 10) : Number.MAX_SAFE_INTEGER;
    }
    case 'versionId': {
      const versionId = extractVersionId(game, game.selectedVersionId);
      if (!versionId || versionId === 'default') {
        return Number.MAX_SAFE_INTEGER;
      }
      const parsed = Number.parseInt(versionId, 10);
      return Number.isNaN(parsed) ? versionId : parsed;
    }
    case 'categories':
      return normalizeSortValue(game.categories?.[0] || '');
    case 'families':
      return normalizeSortValue(game.families?.[0] || '');
    case 'mechanics':
      return normalizeSortValue(game.mechanics?.[0] || '');
    default:
      return game[field] ?? null;
  }
};

export const compareGames = (game1, game2, sortRules) => {
  for (const rule of sortRules) {
    if (!rule || !rule.field) {
      continue;
    }

    const order = rule.order === 'desc' ? -1 : 1;
    const val1 = getGameSortValue(game1, rule.field);
    const val2 = getGameSortValue(game2, rule.field);

    if (val1 === val2) {
      continue;
    }

    if (val1 === null) {
      return 1 * order;
    }
    if (val2 === null) {
      return -1 * order;
    }

    if (val1 < val2) {
      return -1 * order;
    }
    if (val1 > val2) {
      return 1 * order;
    }
  }

  return 0;
};

export const sortGamesByArea = (games) => {
  return [...games].sort((a, b) => {
    const areaA = (a.dims2D?.x || 0) * (a.dims2D?.y || 0);
    const areaB = (b.dims2D?.x || 0) * (b.dims2D?.y || 0);
    return areaB - areaA;
  });
};

