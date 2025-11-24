const detectCircularRefs = (obj, path = 'root', visited = new WeakSet(), maxDepth = 10) => {
  if (maxDepth <= 0) return false;

  if (obj === null || typeof obj !== 'object') {
    return false;
  }

  if (visited.has(obj)) {
    console.error(`   🔄 CIRCULAR REFERENCE DETECTED at path: ${path}`);
    return true;
  }

  visited.add(obj);

  if (Array.isArray(obj)) {
    for (let i = 0; i < Math.min(obj.length, 5); i += 1) {
      if (detectCircularRefs(obj[i], `${path}[${i}]`, visited, maxDepth - 1)) {
        return true;
      }
    }
  } else {
    const keys = Object.keys(obj).slice(0, 10);
    for (const key of keys) {
      if (key === '_group') {
        console.error(`   ⚠️  Found _group property at ${path}.${key}`);
      }
      if (detectCircularRefs(obj[key], `${path}.${key}`, visited, maxDepth - 1)) {
        return true;
      }
    }
  }

  visited.delete(obj);
  return false;
};

const groupExpansionsWithBaseGames = (games, allGameIds) => {
  console.log(`   🔍 Grouping expansions: checking ${games.length} games for circular refs...`);

  let circularRefCount = 0;
  for (let i = 0; i < Math.min(games.length, 10); i += 1) {
    if (detectCircularRefs(games[i], `games[${i}]`)) {
      circularRefCount += 1;
      if (circularRefCount <= 3) {
        console.error(
          `   ❌ Found circular ref in game "${games[i].gameName || games[i].name || 'unknown'}" (id: ${games[i].id})`,
        );
      }
    }
  }
  if (circularRefCount > 0) {
    console.error(
      `   ⚠️  WARNING: Found ${circularRefCount} games with circular references before grouping!`,
    );
  }

  const groups = new Map();
  const expansionGameIds = new Set();

  const getBaseId = (game) => {
    if (game.id && game.id.includes('-')) {
      const parts = game.id.split('-');
      if (/^\d+$/.test(parts[0])) {
        return parts[0];
      }
    }
    return game.id;
  };

  for (const game of games) {
    if (game.isExpansion && game.baseGameId) {
      const baseId = game.baseGameId;

      let baseGameInCollection = allGameIds.has(baseId);
      if (!baseGameInCollection) {
        for (const id of allGameIds) {
          const gameBaseId = getBaseId({ id });
          if (gameBaseId === baseId) {
            baseGameInCollection = true;
            break;
          }
        }
      }

      if (baseGameInCollection) {
        if (!groups.has(baseId)) {
          groups.set(baseId, []);
        }
        groups.get(baseId).push(game);
        expansionGameIds.add(game.id);
      }
    }
  }

  for (const game of games) {
    if (game.isExpansion) continue;

    const gameBaseId = getBaseId(game);

    if (groups.has(gameBaseId)) {
      const group = groups.get(gameBaseId);
      const baseGameInGroup = group.some((g) => {
        if (g.isExpansion) return false;
        const gBaseId = getBaseId(g);
        return gBaseId === gameBaseId;
      });

      if (!baseGameInGroup) {
        group.unshift(game);
      }
    }
  }

  const validGroups = new Map();
  for (const [groupId, groupGames] of groups.entries()) {
    const hasBaseGame = groupGames.some((g) => {
      if (g.isExpansion) return false;
      const gBaseId = getBaseId(g);
      return gBaseId === groupId;
    });

    if (hasBaseGame && groupGames.length > 1) {
      validGroups.set(groupId, groupGames);
    }
  }

  return { groups: validGroups, expansionGameIds };
};

const groupGamesBySeries = (games, excludeExpansionGroups = new Set()) => {
  const familyGroups = new Map();
  const gameToFamilies = new Map();

  for (const game of games) {
    if (excludeExpansionGroups.has(game.id)) {
      continue;
    }

    if (game.familyIds && game.familyIds.length > 0) {
      const families = new Set();
      for (const familyId of game.familyIds) {
        if (!familyGroups.has(familyId)) {
          familyGroups.set(familyId, []);
        }
        families.add(familyId);
      }
      gameToFamilies.set(game.id, families);
    }
  }

  for (const game of games) {
    if (excludeExpansionGroups.has(game.id)) {
      continue;
    }

    const families = gameToFamilies.get(game.id);
    if (families && families.size > 0) {
      let chosenFamily = null;
      let minSize = Infinity;

      for (const familyId of families) {
        const currentSize = familyGroups.get(familyId)?.length || 0;
        if (currentSize < minSize) {
          minSize = currentSize;
          chosenFamily = familyId;
        }
      }

      if (chosenFamily) {
        familyGroups.get(chosenFamily).push(game);
      }
    }
  }

  const validGroups = new Map();
  for (const [familyId, groupGames] of familyGroups.entries()) {
    if (groupGames.length > 1) {
      validGroups.set(familyId, groupGames);
    }
  }

  return validGroups;
};

export const createGameGroups = (games, groupExpansions) => {
  const allGameIds = new Set(games.map((g) => g.id));

  let expansionGroups = new Map();
  let expansionGameIds = new Set();

  if (groupExpansions) {
    const expansionResult = groupExpansionsWithBaseGames(games, allGameIds);
    expansionGroups = expansionResult.groups;
    expansionGameIds = expansionResult.expansionGameIds;
    console.log(`   📦 Created ${expansionGroups.size} expansion groups`);
  }

  const finalGroups = new Map();
  const groupedGameIds = new Set();

  for (const [groupId, groupGames] of expansionGroups.entries()) {
    finalGroups.set(`expansion:${groupId}`, groupGames);
    for (const game of groupGames) {
      groupedGameIds.add(game.id);
    }
  }

  const standaloneGames = games.filter((g) => !groupedGameIds.has(g.id));

  return {
    groups: finalGroups,
    standaloneGames,
    groupedGameIds,
  };
};

