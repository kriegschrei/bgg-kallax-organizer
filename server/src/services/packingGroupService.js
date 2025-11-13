import { sortGamesByArea } from './packingSortService.js';
import { getSafeGameArea, MAX_GROUP_AREA as DEFAULT_MAX_GROUP_AREA } from '../utils/packingHelpers.js';

export const splitOversizedGroup = (group, maxArea) => {
  const MAX_GROUP_AREA = maxArea || DEFAULT_MAX_GROUP_AREA;

  // Pre-compute area for all games upfront
  const gamesWithArea = group.map((game) => ({
    game,
    area: getSafeGameArea(game),
  }));

  const currentArea = gamesWithArea.reduce((total, { area }) => total + area, 0);

  if (currentArea <= MAX_GROUP_AREA) {
    return [group];
  }

  const sortedGames = sortGamesByArea(group);

  const baseGameIndex = sortedGames.findIndex((g) => !g.isExpansion);
  const baseGame = baseGameIndex >= 0 ? sortedGames[baseGameIndex] : sortedGames[0];

  const otherGames = sortedGames.filter(
    (g, i) => i !== (baseGameIndex >= 0 ? baseGameIndex : 0),
  );

  const subGroups = [{ games: [baseGame], area: getSafeGameArea(baseGame) }];

  for (const game of otherGames) {
    const gameArea = getSafeGameArea(game);

    let added = false;
    for (let i = 0; i < subGroups.length; i += 1) {
      const groupArea = subGroups[i].area;

      if (groupArea + gameArea <= MAX_GROUP_AREA) {
        subGroups[i].games.push(game);
        subGroups[i].area += gameArea;
        added = true;
        break;
      }
    }

    if (!added) {
      subGroups.push({ games: [game], area: gameArea });
    }
  }

  return subGroups.map(({ games }) => games);
};

export const getGroupRepresentative = (group) => {
  const baseGame = group.find((g) => !g.isExpansion);
  return baseGame || group[0];
};

export const getGroupTotalArea = (group) =>
  group.reduce((total, game) => total + getSafeGameArea(game), 0);

