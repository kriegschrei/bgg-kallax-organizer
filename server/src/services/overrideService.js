import { extractDimensions, normalizeDimensions } from '../utils/gameProcessingHelpers.js';
import { normalizePositiveNumber } from '../utils/numberUtils.js';
import { getMaxDepthDimension } from '../utils/packingHelpers.js';

/**
 * Calculates area from dimensions by sorting and multiplying the two smallest dimensions.
 * This matches the logic used in computeDimensionsMeta from thingMapper.js.
 * @param {Object} dimensions - Object with length, width, and depth properties
 * @returns {number} The calculated area, or -1 if dimensions are invalid
 */
const calculateAreaFromDimensions = ({ length, width, depth }) => {
  const dims = [length, width, depth].map((value) => (Number.isFinite(value) ? value : -1));
  const allVersionsMissingDimensions = dims.some((value) => value <= 0);

  if (allVersionsMissingDimensions) {
    return -1;
  }

  const sorted = [...dims].sort((a, b) => a - b);
  return sorted[0] * sorted[1];
};

export const buildOverrideMaps = (overridesPayload) => {
  const excludedIdsSet = new Set(
    Array.isArray(overridesPayload.excludedVersions)
      ? overridesPayload.excludedVersions
          .map((item) => `${item.game}-${item.version}`)
          .filter(Boolean)
      : [],
  );

  const orientationOverrideMap = new Map(
    Array.isArray(overridesPayload.stackingOverrides)
      ? overridesPayload.stackingOverrides
          .filter(
            (item) =>
              Number.isInteger(item?.game) &&
              Number.isInteger(item?.version) &&
              (item.orientation === 'vertical' || item.orientation === 'horizontal'),
          )
          .map((item) => [`${item.game}-${item.version}`, item.orientation])
      : [],
  );

  const dimensionOverrideMap = new Map(
    Array.isArray(overridesPayload.dimensionOverrides)
      ? overridesPayload.dimensionOverrides
          .filter((item) => {
            if (!Number.isInteger(item?.game) || !Number.isInteger(item?.version)) {
              return false;
            }
            const length = Number(item.length);
            const width = Number(item.width);
            const depth = Number(item.depth ?? item.height);
            return (
              Number.isFinite(length) &&
              Number.isFinite(width) &&
              Number.isFinite(depth) &&
              length > 0 &&
              width > 0 &&
              depth > 0
            );
          })
          .map((item) => {
            const rawDims = {
              length: Number(item.length),
              width: Number(item.width),
              depth: Number(item.depth ?? item.height),
            };
            // Normalize dimensions to ensure length >= width >= depth
            const normalized = normalizeDimensions(rawDims);
            return [
              `${item.game}-${item.version}`,
              {
                length: normalized.length,
                width: normalized.width,
                depth: normalized.depth,
              },
            ];
          })
      : [],
  );

  if (excludedIdsSet.size > 0) {
    console.log(
      `   🚫 Excluding ${excludedIdsSet.size} game(s) from packing due to user override`,
    );
  }
  if (orientationOverrideMap.size > 0) {
    console.log(
      `   ↕️  Applying forced orientation to ${orientationOverrideMap.size} game(s)`,
    );
  }
  if (dimensionOverrideMap.size > 0) {
    console.log(
      `   📏 Applying manual dimensions to ${dimensionOverrideMap.size} game(s)`,
    );
  }

  return { excludedIdsSet, orientationOverrideMap, dimensionOverrideMap };
};

export const applyOverridesToGames = (uniqueGames, overrideMaps) => {
  const { excludedIdsSet, orientationOverrideMap, dimensionOverrideMap } = overrideMaps;

  const preparedGames = uniqueGames
    .filter((game) => !excludedIdsSet.has(game.id))
    .map((game) => {
      const originalDimensions = extractDimensions(game);

      const dimensionSources = game.dimensionSources || {
        user: null,
        version: null,
        guessed: null,
        default: null,
      };

      const overrideDims = dimensionOverrideMap.get(game.id);
      if (overrideDims) {
        // Normalize dimensions to ensure length >= width >= depth
        const overrideDimension = normalizeDimensions({
          length: Number(overrideDims.length),
          width: Number(overrideDims.width),
          depth: Number(overrideDims.depth),
          weight: null,
          missing: false,
        });
        game.bggDimensions = { ...originalDimensions };
        game.userDimensions = { ...overrideDimension };
        game.dimensions = {
          length: overrideDimension.length,
          width: overrideDimension.width,
          depth: overrideDimension.depth,
          weight: overrideDimension.weight,
          missing: false,
        };
        // Recalculate area from user-provided dimensions for accurate sorting
        const recalculatedArea = calculateAreaFromDimensions(overrideDimension);
        if (recalculatedArea > 0) {
          game.area = recalculatedArea;
        }
        // Recalculate maxDepth from user-provided dimensions for accurate packing
        game.maxDepth = getMaxDepthDimension(overrideDimension, true);
        dimensionSources.user = { ...overrideDimension };
        game.selectedDimensionSource = 'user';
        game.dimensions.missing = false;
      } else {
        game.bggDimensions = { ...originalDimensions };
        game.userDimensions = null;
        dimensionSources.user = null;
        if (game.selectedDimensionSource === 'user') {
          if (dimensionSources.version && !dimensionSources.version.missing) {
            game.selectedDimensionSource = 'version';
          } else if (dimensionSources.guessed && !dimensionSources.guessed.missing) {
            game.selectedDimensionSource = 'guessed';
          } else if (dimensionSources.default) {
            game.selectedDimensionSource = 'default';
          } else {
            game.selectedDimensionSource = 'version';
          }
        }
        game.dimensions.missing = originalDimensions.missing ?? false;
      }

      game.dimensionSources = dimensionSources;

      const forcedOrientation = orientationOverrideMap.get(game.id);
      if (forcedOrientation) {
        game.forcedOrientation = forcedOrientation;
      } else {
        delete game.forcedOrientation;
      }

      return game;
    });

  if (preparedGames.length < uniqueGames.length) {
    console.log(
      `   → ${uniqueGames.length - preparedGames.length} game(s) removed via manual exclusions`,
    );
  }

  return preparedGames;
};

