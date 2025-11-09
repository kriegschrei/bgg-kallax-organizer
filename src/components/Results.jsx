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
import { calculateStats } from '../services/packing';
import './Results.css';

export default function Results({
  cubes,
  verticalStacking,
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
}) {
  const stats = calculateStats(cubes, verticalStacking);
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
        <div className="stat">
          <span className="stat-value">{stats.totalGames}</span>
          <span className="stat-label">Total Games</span>
        </div>
        <div className="stat">
          <span className="stat-value">{stats.totalCubes}</span>
          <span className="stat-label">Kallax Cubes Needed</span>
        </div>
        <div className="stat">
          <span className="stat-value">{stats.avgGamesPerCube}</span>
          <span className="stat-label">Avg Games/Cube</span>
        </div>
        <div className="stat">
          <span className="stat-value">{stats.avgUtilization}%</span>
          <span className="stat-label">Avg Space Utilization</span>
        </div>
      </div>

      {(hasExcludedGames || hasOrientationOverrides || hasDimensionOverrides) && (
        <div className="results-overrides">
          {hasExcludedGames && (
            <div className="warning-box manual-box">
              <button
                className="warning-header"
                onClick={() => setExcludedExpanded(!excludedExpanded)}
                aria-expanded={excludedExpanded}
              >
                {renderDisclosureIcon(excludedExpanded)}
                <strong>
                  <FaTrashAlt className="inline-icon" aria-hidden="true" />
                  Manual exclusions ({sortedExcludedGames.length})
                </strong>
              </button>
              {excludedExpanded && (
                <div className="warning-content">
                  <p className="warning-description">
                    Excluded games will not be included the next time you organize your collection.
                  </p>
                  <ul className={`warning-game-list ${sortedExcludedGames.length > 8 ? 'scrollable' : ''}`}>
                    {sortedExcludedGames.map((game) => (
                      <li key={game.id} className="override-list-item">
                        <div className="override-entry-row">
                          <span className="override-entry-name">{game.name}</span>
                          <div className="override-entry-actions">
                            <button
                              type="button"
                              className="override-action-button"
                              onClick={() => onRestoreExcludedGame?.(game.id)}
                              disabled={!overridesReady || isLoading}
                              title="Remove from excluded list"
                            >
                              <FaTimes aria-hidden="true" className="button-icon" />
                              <span className="sr-only">Remove from excluded list</span>
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          {hasOrientationOverrides && (
            <div className="warning-box manual-box">
              <button
                className="warning-header"
                onClick={() => setOrientationExpanded(!orientationExpanded)}
                aria-expanded={orientationExpanded}
              >
                {renderDisclosureIcon(orientationExpanded)}
                <strong>
                  <FaArrowsAlt className="inline-icon" aria-hidden="true" />
                  Orientation overrides ({sortedOrientationOverrides.length})
                </strong>
              </button>
              {orientationExpanded && (
                <div className="warning-content">
                  <p className="warning-description">
                    These games will ignore rotation settings and be placed exactly as chosen.
                  </p>
                  <ul className={`warning-game-list ${sortedOrientationOverrides.length > 8 ? 'scrollable' : ''}`}>
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
                              <button
                                type="button"
                                className="override-action-button"
                                onClick={() => handleOrientationPanelToggle(game)}
                                disabled={!overridesReady || isLoading}
                                title={`Switch to ${nextOrientation} orientation`}
                              >
                                {orientationIcon}
                                <span className="sr-only">{`Switch to ${nextOrientation} orientation`}</span>
                              </button>
                              <button
                                type="button"
                                className="override-action-button"
                                onClick={() => onClearOrientationOverride?.(game.id)}
                                disabled={!overridesReady || isLoading}
                                title="Remove forced orientation"
                              >
                                <FaTimes aria-hidden="true" className="button-icon" />
                                <span className="sr-only">Clear orientation override</span>
                              </button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}
          {hasDimensionOverrides && (
            <div className="warning-box manual-box">
              <button
                className="warning-header"
                onClick={() => setDimensionOverridesExpanded(!dimensionOverridesExpanded)}
                aria-expanded={dimensionOverridesExpanded}
              >
                {renderDisclosureIcon(dimensionOverridesExpanded)}
                <strong>
                  <FaRulerCombined className="inline-icon" aria-hidden="true" />
                  Custom dimensions ({sortedDimensionOverrides.length})
                </strong>
              </button>
              {dimensionOverridesExpanded && (
                <div className="warning-content">
                  <p className="warning-description">
                    Your overrides will be used instead of the dimensions supplied by BoardGameGeek.
                  </p>
                  <ul className={`warning-game-list ${sortedDimensionOverrides.length > 8 ? 'scrollable' : ''}`}>
                    {sortedDimensionOverrides.map((game) => {
                      const isEditing = panelDimensionEditor.gameId === game.id;

                      return (
                        <li key={game.id} className="override-list-item">
                          <div className="override-entry-row">
                            <span className="override-entry-name">{game.name}</span>
                            <div className="override-entry-actions">
                              <span className="override-pill">{formatDimensions(game)}</span>
                              <button
                                type="button"
                                className="override-action-button"
                                onClick={() =>
                                  isEditing ? closePanelDimensionEditor() : openPanelDimensionEditor(game)
                                }
                                disabled={!overridesReady || isLoading}
                                title={isEditing ? 'Close editor' : 'Edit custom dimensions'}
                              >
                                <FaEdit aria-hidden="true" className="button-icon" />
                                <span className="sr-only">
                                  {isEditing ? 'Close editor' : 'Edit custom dimensions'}
                                </span>
                              </button>
                              <button
                                type="button"
                                className="override-action-button"
                                onClick={() => onRemoveDimensionOverride?.(game.id)}
                                disabled={!overridesReady || isLoading}
                                title="Remove custom dimensions"
                              >
                                <FaTimes aria-hidden="true" className="button-icon" />
                                <span className="sr-only">Clear custom dimensions</span>
                              </button>
                            </div>
                          </div>

                          {isEditing && (
                            <form
                              className="override-dimension-form"
                              onSubmit={(event) => {
                                event.preventDefault();
                                handlePanelDimensionSave(game);
                              }}
                            >
                              <div className="override-dimension-grid">
                                <label>
                                  Length (in)
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    value={panelDimensionEditor.length}
                                    onChange={(event) =>
                                      handlePanelDimensionFieldChange('length', event.target.value)
                                    }
                                    required
                                  />
                                </label>
                                <label>
                                  Width (in)
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    value={panelDimensionEditor.width}
                                    onChange={(event) =>
                                      handlePanelDimensionFieldChange('width', event.target.value)
                                    }
                                    required
                                  />
                                </label>
                                <label>
                                  Depth (in)
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    value={panelDimensionEditor.depth}
                                    onChange={(event) =>
                                      handlePanelDimensionFieldChange('depth', event.target.value)
                                    }
                                    required
                                  />
                                </label>
                              </div>
                              {panelDimensionEditor.error && (
                                <p className="override-dimension-error">{panelDimensionEditor.error}</p>
                              )}
                              <div className="override-dimension-actions">
                                <button
                                  type="submit"
                                  className="override-dimension-primary"
                                  disabled={!overridesReady || isLoading}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  className="override-dimension-secondary"
                                  onClick={closePanelDimensionEditor}
                                >
                                  Cancel
                                </button>
                              </div>
                            </form>
                          )}
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

      {(showGuessedVersionInfo || showSelectedVersionFallback || showMissingDimensions || showOversizedWarning) && (
        <div className={`results-warnings warnings-count-${totalWarningPanels}`}>
          {showGuessedVersionInfo && (
            <div className="warning-box info-box">
              <button
                className="warning-header"
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
                <div className="warning-content">
                  <div className="warning-description">
                    No specific BoardGameGeek version was selected for these game{gamesWithGuessedVersions.length !== 1 ? 's' : ''}. We guessed an alternate version to estimate dimensions. Selecting the right version keeps future calculations accurate and avoids guesswork.
                  </div>
                  <ul className={`warning-game-list ${gamesWithGuessedVersions.length > 8 ? 'scrollable' : ''}`}>
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
            <div className="warning-box selected-version-box">
              <button
                className="warning-header"
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
                <div className="warning-content">
                  <div className="warning-description">
                    The version you selected on BoardGameGeek does not list its measurements. We substituted dimensions from a different version so packing could continue. Updating your chosen version with accurate measurements will make future runs exact.
                  </div>
                  <ul className={`warning-game-list ${gamesUsingFallbackForSelectedVersion.length > 8 ? 'scrollable' : ''}`}>
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
                            <a href={game.correctionUrl} target="_blank" rel="noopener noreferrer" className="correction-link">
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
            <div className="warning-box">
              <button 
                className="warning-header"
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
                <div className="warning-content">
                  <div className="warning-description">
                    {gamesWithMissingDimensions.length} game{gamesWithMissingDimensions.length !== 1 ? 's' : ''} {gamesWithMissingDimensions.length !== 1 ? 'have' : 'has'} a selected BoardGameGeek version without dimensions. 
                    Default dimensions of 12.8" × 12.8" × 1.8" were assumed and marked with the warning icon{' '}
                    <FaExclamationTriangle className="inline-icon" aria-hidden="true" /> for easy reference.
                  </div>
                  <ul className={`warning-game-list ${gamesWithMissingDimensions.length > 8 ? 'scrollable' : ''}`}>
                    {gamesWithMissingDimensions.map((game) => (
                      <li key={game.id}>
                        {game.correctionUrl ? (
                          <a href={game.correctionUrl} target="_blank" rel="noopener noreferrer" className="correction-link">
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
            <div className="warning-box">
              <button 
                className="warning-header"
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
                <div className="warning-content">
                  <div className="warning-description">
                    {fitOversized
                      ? 'The following games have dimensions too large to fit in the Kallax. They have been treated as having dimensions of 12.8 to fit, but may not actually fit.'
                      : 'The following games have dimensions too large to fit in the Kallax. They have not been included in the list below.'}
                    {' '}
                    If you believe the dimensions are incorrect, please click the game name below to submit a dimension correction in BoardGameGeek.
                  </div>
                  <ul className={`warning-game-list ${oversizedWarningGames.length > 8 ? 'scrollable' : ''}`}>
                    {oversizedWarningGames.map((game) => {
                      const link = game.correctionUrl || game.versionsUrl;
                      return (
                        <li key={game.id}>
                          {link ? (
                            <a href={link} target="_blank" rel="noopener noreferrer" className="correction-link">
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

