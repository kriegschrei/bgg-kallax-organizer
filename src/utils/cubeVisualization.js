export function getGameColor(index, total) {
  return `hsl(${(index * 360) / total}, 70%, 80%)`;
}

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

export const PRIORITY_BADGE_BUILDERS = {
  categories: (game) =>
    Array.isArray(game.categories)
      ? game.categories
          .filter((category) => typeof category === 'string' && category.trim().length > 0)
          .map((category, index) => ({
            key: `category-${index}-${category}`,
            label: category.trim(),
            field: 'categories',
          }))
      : [],
  families: (game) =>
    Array.isArray(game.families)
      ? game.families
          .filter((family) => typeof family === 'string' && family.trim().length > 0)
          .map((family, index) => ({
            key: `family-${index}-${family}`,
            label: family.trim(),
            field: 'families',
          }))
      : [],
  bggRank: (game) => {
    const rank = Number.isFinite(game.bggRank) ? game.bggRank : null;
    if (rank === null) {
      return [];
    }
    return [
      {
        key: `bgg-rank-${game.id}`,
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
        key: `min-players-${game.id}`,
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
        key: `max-players-${game.id}`,
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
        key: `best-player-${game.id}`,
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
        key: `min-playtime-${game.id}`,
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
        key: `max-playtime-${game.id}`,
        label: `Max Playtime: ${value}m`,
        field: 'maxPlaytime',
      },
    ];
  },
  age: (game) => {
    const value = Number.isFinite(game.age) ? game.age : null;
    if (value === null) {
      return [];
    }
    return [
      {
        key: `age-${game.id}`,
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
        key: `community-age-${game.id}`,
        label: `Community Age: ${value}+`,
        field: 'communityAge',
      },
    ];
  },
  weight: (game) => {
    const value = Number.isFinite(game.weight) ? game.weight : null;
    if (value === null) {
      return [];
    }
    return [
      {
        key: `weight-${game.id}`,
        label: `Weight: ${value.toFixed(2)}`,
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
        key: `bgg-rating-${game.id}`,
        label: `BGG Rating: ${value.toFixed(2)}`,
        field: 'bggRating',
      },
    ];
  },
};

export function buildBadgesForGame(game, activePriorityFields = []) {
  if (!Array.isArray(activePriorityFields) || activePriorityFields.length === 0) {
    return [];
  }

  const badges = [];
  activePriorityFields.forEach((field) => {
    const builder = PRIORITY_BADGE_BUILDERS[field];
    if (!builder) {
      return;
    }
    const fieldBadges = builder(game);
    if (!Array.isArray(fieldBadges) || fieldBadges.length === 0) {
      return;
    }
    fieldBadges.forEach((badge, index) => {
      const fallbackKey = `${field}-${game.id}-${index}`;
      badges.push({
        field,
        label: badge.label,
        key: badge.key ?? fallbackKey,
      });
    });
  });

  return badges;
}

