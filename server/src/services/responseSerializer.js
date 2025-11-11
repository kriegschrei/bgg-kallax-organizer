import { createCleanGameObject } from '../utils/gameProcessingHelpers.js';
import { calculateStatsSummary, getOversizedStuffedGames } from './packingService.js';

export const serializeCubesResponse = (packedCubes, gamesToPack, stacking, oversizedExcludedGames) => {
  console.log('   🔍 Deep circular reference check before serialization...');
  console.log(`   Checking ${packedCubes.length} cubes...`);

  const cleanCubes = [];
  let gameCount = 0;

  for (let cubeIdx = 0; cubeIdx < packedCubes.length; cubeIdx += 1) {
    const cube = packedCubes[cubeIdx];
    const cleanCube = {
      id: cube.id,
      currentHeight: cube.currentHeight,
      currentWidth: cube.currentWidth,
      rows: [],
      games: [],
    };

    for (const row of cube.rows || []) {
      const cleanRow = {
        heightUsed: row.heightUsed,
        widthUsed: row.widthUsed,
        games: [],
      };

      for (const game of row.games || []) {
        gameCount += 1;
        const cleanGame = createCleanGameObject(game);
        cleanRow.games.push(cleanGame);
      }

      cleanCube.rows.push(cleanRow);
    }

    for (const game of cube.games || []) {
      const cleanGame = createCleanGameObject(game);
      cleanCube.games.push(cleanGame);
    }

    cleanCubes.push(cleanCube);
  }

  console.log(`   ✅ Clean copies created for ${gameCount} games in ${cleanCubes.length} cubes`);
  console.log('   📤 Attempting JSON serialization...');

  const stats = calculateStatsSummary(cleanCubes, stacking);

  const dimensionSummary = {
    guessedVersionCount: 0,
    selectedVersionFallbackCount: 0,
    missingDimensionCount: 0,
    exceedingCapacityCount: 0,
  };

  for (const cube of cleanCubes) {
    for (const game of cube.games) {
      if (game.missingVersion) {
        dimensionSummary.guessedVersionCount += 1;
      }
      if (game.usedAlternateVersionDims) {
        dimensionSummary.selectedVersionFallbackCount += 1;
      }
      if (game.dimensions?.missingDimensions) {
        dimensionSummary.missingDimensionCount += 1;
      }
      if (game.oversizedX || game.oversizedY) {
        dimensionSummary.exceedingCapacityCount += 1;
      }
    }
  }

  console.log('   ℹ️ Dimension summary:', dimensionSummary);

  const oversizedStuffedGames = getOversizedStuffedGames(cleanCubes);
  const oversizedGames = [
    ...oversizedStuffedGames,
    ...(Array.isArray(oversizedExcludedGames) ? oversizedExcludedGames : []),
  ];

  return {
    cubes: cleanCubes,
    totalGames: gamesToPack.length,
    stats,
    dimensionSummary,
    oversizedGames,
  };
};

