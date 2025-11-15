import React, { useCallback, useMemo, useState } from 'react';
import {
  FaInfoCircle,
  FaTools,
  FaExclamationTriangle,
  FaBoxOpen,
  FaRulerCombined,
  FaQuestionCircle,
} from 'react-icons/fa';
import WarningCallout from './WarningCallout';
import { buildWarningPanels, createWarningPanelState } from '../utils/resultsWarnings';
import { pickFirstUrl } from '../utils/helpers';

/**
 * Renders a linked game name or plain text if no URL is available.
 */
const renderLinkedName = (game, linkKeys) => {
  const href = pickFirstUrl(game, linkKeys);
  const displayName = game.displayName || game.gameName || 'Unknown Game';
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="callout__link">
        {displayName}
      </a>
    );
  }
  return displayName;
};

/**
 * Gets cube label text for a game.
 */
const getCubeLabel = (game) => (game?.cubeId ? ` (Cube #${game.cubeId})` : null);

/**
 * Renders a link to submit dimensions correction.
 */
const renderSubmitDimensionsLink = (game) =>
  game?.correctionUrl ? (
    <>
      {` — `}
      <a href={game.correctionUrl} target="_blank" rel="noopener noreferrer" className="callout__link">
        Submit dimensions
      </a>
    </>
  ) : null;

/**
 * Creates a game renderer function with configurable options.
 */
const createGameRenderer = ({
  linkKeys = ['versionsUrl'],
  includeCubeId = true,
  cubeIdPredicate = (game) => Boolean(game?.cubeId),
  extraContent,
}) => (game, context = {}) => {
  const nameContent = renderLinkedName(game, linkKeys);
  const cubeLabel = includeCubeId && cubeIdPredicate(game, context) ? getCubeLabel(game) : null;

  return (
    <>
      {nameContent}
      {cubeLabel}
      {extraContent ? extraContent(game, context) : null}
    </>
  );
};

/**
 * Configuration for warning panels.
 */
const WARNING_PANEL_CONFIG = [
  {
    id: 'bggDefaultDimensions',
    dataKey: 'bggDefaultDimensions',
    variant: 'warning',
    Icon: FaQuestionCircle ,
    title: 'BGG Default Dimensions',
    getDescription: ({ count }) => (
      <>
        {count} game{count !== 1 ? 's' : ''}{' '}
        {count !== 1 ? 'have' : 'has'} a selected BoardGameGeek version without dimensions. Default
        dimensions of 11.7&quot; × 11.7&quot; × 2.8&quot; were assumed and marked with the warning icon{' '}
        <FaQuestionCircle className="inline-icon" aria-hidden="true" /> for easy reference.
      </>
    ),
    renderItem: createGameRenderer({
      linkKeys: ['correctionUrl', 'versionsUrl'],
    }),
  },
  {
    id: 'guessedDueToNoVersion',
    dataKey: 'guessedDueToNoVersion',
    variant: 'info',
    Icon: FaInfoCircle,
    title: 'Missing Version',
    getDescription: ({ count }) =>
      `No specific BoardGameGeek version was selected for these game${
        count !== 1 ? 's' : ''
      }. We guessed an alternate version to estimate dimensions. Selecting the right version keeps future calculations accurate and avoids guesswork.`,
    renderItem: createGameRenderer({ linkKeys: ['versionsUrl'] }),
  },
  {
    id: 'selectedVersionMissingDimensions',
    dataKey: 'selectedVersionMissingDimensions',
    variant: 'success',
    Icon: FaTools,
    title: 'Version Missing Size',
    getDescription: () =>
      'The version you selected on BoardGameGeek does not list its measurements. We substituted dimensions from a different version so packing could continue. Updating your chosen version with accurate measurements will make future runs exact.',
    renderItem: createGameRenderer({
      linkKeys: ['correctionUrl', 'versionsUrl'],
      extraContent: renderSubmitDimensionsLink,
    }),
  },
  {
    id: 'allVersionsMissingDimensions',
    dataKey: 'allVersionsMissingDimensions',
    variant: 'error',
    Icon: FaExclamationTriangle,
    title: 'No Sizes Found',
    getDescription: ({ count }) => (
      <>
        {count} game{count !== 1 ? 's' : ''}{' '}
        {count !== 1 ? 'have' : 'has'} a selected BoardGameGeek version without dimensions. Default
        dimensions of 11.7&quot; × 11.7&quot; × 2.8&quot; were assumed and marked with the warning icon{' '}
        <FaExclamationTriangle className="inline-icon" aria-hidden="true" /> for easy reference.
      </>
    ),
    renderItem: createGameRenderer({
      linkKeys: ['correctionUrl', 'versionsUrl'],
    }),
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
          ? 'The following games have dimensions too large to fit in the Kallax. They have been treated as having dimensions of 11.7 x 11.7 x 2.8 to fit, but may not actually fit.'
          : 'The following games have dimensions too large to fit in the Kallax. They have not been included in the list below.'}{' '}
        If you believe the dimensions are incorrect, please click the game name below to submit a
        dimension correction in BoardGameGeek.
      </>
    ),
    renderItem: createGameRenderer({
      linkKeys: ['correctionUrl', 'versionsUrl'],
      cubeIdPredicate: (game, { fitOversized }) => Boolean(fitOversized && game?.cubeId),
    }),
  },
];

const PANEL_IDS = WARNING_PANEL_CONFIG.map((config) => config.id);

export default function ResultsWarningPanels({
  warningGroups,
  fitOversized,
  renderDisclosureIcon,
}) {
  const [panelState, setPanelState] = useState(() => createWarningPanelState(PANEL_IDS));

  const togglePanel = useCallback((panelId) => {
    setPanelState((prev) => ({
      ...prev,
      [panelId]: !prev[panelId],
    }));
  }, []);

  const warningPanels = useMemo(
    () =>
      buildWarningPanels({
        warningGroups,
        fitOversized,
        panelState,
        onTogglePanel: togglePanel,
        panelConfig: WARNING_PANEL_CONFIG,
      }),
    [fitOversized, panelState, togglePanel, warningGroups]
  );

  const totalWarningPanels = warningPanels.length;

  if (totalWarningPanels === 0) {
    return null;
  }

  return (
    <div className={`results-warnings callout-grid callout-count-${totalWarningPanels}`}>
      {warningPanels.map((panel) => {
        const iconElement = <panel.Icon className="inline-icon" aria-hidden="true" />;
        const description = panel.getDescription({
          count: panel.count,
          items: panel.items,
          fitOversized: panel.context.fitOversized,
        });

        return (
          <WarningCallout
            key={panel.id}
            variant={panel.variant}
            expanded={panel.expanded}
            onToggle={panel.onToggle}
            renderToggleIcon={renderDisclosureIcon}
            icon={iconElement}
            title={panel.title}
            count={panel.count}
            description={description}
            items={panel.items}
            renderItem={(game) => panel.renderItem(game, panel.context)}
            className={panel.id === 'oversized' ? 'warning-callout--oversized' : ''}
          />
        );
      })}
    </div>
  );
}
