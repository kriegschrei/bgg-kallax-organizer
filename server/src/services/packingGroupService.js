import { PACKING_CONSTANTS } from './packingPositionService.js';
import { sortGamesByArea } from './packingSortService.js';

const { CUBE_SIZE } = PACKING_CONSTANTS;

export const splitOversizedGroup = (group, maxArea) => {
  const MAX_GROUP_AREA = maxArea || CUBE_SIZE * CUBE_SIZE * 0.95;

  const currentArea = group.reduce((total, game) => {
    if (game.dims2D) {
      return total + game.dims2D.x * game.dims2D.y;
    }
    return total;
  }, 0);

  if (currentArea <= MAX_GROUP_AREA) {
    return [group];
  }

  const sortedGames = sortGamesByArea(group);

  const baseGameIndex = sortedGames.findIndex((g) => !g.isExpansion);
  const baseGame = baseGameIndex >= 0 ? sortedGames[baseGameIndex] : sortedGames[0];

  const otherGames = sortedGames.filter(
    (g, i) => i !== (baseGameIndex >= 0 ? baseGameIndex : 0),
  );

  const subGroups = [[baseGame]];

  for (const game of otherGames) {
    const gameArea = (game.dims2D?.x || 0) * (game.dims2D?.y || 0);

    let added = false;
    for (let i = 0; i < subGroups.length; i += 1) {
      const groupArea = subGroups[i].reduce((total, g) => {
        if (g.dims2D) {
          return total + g.dims2D.x * g.dims2D.y;
        }
        return total;
      }, 0);

      if (groupArea + gameArea <= MAX_GROUP_AREA) {
        subGroups[i].push(game);
        added = true;
        break;
      }
    }

    if (!added) {
      subGroups.push([game]);
    }
  }

  return subGroups;
};

export const getGroupRepresentative = (group) => {
  const baseGame = group.find((g) => !g.isExpansion);
  return baseGame || group[0];
};

export const getGroupTotalArea = (group) =>
  group.reduce((total, game) => {
    if (game.dims2D) {
      return total + game.dims2D.x * game.dims2D.y;
    }
    return total;
  }, 0);

