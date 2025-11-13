import { getSafeGameArea } from '../utils/packingHelpers.js';

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
      return normalizeSortValue(game.gameName || game.name || '');
    case 'versionName':
      return normalizeSortValue(game.versionName);
    case 'gameId': {
      const id = game.gameId;
      return Number.isInteger(id) && id > 0 ? id : Number.MAX_SAFE_INTEGER;
    }
    case 'versionId': {
      const versionId = game.versionId;
      if (!Number.isInteger(versionId) || versionId === -1) {
        return Number.MAX_SAFE_INTEGER;
      }
      return versionId;
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
    const areaA = getSafeGameArea(a);
    const areaB = getSafeGameArea(b);
    return areaB - areaA;
  });
};

