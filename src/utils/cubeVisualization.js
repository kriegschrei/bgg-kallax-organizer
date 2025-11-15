import { resolveGameIdentity } from './overrideIdentity';
import { getPrimaryDimension } from './dimensions';
import { formatWeight } from './unitConversion';

/**
 * Generates a color for a game item based on its index.
 * @param {number} index - The index of the game
 * @param {number} total - Total number of games
 * @returns {string} HSL color string
 */
export function getGameColor(index, total) {
  return `hsl(${(index * 360) / total}, 70%, 80%)`;
}

/**
 * Splits a full game name into base name and version.
 * @param {string} fullName - The full game name potentially containing version in parentheses
 * @returns {Object} Object with name and version properties
 */
export function splitNameAndVersion(fullName) {
  if (typeof fullName !== 'string') {
    return { name: '', version: null };
  }

  const trimmed = fullName.trim();
  if (!trimmed) {
    return { name: '', version: null };
  }

  const trailingVersionMatch = trimmed.match(/^(.*)\s+\(([^()]+)\)\s*$/);

  if (trailingVersionMatch) {
    const baseName = trailingVersionMatch[1]?.trim() ?? '';
    const version = trailingVersionMatch[2]?.trim() ?? null;

    if (baseName) {
      return { name: baseName, version: version || null };
    }
  }

  return { name: trimmed, version: null };
}

const getOverrideKey = (game, fallbackSuffix = '') => {
  const identity = resolveGameIdentity(game);
  if (identity?.key) {
    return identity.key;
  }
  const fallback =
    typeof game?.id === 'string' || typeof game?.id === 'number' ? String(game.id) : 'unknown';
  return fallbackSuffix ? `${fallback}-${fallbackSuffix}` : fallback;
};

export const SORTING_BADGE_BUILDERS = {
  categories: (game) =>
    Array.isArray(game.categories)
      ? game.categories
          .filter((category) => typeof category === 'string' && category.trim().length > 0)
          .map((category, index) => ({
            key: `category-${getOverrideKey(game, index)}-${category}`,
            label: category.trim(),
            field: 'categories',
          }))
      : [],
  families: (game) =>
    Array.isArray(game.families)
      ? game.families
          .filter((family) => typeof family === 'string' && family.trim().length > 0)
          .map((family, index) => ({
            key: `family-${getOverrideKey(game, index)}-${family}`,
            label: family.trim(),
            field: 'families',
          }))
      : [],
  mechanics: (game) =>
    Array.isArray(game.mechanics)
      ? game.mechanics
          .filter((mechanic) => typeof mechanic === 'string' && mechanic.trim().length > 0)
          .map((mechanic, index) => ({
            key: `mechanic-${getOverrideKey(game, index)}-${mechanic}`,
            label: mechanic.trim(),
            field: 'mechanics',
          }))
      : [],
  bggRank: (game) => {
    const rank = Number.isFinite(game.bggRank) ? game.bggRank : null;
    if (rank === null) {
      return [];
    }
    return [
      {
        key: `bgg-rank-${getOverrideKey(game)}`,
        label: `Rank #${rank}`,
        field: 'bggRank',
      },
    ];
  },
  minPlayers: (game) => {
    const value = Number.isFinite(game.minPlayers) ? game.minPlayers : null;
    if (value === null) {
      return [];
    }
    return [
      {
        key: `min-players-${getOverrideKey(game)}`,
        label: `Min Players: ${value}`,
        field: 'minPlayers',
      },
    ];
  },
  maxPlayers: (game) => {
    const value = Number.isFinite(game.maxPlayers) ? game.maxPlayers : null;
    if (value === null) {
      return [];
    }
    return [
      {
        key: `max-players-${getOverrideKey(game)}`,
        label: `Max Players: ${value}`,
        field: 'maxPlayers',
      },
    ];
  },
  bestPlayerCount: (game) => {
    const value =
      typeof game.bestPlayerCount === 'string' ? game.bestPlayerCount.trim() : game.bestPlayerCount;
    if (!value && value !== 0) {
      return [];
    }
    return [
      {
        key: `best-player-${getOverrideKey(game)}`,
        label: `Best Player Count: ${value}`,
        field: 'bestPlayerCount',
      },
    ];
  },
  minPlaytime: (game) => {
    const value = Number.isFinite(game.minPlaytime) ? game.minPlaytime : null;
    if (value === null) {
      return [];
    }
    return [
      {
        key: `min-playtime-${getOverrideKey(game)}`,
        label: `Min Playtime: ${value}m`,
        field: 'minPlaytime',
      },
    ];
  },
  maxPlaytime: (game) => {
    const value = Number.isFinite(game.maxPlaytime) ? game.maxPlaytime : null;
    if (value === null) {
      return [];
    }
    return [
      {
        key: `max-playtime-${getOverrideKey(game)}`,
        label: `Max Playtime: ${value}m`,
        field: 'maxPlaytime',
      },
    ];
  },
  age: (game) => {
    // Use minAge from new schema
    const value = Number.isFinite(game.minAge) ? game.minAge : null;
    if (value === null) {
      return [];
    }
    return [
      {
        key: `age-${getOverrideKey(game)}`,
        label: `Age: ${value}+`,
        field: 'age',
      },
    ];
  },
  communityAge: (game) => {
    const value = Number.isFinite(game.communityAge) ? game.communityAge : null;
    if (value === null) {
      return [];
    }
    return [
      {
        key: `community-age-${getOverrideKey(game)}`,
        label: `Community Age: ${value}+`,
        field: 'communityAge',
      },
    ];
  },
  weight: (game, isMetric = false) => {
    // Get weight from dimensions array
    const primaryDim = getPrimaryDimension(game.dimensions);
    const value = primaryDim?.weight != null && Number.isFinite(primaryDim.weight) ? primaryDim.weight : null;
    if (value === null) {
      return [];
    }
    return [
      {
        key: `weight-${getOverrideKey(game)}`,
        label: `Weight: ${formatWeight(value, isMetric)}`,
        field: 'weight',
      },
    ];
  },
  bggRating: (game) => {
    const value =
      Number.isFinite(game.bggRating) && game.bggRating > 0 ? Number(game.bggRating) : null;
    if (value === null) {
      return [];
    }
    return [
      {
        key: `bgg-rating-${getOverrideKey(game)}`,
        label: `BGG Rating: ${value.toFixed(2)}`,
        field: 'bggRating',
      },
    ];
  },
};

/**
 * Builds badge objects for a game based on active sorting fields.
 * @param {Object} game - The game object
 * @param {string[]} activeSortingFields - Array of active sorting field names
 * @param {boolean} isMetric - Whether to display in metric units (default: false)
 * @returns {Array} Array of badge objects with field, label, and key properties
 */
export function buildBadgesForGame(game, activeSortingFields = [], isMetric = false) {
  if (!Array.isArray(activeSortingFields) || activeSortingFields.length === 0) {
    return [];
  }

  const badges = [];
  activeSortingFields.forEach((field) => {
    const builder = SORTING_BADGE_BUILDERS[field];
    if (!builder) {
      return;
    }
    // Pass isMetric to weight builder, others don't need it
    const fieldBadges = field === 'weight' ? builder(game, isMetric) : builder(game);
    if (!Array.isArray(fieldBadges) || fieldBadges.length === 0) {
      return;
    }
    fieldBadges.forEach((badge, index) => {
      const fallbackKey = `${field}-${getOverrideKey(game)}-${index}`;
      badges.push({
        field,
        label: badge.label,
        key: badge.key ?? fallbackKey,
      });
    });
  });

  return badges;
}

