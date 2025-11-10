const toArray = (value) => (Array.isArray(value) ? value : []);

const sortByName = (a, b) => {
  const nameA = typeof a?.name === 'string' ? a.name : '';
  const nameB = typeof b?.name === 'string' ? b.name : '';
  return nameA.localeCompare(nameB);
};

export const collectWarningGroups = ({
  cubes = [],
  oversizedGames = [],
  includeCubeId = true,
} = {}) => {
  const guessedVersions = [];
  const selectedVersionFallback = [];
  const missingDimensions = [];

  toArray(cubes).forEach((cube) => {
    const cubeId = cube?.id ?? null;
    toArray(cube?.games).forEach((game) => {
      const baseGameData = includeCubeId ? { ...game, cubeId } : { ...game };

      if (game?.dimensions?.missingDimensions && !game?.missingVersion) {
        missingDimensions.push(baseGameData);
      }

      if (game?.missingVersion) {
        guessedVersions.push({
          ...baseGameData,
          versionsUrl: game?.versionsUrl ?? null,
        });
      }

      if (game?.usedAlternateVersionDims) {
        selectedVersionFallback.push({
          ...baseGameData,
          versionsUrl: game?.versionsUrl ?? null,
          correctionUrl: game?.correctionUrl ?? null,
        });
      }
    });
  });

  guessedVersions.sort(sortByName);
  selectedVersionFallback.sort(sortByName);
  missingDimensions.sort(sortByName);

  const oversizedList = toArray(oversizedGames)
    .map((game) => ({
      ...game,
      cubeId: game?.cubeId ?? null,
      correctionUrl: game?.correctionUrl ?? null,
      versionsUrl: game?.versionsUrl ?? null,
    }))
    .sort(sortByName);

  return {
    guessedVersions,
    selectedVersionFallback,
    missingDimensions,
    oversized: oversizedList,
  };
};


