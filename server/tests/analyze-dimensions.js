import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serverRoot = resolve(__dirname, '..');
const projectRoot = resolve(serverRoot, '..');
const responsePath = resolve(projectRoot, 'output', 'games_response.json');

/**
 * Helper to create dimension key (normalize to handle floating point precision)
 * @param {number|null} length
 * @param {number|null} width
 * @param {number|null} depth
 * @returns {string}
 */
function createDimensionKey(length, width, depth) {
  // Round to 2 decimal places to handle floating point precision issues
  const l = length != null ? Math.round(length * 100) / 100 : null;
  const w = width != null ? Math.round(width * 100) / 100 : null;
  const d = depth != null ? Math.round(depth * 100) / 100 : null;
  return `${l}-${w}-${d}`;
}

/**
 * Analyze dimensions in the games response
 */
async function analyzeDimensions() {
  const contents = await readFile(responsePath, 'utf-8');
  const data = JSON.parse(contents);

  // Track dimension combinations across all games
  const dimensionMap = new Map(); // key: "length-width-depth", value: array of games
  const gamesWithDuplicateDimensions = [];

  // Process all games
  for (const cube of data.cubes || []) {
    for (const game of cube.games || []) {
      const gameInfo = {
        gameId: game.gameId,
        gameName: game.gameName,
        versionName: game.versionName,
        displayName: game.displayName,
        versionKey: game.versionKey,
      };

      // Check for duplicate dimensions within this game's dimensions array
      const seenInGame = new Set();
      const duplicatesInGame = [];

      for (const dim of game.dimensions || []) {
        if (dim.length != null && dim.width != null && dim.depth != null) {
          const key = createDimensionKey(dim.length, dim.width, dim.depth);

          // Track across all games
          if (!dimensionMap.has(key)) {
            dimensionMap.set(key, []);
          }
          dimensionMap.get(key).push({
            ...gameInfo,
            type: dim.type,
            missing: dim.missing,
          });

          // Check for duplicates within this game
          if (seenInGame.has(key)) {
            duplicatesInGame.push({
              type: dim.type,
              length: dim.length,
              width: dim.width,
              depth: dim.depth,
            });
          } else {
            seenInGame.add(key);
          }
        }
      }

      // If this game has duplicate dimensions, record it
      if (duplicatesInGame.length > 0) {
        gamesWithDuplicateDimensions.push({
          ...gameInfo,
          duplicateDimensions: duplicatesInGame,
        });
      }
    }
  }

  // Find dimensions that repeat across multiple games
  const repeatingDimensions = [];
  for (const [key, games] of dimensionMap.entries()) {
    if (games.length > 1) {
      const [length, width, depth] = key.split('-').map(Number);
      repeatingDimensions.push({
        dimensions: { length, width, depth },
        count: games.length,
        games: games.map((g) => ({
          displayName: g.displayName,
          gameId: g.gameId,
          versionKey: g.versionKey,
          type: g.type,
          missing: g.missing,
        })),
      });
    }
  }

  // Sort by count (most repeated first)
  repeatingDimensions.sort((a, b) => b.count - a.count);

  // Output results
  console.log('='.repeat(80));
  console.log('DIMENSIONS THAT REPEAT ACROSS MULTIPLE GAMES');
  console.log('='.repeat(80));
  console.log(
    `\nFound ${repeatingDimensions.length} unique dimension combinations that appear in multiple games:\n`,
  );

  // Show top 20 most repeated dimensions
  const topRepeating = repeatingDimensions.slice(0, 20);
  for (const item of topRepeating) {
    console.log(
      `\nDimensions: ${item.dimensions.length}" × ${item.dimensions.width}" × ${item.dimensions.depth}"`,
    );
    console.log(`  Appears in ${item.count} games:`);

    // Group by type
    const byType = {};
    for (const game of item.games) {
      if (!byType[game.type]) {
        byType[game.type] = [];
      }
      byType[game.type].push(game);
    }

    for (const [type, games] of Object.entries(byType)) {
      console.log(`    ${type}: ${games.length} games`);
      if (games.length <= 5) {
        for (const game of games) {
          console.log(
            `      - ${game.displayName} (missing: ${game.missing})`,
          );
        }
      } else {
        for (const game of games.slice(0, 3)) {
          console.log(
            `      - ${game.displayName} (missing: ${game.missing})`,
          );
        }
        console.log(`      ... and ${games.length - 3} more`);
      }
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('GAMES WITH DUPLICATE DIMENSIONS WITHIN THEIR OWN DIMENSIONS ARRAY');
  console.log('='.repeat(80));
  console.log(
    `\nFound ${gamesWithDuplicateDimensions.length} games with duplicate dimensions:\n`,
  );

  if (gamesWithDuplicateDimensions.length === 0) {
    console.log(
      '  ✓ No games have duplicate dimensions within their own dimensions array.',
    );
  } else {
    for (const game of gamesWithDuplicateDimensions) {
      console.log(`\n${game.displayName} (${game.versionKey})`);
      console.log(`  Game ID: ${game.gameId}`);
      for (const dup of game.duplicateDimensions) {
        console.log(
          `    Duplicate: ${dup.length}" × ${dup.width}" × ${dup.depth}" (type: ${dup.type})`,
        );
      }
    }
  }

  // Summary statistics
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY STATISTICS');
  console.log('='.repeat(80));
  console.log(`\nTotal unique dimension combinations: ${dimensionMap.size}`);
  console.log(
    `Dimension combinations appearing in multiple games: ${repeatingDimensions.length}`,
  );
  console.log(
    `Games with duplicate dimensions within their own array: ${gamesWithDuplicateDimensions.length}`,
  );

  // Most common dimensions
  const mostCommon = repeatingDimensions.slice(0, 5);
  console.log(`\nTop 5 most common dimension combinations:`);
  for (const item of mostCommon) {
    console.log(
      `  ${item.dimensions.length}" × ${item.dimensions.width}" × ${item.dimensions.depth}" - appears in ${item.count} games`,
    );
  }
}

analyzeDimensions().catch((error) => {
  console.error('Unexpected error during analysis:', error);
  process.exitCode = 1;
});

