import React, { useState, useMemo, useCallback } from 'react';
import {
  FaTrashAlt,
  FaArrowsAlt,
  FaArrowsAltH,
  FaArrowsAltV,
  FaRulerCombined,
  FaEdit,
  FaTimes,
  FaChevronRight,
  FaChevronDown,
} from 'react-icons/fa';
import CubeVisualization from './CubeVisualization';
import DimensionForm from './DimensionForm';
import IconButton from './IconButton';
import OverridesSection from './OverridesSection';
import WarningCallout from './WarningCallout';
import OverrideList from './OverrideList';
import { formatGameDimensions, getScrollableListClassName } from '../utils/results';
import { formatEditorDimensions } from '../utils/dimensions';
import {
  buildWarningPanels,
  collectWarningGroups,
  createWarningPanelState,
} from '../utils/resultsWarnings.jsx';
import './Results.css';
import './Results.css';

export default function Results({
  cubes,
  verticalStacking,
  stats,
  oversizedGames = [],
  fitOversized = false,
  excludedGames = [],
  onExcludeGame,
  onRestoreExcludedGame,
  orientationOverrides = [],
  onSetOrientationOverride,
  onClearOrientationOverride,
  dimensionOverrides = [],
  onSaveDimensionOverride,
  onRemoveDimensionOverride,
  overridesReady = true,
  isLoading = false,
  priorities = [],
}) {
  const totalGamesDisplay =
    stats && stats.totalGames !== null && stats.totalGames !== undefined
      ? stats.totalGames
      : 'Unknown';
  const totalCubesDisplay =
    stats && stats.totalCubes !== null && stats.totalCubes !== undefined
      ? stats.totalCubes
      : 'Unknown';
  const avgGamesPerCubeDisplay =
    stats && stats.avgGamesPerCube !== null && stats.avgGamesPerCube !== undefined
      ? stats.avgGamesPerCube
      : 'N/A';
  const avgUtilizationDisplay =
    stats && stats.avgUtilization !== null && stats.avgUtilization !== undefined
      ? `${stats.avgUtilization}%`
      : 'N/A';
  const statsSummaryItems = useMemo(
    () => [
      { label: 'Total Games', value: totalGamesDisplay },
      { label: 'Kallax Cubes Needed', value: totalCubesDisplay },
      { label: 'Avg Games/Cube', value: avgGamesPerCubeDisplay },
      { label: 'Avg Space Utilization', value: avgUtilizationDisplay },
    ],
    [totalGamesDisplay, totalCubesDisplay, avgGamesPerCubeDisplay, avgUtilizationDisplay]
  );
  const [excludedExpanded, setExcludedExpanded] = useState(false);
  const [orientationExpanded, setOrientationExpanded] = useState(false);
  const [dimensionOverridesExpanded, setDimensionOverridesExpanded] = useState(false);
  const [warningPanelExpanded, setWarningPanelExpanded] = useState(createWarningPanelState);
  const toggleWarningPanel = useCallback((panelId) => {
    setWarningPanelExpanded((prev) => ({
      ...prev,
      [panelId]: !prev[panelId],
    }));
  }, []);

  const renderDisclosureIcon = useCallback(
    (expanded) => (
      <span className="disclosure-arrow">
        {expanded ? (
          <FaChevronDown className="disclosure-arrow-icon" aria-hidden="true" />
        ) : (
          <FaChevronRight className="disclosure-arrow-icon" aria-hidden="true" />
        )}
      </span>
    ),
    []
  );

  const excludedLookup = useMemo(
    () =>
      excludedGames.reduce((acc, game) => {
        if (game?.id) {
          acc[game.id] = game;
        }
        return acc;
      }, {}),
    [excludedGames]
  );

  const orientationLookup = useMemo(
    () =>
      orientationOverrides.reduce((acc, item) => {
        if (item?.id) {
          acc[item.id] = item.orientation;
        }
        return acc;
      }, {}),
    [orientationOverrides]
  );

  const dimensionLookup = useMemo(
    () =>
      dimensionOverrides.reduce((acc, item) => {
        if (item?.id) {
          acc[item.id] = item;
        }
        return acc;
      }, {}),
    [dimensionOverrides]
  );

  const sortedExcludedGames = useMemo(
    () =>
      [...excludedGames].sort((a, b) =>
        (a?.name || '').localeCompare(b?.name || '')
      ),
    [excludedGames]
  );

  const sortedOrientationOverrides = useMemo(
    () =>
      [...orientationOverrides].sort((a, b) =>
        (a?.name || '').localeCompare(b?.name || '')
      ),
    [orientationOverrides]
  );

  const sortedDimensionOverrides = useMemo(
    () =>
      [...dimensionOverrides].sort((a, b) =>
        (a?.name || '').localeCompare(b?.name || '')
      ),
    [dimensionOverrides]
  );
  const warningGroups = useMemo(
    () => collectWarningGroups({ cubes, oversizedGames }),
    [cubes, oversizedGames]
  );
  const warningPanels = useMemo(
    () =>
      buildWarningPanels({
        warningGroups,
        fitOversized,
        panelState: warningPanelExpanded,
        onTogglePanel: toggleWarningPanel,
      }),
    [fitOversized, toggleWarningPanel, warningGroups, warningPanelExpanded]
  );
  const totalWarningPanels = warningPanels.length;

  const [panelDimensionEditor, setPanelDimensionEditor] = useState({
    gameId: null,
    length: '',
    width: '',
    depth: '',
    error: '',
  });

  const handleOrientationPanelToggle = useCallback(
    (game) => {
      if (!onSetOrientationOverride || !overridesReady || isLoading) {
        return;
      }
      const nextOrientation = game.orientation === 'vertical' ? 'horizontal' : 'vertical';
      onSetOrientationOverride(game, nextOrientation);
    },
    [onSetOrientationOverride, overridesReady, isLoading]
  );

  const openPanelDimensionEditor = useCallback((game) => {
    setPanelDimensionEditor({
      gameId: game.id,
      length:
        typeof game.length === 'number' && Number.isFinite(game.length)
          ? String(game.length)
          : '',
      width:
        typeof game.width === 'number' && Number.isFinite(game.width)
          ? String(game.width)
          : '',
      depth:
        typeof game.depth === 'number' && Number.isFinite(game.depth)
          ? String(game.depth)
          : '',
      error: '',
    });
  }, []);

  const closePanelDimensionEditor = useCallback(() => {
    setPanelDimensionEditor({
      gameId: null,
      length: '',
      width: '',
      depth: '',
      error: '',
    });
  }, []);

  const handlePanelDimensionFieldChange = useCallback((field, value) => {
    setPanelDimensionEditor((prev) => ({
      ...prev,
      [field]: value,
      error: '',
    }));
  }, []);

  const handlePanelDimensionSave = useCallback(
    async (game) => {
      if (!onSaveDimensionOverride || !overridesReady || isLoading) {
        return;
      }

      if (panelDimensionEditor.gameId !== game.id) {
        openPanelDimensionEditor(game);
        return;
      }

      const success = await onSaveDimensionOverride(game, {
        length: panelDimensionEditor.length,
        width: panelDimensionEditor.width,
        depth: panelDimensionEditor.depth,
      });

      if (success) {
        closePanelDimensionEditor();
      } else {
        setPanelDimensionEditor((prev) => ({
          ...prev,
          error: 'Please enter positive decimal inches for all fields.',
        }));
      }
    },
    [
      onSaveDimensionOverride,
      overridesReady,
      isLoading,
      panelDimensionEditor,
      openPanelDimensionEditor,
      closePanelDimensionEditor,
    ]
  );

  const renderExcludedActions = useCallback(
    (game) => (
      <IconButton
        className="override-action-button"
        onClick={() => onRestoreExcludedGame?.(game.id)}
        disabled={!overridesReady || isLoading}
        title="Remove from excluded list"
        icon={<FaTimes aria-hidden="true" className="button-icon" />}
        srLabel="Remove from excluded list"
      />
    ),
    [isLoading, onRestoreExcludedGame, overridesReady]
  );

  const renderOrientationActions = useCallback(
    (game) => {
      const orientationIcon =
        game.orientation === 'horizontal' ? (
          <FaArrowsAltH aria-hidden="true" className="button-icon" />
        ) : (
          <FaArrowsAltV aria-hidden="true" className="button-icon" />
        );

      return (
        <>
          <span className="override-pill orientation-pill">{game.orientationLabel}</span>
          <IconButton
            className="override-action-button"
            onClick={() => handleOrientationPanelToggle(game)}
            disabled={!overridesReady || isLoading}
            title={`Switch to ${game.nextOrientation} orientation`}
            icon={orientationIcon}
            srLabel={`Switch to ${game.nextOrientation} orientation`}
          />
          <IconButton
            className="override-action-button"
            onClick={() => onClearOrientationOverride?.(game.id)}
            disabled={!overridesReady || isLoading}
            title="Remove forced orientation"
            icon={<FaTimes aria-hidden="true" className="button-icon" />}
            srLabel="Clear orientation override"
          />
        </>
      );
    },
    [handleOrientationPanelToggle, isLoading, onClearOrientationOverride, overridesReady]
  );

  const renderDimensionActions = useCallback(
    (game) => (
      <>
        <IconButton
          className="override-action-button"
          onClick={() =>
            game.isEditing ? closePanelDimensionEditor() : openPanelDimensionEditor(game)
          }
          disabled={!overridesReady || isLoading}
          title={game.isEditing ? 'Close editor' : 'Edit custom dimensions'}
          icon={<FaEdit aria-hidden="true" className="button-icon" />}
          srLabel={game.isEditing ? 'Close editor' : 'Edit custom dimensions'}
        />
        <IconButton
          className="override-action-button"
          onClick={() => onRemoveDimensionOverride?.(game.id)}
          disabled={!overridesReady || isLoading}
          title="Remove custom dimensions"
          icon={<FaTimes aria-hidden="true" className="button-icon" />}
          srLabel="Clear custom dimensions"
        />
      </>
    ),
    [
      closePanelDimensionEditor,
      isLoading,
      onRemoveDimensionOverride,
      openPanelDimensionEditor,
      overridesReady,
    ]
  );

  const hasExcludedGames = sortedExcludedGames.length > 0;
  const hasOrientationOverrides = sortedOrientationOverrides.length > 0;
  const hasDimensionOverrides = sortedDimensionOverrides.length > 0;

  return (
    <div className="results">
 
      <div className="stats-summary card">
        {statsSummaryItems.map(({ label, value }) => (
          <div key={label} className="stat">
            <span className="stat-value">{value}</span>
            <span className="stat-label">{label}</span>
        </div>
        ))}
      </div>

      {(hasExcludedGames || hasOrientationOverrides || hasDimensionOverrides) && (
        <div className="results-overrides">
          {hasExcludedGames && (
            <OverridesSection
              expanded={excludedExpanded}
              onToggle={() => setExcludedExpanded(!excludedExpanded)}
              renderToggleIcon={renderDisclosureIcon}
              icon={<FaTrashAlt className="inline-icon" aria-hidden="true" />}
              title="Manual exclusions"
              count={sortedExcludedGames.length}
              description="Excluded games will not be included the next time you organize your collection."
              listClassName={getScrollableListClassName(sortedExcludedGames.length)}
            >
              <OverrideList items={sortedExcludedGames} renderActions={renderExcludedActions} />
            </OverridesSection>
          )}
          {hasOrientationOverrides && (
            <OverridesSection
              expanded={orientationExpanded}
              onToggle={() => setOrientationExpanded(!orientationExpanded)}
              renderToggleIcon={renderDisclosureIcon}
              icon={<FaArrowsAlt className="inline-icon" aria-hidden="true" />}
              title="Orientation overrides"
              count={sortedOrientationOverrides.length}
              description="These games will ignore rotation settings and be placed exactly as chosen."
              listClassName={getScrollableListClassName(sortedOrientationOverrides.length)}
            >
              <OverrideList
                items={sortedOrientationOverrides.map((game) => ({
                  ...game,
                  orientationLabel: game.orientation === 'horizontal' ? 'Horizontal' : 'Vertical',
                  nextOrientation: game.orientation === 'vertical' ? 'horizontal' : 'vertical',
                }))}
                renderActions={renderOrientationActions}
                        />
            </OverridesSection>
          )}
          {hasDimensionOverrides && (
            <OverridesSection
              expanded={dimensionOverridesExpanded}
              onToggle={() => setDimensionOverridesExpanded(!dimensionOverridesExpanded)}
              renderToggleIcon={renderDisclosureIcon}
              icon={<FaRulerCombined className="inline-icon" aria-hidden="true" />}
              title="Custom dimensions"
              count={sortedDimensionOverrides.length}
              description="Your overrides will be used instead of the dimensions supplied by BoardGameGeek."
              listClassName={getScrollableListClassName(sortedDimensionOverrides.length)}
            >
              <OverrideList
                items={sortedDimensionOverrides.map((game) => ({
                  ...game,
                  isEditing: panelDimensionEditor.gameId === game.id,
                  dimensions:
                    panelDimensionEditor.gameId === game.id
                      ? formatEditorDimensions(panelDimensionEditor)
                      : formatGameDimensions(game),
                  extraContent:
                    panelDimensionEditor.gameId === game.id ? (
                      <DimensionForm
                        className="override-dimension-form"
                        gridClassName="override-dimension-grid"
                        errorClassName="override-dimension-error"
                        actionsClassName="override-dimension-actions"
                        primaryButtonClassName="override-dimension-primary"
                        secondaryButtonClassName="override-dimension-secondary"
                        values={panelDimensionEditor}
                        error={panelDimensionEditor.error}
                        disabled={!overridesReady || isLoading}
                        onChange={handlePanelDimensionFieldChange}
                        onSubmit={() => handlePanelDimensionSave(game)}
                        onCancel={closePanelDimensionEditor}
                      />
                    ) : null,
                }))}
                showDimensions
                renderActions={renderDimensionActions}
              />
            </OverridesSection>
          )}
        </div>
      )}

      {totalWarningPanels > 0 && (
        <div className={`results-warnings warnings-count-${totalWarningPanels}`}>
          {warningPanels.map((panel) => (
            <WarningCallout
              key={panel.id}
              variant={panel.variant}
              expanded={panel.expanded}
              onToggle={panel.onToggle}
              renderToggleIcon={renderDisclosureIcon}
              icon={panel.icon}
              title={panel.title}
              count={panel.count}
              description={panel.description}
              items={panel.items}
              renderItem={panel.renderItem}
            />
          ))}
        </div>
      )}

      <div className="cubes-container">
        {cubes.map((cube) => (
          <CubeVisualization
            key={cube.id}
            cube={cube}
            verticalStacking={verticalStacking}
            priorities={priorities}
            excludedLookup={excludedLookup}
            orientationLookup={orientationLookup}
            dimensionLookup={dimensionLookup}
            onExcludeGame={onExcludeGame}
            onSetOrientationOverride={onSetOrientationOverride}
            onClearOrientationOverride={onClearOrientationOverride}
            onSaveDimensionOverride={onSaveDimensionOverride}
            onRemoveDimensionOverride={onRemoveDimensionOverride}
            overridesReady={overridesReady}
            isLoading={isLoading}
          />
        ))}
      </div>
    </div>
  );
}

