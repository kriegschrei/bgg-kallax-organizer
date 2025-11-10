import React from 'react';
import {
  FaInfoCircle,
  FaTools,
  FaExclamationTriangle,
  FaBoxOpen,
} from 'react-icons/fa';

const toArray = (value) => (Array.isArray(value) ? value : []);

const sortByName = (a, b) => {
  const nameA = typeof a?.name === 'string' ? a.name : '';
  const nameB = typeof b?.name === 'string' ? b.name : '';
  return nameA.localeCompare(nameB);
};

const WARNING_PANEL_CONFIG = [
  {
    id: 'guessedVersions',
    dataKey: 'guessedVersions',
    variant: 'info',
    Icon: FaInfoCircle,
    title: 'Missing Version',
    getDescription: ({ count }) =>
      `No specific BoardGameGeek version was selected for these game${
        count !== 1 ? 's' : ''
      }. We guessed an alternate version to estimate dimensions. Selecting the right version keeps future calculations accurate and avoids guesswork.`,
    renderItem: (game) => (
      <>
        {game.versionsUrl ? (
          <a href={game.versionsUrl} target="_blank" rel="noopener noreferrer">
            {game.name}
          </a>
        ) : (
          game.name
        )}
        {` (Cube #${game.cubeId})`}
      </>
    ),
  },
  {
    id: 'selectedVersionFallback',
    dataKey: 'selectedVersionFallback',
    variant: 'success',
    Icon: FaTools,
    title: 'Version Missing Size',
    getDescription: () =>
      'The version you selected on BoardGameGeek does not list its measurements. We substituted dimensions from a different version so packing could continue. Updating your chosen version with accurate measurements will make future runs exact.',
    renderItem: (game) => (
      <>
        {game.versionsUrl ? (
          <a href={game.versionsUrl} target="_blank" rel="noopener noreferrer">
            {game.name}
          </a>
        ) : (
          game.name
        )}
        {` (Cube #${game.cubeId})`}
        {game.correctionUrl && (
          <>
            {` — `}
            <a
              href={game.correctionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="callout__link"
            >
              Submit dimensions
            </a>
          </>
        )}
      </>
    ),
  },
  {
    id: 'missingDimensions',
    dataKey: 'missingDimensions',
    variant: 'warning',
    Icon: FaExclamationTriangle,
    title: 'No Sizes Found',
    getDescription: ({ count }) => (
      <>
        {count} game{count !== 1 ? 's' : ''}{' '}
        {count !== 1 ? 'have' : 'has'} a selected BoardGameGeek version without dimensions. Default
        dimensions of 12.8&quot; × 12.8&quot; × 1.8&quot; were assumed and marked with the warning icon{' '}
        <FaExclamationTriangle className="inline-icon" aria-hidden="true" /> for easy reference.
      </>
    ),
    renderItem: (game) => (
      <>
        {game.correctionUrl ? (
          <a
            href={game.correctionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="callout__link"
          >
            {game.name}
          </a>
        ) : (
          game.name
        )}
        {` (Cube #${game.cubeId})`}
      </>
    ),
  },
  {
    id: 'oversized',
    dataKey: 'oversized',
    variant: 'warning',
    Icon: FaBoxOpen,
    title: 'Over Capacity',
    getDescription: ({ fitOversized }) => (
      <>
        {fitOversized
          ? 'The following games have dimensions too large to fit in the Kallax. They have been treated as having dimensions of 12.8 to fit, but may not actually fit.'
          : 'The following games have dimensions too large to fit in the Kallax. They have not been included in the list below.'}{' '}
        If you believe the dimensions are incorrect, please click the game name below to submit a
        dimension correction in BoardGameGeek.
      </>
    ),
    renderItem: (game, { fitOversized }) => {
      const link = game.correctionUrl || game.versionsUrl;
      return (
        <>
          {link ? (
            <a href={link} target="_blank" rel="noopener noreferrer" className="callout__link">
              {game.name}
            </a>
          ) : (
            game.name
          )}
          {fitOversized && game.cubeId ? ` (Cube #${game.cubeId})` : null}
        </>
      );
    },
  },
];

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

export const createWarningPanelState = () =>
  WARNING_PANEL_CONFIG.reduce((acc, definition) => {
    acc[definition.id] = false;
    return acc;
  }, {});

export const buildWarningPanels = ({
  warningGroups,
  fitOversized,
  panelState,
  onTogglePanel,
}) =>
  WARNING_PANEL_CONFIG.map((definition) => {
    const items = warningGroups[definition.dataKey] || [];
    const count = items.length;

    if (count === 0) {
      return null;
    }

    const isExpanded = panelState?.[definition.id] ?? false;
    const iconElement = <definition.Icon className="inline-icon" aria-hidden="true" />;

    return {
      id: definition.id,
      variant: definition.variant,
      icon: iconElement,
      title: definition.title,
      count,
      description: definition.getDescription({
        count,
        items,
        fitOversized,
      }),
      items,
      renderItem: (game) =>
        definition.renderItem(game, {
          fitOversized,
        }),
      expanded: isExpanded,
      onToggle: () => onTogglePanel(definition.id),
    };
  }).filter(Boolean);


