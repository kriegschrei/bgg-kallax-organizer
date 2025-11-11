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
          .map((item) => [
            `${item.game}-${item.version}`,
            {
              length: Number(item.length),
              width: Number(item.width),
              depth: Number(item.depth ?? item.height),
            },
          ])
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
      const originalDimensions = {
        length: game.dimensions?.length ?? 0,
        width: game.dimensions?.width ?? 0,
        depth: game.dimensions?.depth ?? 0,
        missingDimensions: game.dimensions?.missingDimensions ?? false,
      };

      const overrideDims = dimensionOverrideMap.get(game.id);
      if (overrideDims) {
        game.bggDimensions = { ...originalDimensions };
        game.userDimensions = { ...overrideDims };
        game.dimensions = {
          length: overrideDims.length,
          width: overrideDims.width,
          depth: overrideDims.depth,
          missingDimensions: originalDimensions.missingDimensions,
        };
      } else {
        game.bggDimensions = { ...originalDimensions };
        game.userDimensions = null;
      }

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

