import React, { useState, useMemo, useCallback } from 'react';
import {
  FaTrashAlt,
  FaArrowsAlt,
  FaArrowsAltH,
  FaArrowsAltV,
  FaRulerCombined,
  FaEdit,
  FaTimes,
  FaInfoCircle,
  FaTools,
  FaExclamationTriangle,
  FaBoxOpen,
  FaChevronRight,
  FaChevronDown,
} from 'react-icons/fa';
import CubeVisualization from './CubeVisualization';
import DimensionForm from './DimensionForm';
import IconButton from './IconButton';
import OverridesSection from './OverridesSection';
import './Results.css';

const getScrollableListClassName = (length) =>
  length > 8 ? 'callout__list scrollable' : 'callout__list';

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
  const [missingDimsExpanded, setMissingDimsExpanded] = useState(false);
  const [exceedingCapacityExpanded, setExceedingCapacityExpanded] = useState(false);
  const [guessedVersionsExpanded, setGuessedVersionsExpanded] = useState(false);
  const [selectedVersionFallbackExpanded, setSelectedVersionFallbackExpanded] = useState(false);
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

  const formatDimensions = (dims) => {
    if (!dims) {
      return '—';
    }
    const normalize = (value) =>
      typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;

    const length = normalize(
      dims.length ?? dims.height ?? dims.x ?? null
    );
    const width = normalize(dims.width ?? dims.y ?? null);
    const depth = normalize(dims.depth ?? dims.z ?? null);

    const segments = [length, width, depth].map((value) =>
      value !== null ? `${value.toFixed(2)}"` : '—'
    );

    return segments.join(' × ');
  };

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

  const hasExcludedGames = sortedExcludedGames.length > 0;
  const hasOrientationOverrides = sortedOrientationOverrides.length > 0;
  const hasDimensionOverrides = sortedDimensionOverrides.length > 0;

  // Collect games with missing dimensions, exceeding cube capacity, and those using alternate versions
  const gamesWithMissingDimensions = [];
  const gamesWithGuessedVersions = [];
  const gamesUsingFallbackForSelectedVersion = [];
  
  cubes.forEach(cube => {
    cube.games.forEach(game => {
      const baseGameData = { ...game, cubeId: cube.id };

      if (game.dimensions?.missingDimensions && !game.missingVersion) {
        gamesWithMissingDimensions.push(baseGameData);
      }
      if (game.missingVersion) {
        gamesWithGuessedVersions.push({ ...baseGameData, versionsUrl: game.versionsUrl });
      }
      if (game.usedAlternateVersionDims) {
        gamesUsingFallbackForSelectedVersion.push({
          ...baseGameData,
          versionsUrl: game.versionsUrl,
          correctionUrl: game.correctionUrl,
        });
      }
    });
  });

  // Sort games alphabetically by name
  const sortByName = (a, b) => a.name.localeCompare(b.name);
  gamesWithMissingDimensions.sort(sortByName);
  gamesWithGuessedVersions.sort(sortByName);
  gamesUsingFallbackForSelectedVersion.sort(sortByName);

  const oversizedWarningGames = oversizedGames
    ? oversizedGames.map((game) => ({
        ...game,
        cubeId: game.cubeId ?? null,
        correctionUrl: game.correctionUrl ?? null,
        versionsUrl: game.versionsUrl ?? null,
      }))
    : [];
  oversizedWarningGames.sort(sortByName);

  const showGuessedVersionInfo = gamesWithGuessedVersions.length > 0;
  const showSelectedVersionFallback = gamesUsingFallbackForSelectedVersion.length > 0;
  const showMissingDimensions = gamesWithMissingDimensions.length > 0;
  const showOversizedWarning = oversizedWarningGames.length > 0;
  const totalWarningPanels = [
    showGuessedVersionInfo,
    showSelectedVersionFallback,
    showMissingDimensions,
    showOversizedWarning
  ].filter(Boolean).length;

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
              {sortedExcludedGames.map((game) => (
                <li key={game.id} className="override-list-item">
                  <div className="override-entry-row">
                    <span className="override-entry-name">{game.name}</span>
                    <div className="override-entry-actions">
                      <IconButton
                        className="override-action-button"
                        onClick={() => onRestoreExcludedGame?.(game.id)}
                        disabled={!overridesReady || isLoading}
                        title="Remove from excluded list"
                        icon={<FaTimes aria-hidden="true" className="button-icon" />}
                        srLabel="Remove from excluded list"
                      />
                    </div>
                  </div>
                </li>
              ))}
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
              {sortedOrientationOverrides.map((game) => {
                const orientationLabel = game.orientation === 'horizontal' ? 'Horizontal' : 'Vertical';
                const nextOrientation = game.orientation === 'vertical' ? 'horizontal' : 'vertical';
                const orientationIcon =
                  game.orientation === 'horizontal' ? (
                    <FaArrowsAltH aria-hidden="true" className="button-icon" />
                  ) : (
                    <FaArrowsAltV aria-hidden="true" className="button-icon" />
                  );

                return (
                  <li key={game.id} className="override-list-item">
                    <div className="override-entry-row">
                      <span className="override-entry-name">{game.name}</span>
                      <div className="override-entry-actions">
                        <span className="override-pill orientation-pill">{orientationLabel}</span>
                        <IconButton
                          className="override-action-button"
                          onClick={() => handleOrientationPanelToggle(game)}
                          disabled={!overridesReady || isLoading}
                          title={`Switch to ${nextOrientation} orientation`}
                          icon={orientationIcon}
                          srLabel={`Switch to ${nextOrientation} orientation`}
                        />
                        <IconButton
                          className="override-action-button"
                          onClick={() => onClearOrientationOverride?.(game.id)}
                          disabled={!overridesReady || isLoading}
                          title="Remove forced orientation"
                          icon={<FaTimes aria-hidden="true" className="button-icon" />}
                          srLabel="Clear orientation override"
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
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
              {sortedDimensionOverrides.map((game) => {
                const isEditing = panelDimensionEditor.gameId === game.id;

                return (
                  <li key={game.id} className="override-list-item">
                    <div className="override-entry-row">
                      <span className="override-entry-name">{game.name}</span>
                      <div className="override-entry-actions">
                        <span className="override-pill">{formatDimensions(game)}</span>
                        <IconButton
                          className="override-action-button"
                          onClick={() =>
                            isEditing ? closePanelDimensionEditor() : openPanelDimensionEditor(game)
                          }
                          disabled={!overridesReady || isLoading}
                          title={isEditing ? 'Close editor' : 'Edit custom dimensions'}
                          icon={<FaEdit aria-hidden="true" className="button-icon" />}
                          srLabel={isEditing ? 'Close editor' : 'Edit custom dimensions'}
                        />
                        <IconButton
                          className="override-action-button"
                          onClick={() => onRemoveDimensionOverride?.(game.id)}
                          disabled={!overridesReady || isLoading}
                          title="Remove custom dimensions"
                          icon={<FaTimes aria-hidden="true" className="button-icon" />}
                          srLabel="Clear custom dimensions"
                        />
                      </div>
                    </div>

                    {isEditing && (
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
                    )}
                  </li>
                );
              })}
            </OverridesSection>
          )}
        </div>
      )}

      {(showGuessedVersionInfo || showSelectedVersionFallback || showMissingDimensions || showOversizedWarning) && (
        <div className={`results-warnings warnings-count-${totalWarningPanels}`}>
          {showGuessedVersionInfo && (
            <div className="callout callout--info">
              <button
                className="callout__header"
                onClick={() => setGuessedVersionsExpanded(!guessedVersionsExpanded)}
                aria-expanded={guessedVersionsExpanded}
              >
                {renderDisclosureIcon(guessedVersionsExpanded)}
                <strong>
                  <FaInfoCircle className="inline-icon" aria-hidden="true" />
                  Missing Version ({gamesWithGuessedVersions.length})
                </strong>
              </button>
              {guessedVersionsExpanded && (
                <div className="callout__content">
                  <div className="callout__description">
                    No specific BoardGameGeek version was selected for these game{gamesWithGuessedVersions.length !== 1 ? 's' : ''}. We guessed an alternate version to estimate dimensions. Selecting the right version keeps future calculations accurate and avoids guesswork.
                  </div>
                  <ul className={getScrollableListClassName(gamesWithGuessedVersions.length)}>
                    {gamesWithGuessedVersions.map((game) => (
                      <li key={game.id}>
                        {game.versionsUrl ? (
                          <a href={game.versionsUrl} target="_blank" rel="noopener noreferrer">
                            {game.name}
                          </a>
                        ) : (
                          game.name
                        )}
                        {` (Cube #${game.cubeId})`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          {showSelectedVersionFallback && (
            <div className="callout callout--success">
              <button
                className="callout__header"
                onClick={() => setSelectedVersionFallbackExpanded(!selectedVersionFallbackExpanded)}
                aria-expanded={selectedVersionFallbackExpanded}
              >
                {renderDisclosureIcon(selectedVersionFallbackExpanded)}
                <strong>
                  <FaTools className="inline-icon" aria-hidden="true" />
                  Version Missing Size ({gamesUsingFallbackForSelectedVersion.length})
                </strong>
              </button>
              {selectedVersionFallbackExpanded && (
                <div className="callout__content">
                  <div className="callout__description">
                    The version you selected on BoardGameGeek does not list its measurements. We substituted dimensions from a different version so packing could continue. Updating your chosen version with accurate measurements will make future runs exact.
                  </div>
                  <ul className={getScrollableListClassName(gamesUsingFallbackForSelectedVersion.length)}>
                    {gamesUsingFallbackForSelectedVersion.map((game) => (
                      <li key={game.id}>
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
                            <a href={game.correctionUrl} target="_blank" rel="noopener noreferrer" className="callout__link">
                              Submit dimensions
                            </a>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          {gamesWithMissingDimensions.length > 0 && (
            <div className="callout">
              <button
                className="callout__header"
                onClick={() => setMissingDimsExpanded(!missingDimsExpanded)}
                aria-expanded={missingDimsExpanded}
              >
                {renderDisclosureIcon(missingDimsExpanded)}
                <strong>
                  <FaExclamationTriangle className="inline-icon" aria-hidden="true" />
                  No Sizes Found ({gamesWithMissingDimensions.length})
                </strong>
              </button>
              {missingDimsExpanded && (
                <div className="callout__content">
                  <div className="callout__description">
                    {gamesWithMissingDimensions.length} game{gamesWithMissingDimensions.length !== 1 ? 's' : ''} {gamesWithMissingDimensions.length !== 1 ? 'have' : 'has'} a selected BoardGameGeek version without dimensions. 
                    Default dimensions of 12.8" × 12.8" × 1.8" were assumed and marked with the warning icon{' '}
                    <FaExclamationTriangle className="inline-icon" aria-hidden="true" /> for easy reference.
                  </div>
                  <ul className={getScrollableListClassName(gamesWithMissingDimensions.length)}>
                    {gamesWithMissingDimensions.map((game) => (
                      <li key={game.id}>
                        {game.correctionUrl ? (
                          <a href={game.correctionUrl} target="_blank" rel="noopener noreferrer" className="callout__link">
                            {game.name}
                          </a>
                        ) : (
                          game.name
                        )}
                        {` (Cube #${game.cubeId})`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          {showOversizedWarning && (
            <div className="callout">
              <button
                className="callout__header"
                onClick={() => setExceedingCapacityExpanded(!exceedingCapacityExpanded)}
                aria-expanded={exceedingCapacityExpanded}
              >
                {renderDisclosureIcon(exceedingCapacityExpanded)}
                <strong>
                  <FaBoxOpen className="inline-icon" aria-hidden="true" />
                  Over Capacity ({oversizedWarningGames.length})
                </strong>
              </button>
              {exceedingCapacityExpanded && (
                <div className="callout__content">
                  <div className="callout__description">
                    {fitOversized
                      ? 'The following games have dimensions too large to fit in the Kallax. They have been treated as having dimensions of 12.8 to fit, but may not actually fit.'
                      : 'The following games have dimensions too large to fit in the Kallax. They have not been included in the list below.'}
                    {' '}
                    If you believe the dimensions are incorrect, please click the game name below to submit a dimension correction in BoardGameGeek.
                  </div>
                  <ul className={getScrollableListClassName(oversizedWarningGames.length)}>
                    {oversizedWarningGames.map((game) => {
                      const link = game.correctionUrl || game.versionsUrl;
                      return (
                        <li key={game.id}>
                          {link ? (
                            <a href={link} target="_blank" rel="noopener noreferrer" className="callout__link">
                              {game.name}
                            </a>
                          ) : (
                            game.name
                          )}
                          {fitOversized && game.cubeId ? ` (Cube #${game.cubeId})` : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}
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

