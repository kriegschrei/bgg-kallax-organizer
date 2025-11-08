import React, { useState } from 'react';
import {
  FaTrashAlt,
  FaArrowsAltV,
  FaArrowsAltH,
  FaArrowsAlt,
  FaRulerCombined,
  FaTimes,
  FaExclamationTriangle,
  FaBoxOpen,
} from 'react-icons/fa';
import './CubeVisualization.css';

const KALLAX_WIDTH = 13;
const KALLAX_HEIGHT = 13;
const SCALE = 20; // pixels per inch for visualization

// Helper function to get consistent color for a game
function getGameColor(index, total) {
  return `hsl(${(index * 360) / total}, 70%, 80%)`;
}

export default function CubeVisualization({
  cube,
  verticalStacking,
  excludedLookup = {},
  orientationLookup = {},
  dimensionLookup = {},
  onExcludeGame,
  onSetOrientationOverride,
  onClearOrientationOverride,
  onSaveDimensionOverride,
  onRemoveDimensionOverride,
  overridesReady = true,
  isLoading = false,
}) {
  const canvasWidth = KALLAX_WIDTH * SCALE;
  const canvasHeight = KALLAX_HEIGHT * SCALE;
  const [dimensionEditor, setDimensionEditor] = useState({
    gameId: null,
    length: '',
    width: '',
    depth: '',
    error: '',
  });
  const interactionsDisabled = !overridesReady || isLoading;

  const formatDimensions = (dims) => {
    if (!dims) {
      return '—';
    }

    const normalize = (value) =>
      typeof value === 'number' && Number.isFinite(value) && value > 0
        ? value
        : null;

    const length = normalize(dims.length ?? dims.height ?? dims.x ?? null);
    const width = normalize(dims.width ?? dims.y ?? null);
    const depth = normalize(dims.depth ?? dims.z ?? null);

    const segments = [length, width, depth].map((value) =>
      value !== null ? `${value.toFixed(2)}"` : '—'
    );

    return segments.join(' × ');
  };

  const closeDimensionEditor = () => {
    setDimensionEditor({
      gameId: null,
      length: '',
      width: '',
      depth: '',
      error: '',
    });
  };

  const openDimensionEditor = (game) => {
    if (interactionsDisabled) {
      return;
    }

    const customDims = dimensionLookup[game.id];
    const source =
      customDims ||
      game.userDimensions ||
      game.bggDimensions ||
      game.dimensions ||
      {};

    setDimensionEditor({
      gameId: game.id,
      length:
        typeof source.length === 'number' && Number.isFinite(source.length)
          ? String(source.length)
          : '',
      width:
        typeof source.width === 'number' && Number.isFinite(source.width)
          ? String(source.width)
          : '',
      depth:
        typeof source.depth === 'number' && Number.isFinite(source.depth)
          ? String(source.depth)
          : '',
      error: '',
    });
  };

  const handleDimensionFieldChange = (field, value) => {
    setDimensionEditor((prev) => ({
      ...prev,
      [field]: value,
      error: field === 'error' ? value : '',
    }));
  };

  const handleDimensionSave = async (game) => {
    if (
      interactionsDisabled ||
      !onSaveDimensionOverride ||
      dimensionEditor.gameId !== game.id
    ) {
      return;
    }

    const success = await onSaveDimensionOverride(game, {
      length: dimensionEditor.length,
      width: dimensionEditor.width,
      depth: dimensionEditor.depth,
    });

    if (success) {
      closeDimensionEditor();
    } else {
      setDimensionEditor((prev) => ({
        ...prev,
        error: 'Please enter positive decimal inches for all fields.',
      }));
    }
  };

  const handleClearDimensionOverride = (game) => {
    if (interactionsDisabled || !onRemoveDimensionOverride) {
      return;
    }
    onRemoveDimensionOverride(game.id);
    if (dimensionEditor.gameId === game.id) {
      closeDimensionEditor();
    }
  };

  const handleExcludeClick = (game, isExcluded) => {
    if (interactionsDisabled || !onExcludeGame || isExcluded) {
      return;
    }
    onExcludeGame(game);
  };

  const handleOrientationCycle = (game, currentOrientation) => {
    if (interactionsDisabled) {
      return;
    }
    if (!onSetOrientationOverride || !onClearOrientationOverride) {
      return;
    }

    if (!currentOrientation) {
      onSetOrientationOverride(game, 'vertical');
    } else if (currentOrientation === 'vertical') {
      onSetOrientationOverride(game, 'horizontal');
    } else {
      onClearOrientationOverride(game.id);
    }
  };

  return (
    <div className="cube-visualization">
      <h3>Cube #{cube.id}</h3>
      <div className="visualization-container">
        <div className="front-view">
          <h4>Front View</h4>
          <svg
            width={canvasWidth}
            height={canvasHeight}
            className="cube-svg"
          >
            {/* Kallax border */}
            <rect
              x="0"
              y="0"
              width={canvasWidth}
              height={canvasHeight}
              fill="none"
              stroke="#34495e"
              strokeWidth="2"
            />
            
            {/* Games - render using 2D positioning when available, otherwise row layout */}
            {cube.games && cube.games.map((game, index) => {
              // Use actual dimensions for display
              const actualDims = game.actualOrientedDims || game.orientedDims;
              // Use clamped dimensions for positioning calculations
              const clampedDims = game.orientedDims;
              
              let rectX, rectY;
              
              if (game.position) {
                // Use actual 2D bin packing position
                // Use clamped height for Y calculation since that's what packing used
                rectX = game.position.x * SCALE;
                rectY = canvasHeight - (game.position.y + clampedDims.y) * SCALE;
                
                // Debug first game
                if (index === 0) {
                  console.log('First game positioning:', {
                    name: game.name,
                    position: game.position,
                    clampedDims,
                    actualDims,
                    rectX,
                    rectY,
                    canvasHeight
                  });
                }
              } else {
                // Fallback to row-based positioning
                const rowIndex = cube.rows?.findIndex(r => r.games.includes(game)) ?? -1;
                
                if (rowIndex >= 0 && cube.rows[rowIndex]) {
                  const row = cube.rows[rowIndex];
                  const rowBottomOffset = cube.rows
                    .slice(0, rowIndex)
                    .reduce((sum, r) => sum + r.heightUsed, 0);
                  const xOffsetInRow = row.games
                    .slice(0, row.games.indexOf(game))
                    .reduce((sum, g) => sum + g.orientedDims.x, 0);
                  
                  rectX = xOffsetInRow * SCALE;
                  rectY = canvasHeight - (rowBottomOffset + clampedDims.y) * SCALE;
                } else {
                  // Default positioning if row structure is missing
                  console.warn('Game missing row data:', game.name, game);
                  rectX = 0;
                  rectY = 0;
                }
              }
              
              // Display actual dimensions (may extend beyond cube boundaries)
              const rectWidth = actualDims.x * SCALE;
              const rectHeight = actualDims.y * SCALE;
                
              return (
                <g key={game.id}>
                  <rect
                    x={rectX}
                    y={rectY}
                    width={rectWidth}
                    height={rectHeight}
                    fill={getGameColor(index, cube.games.length)}
                    stroke={(game.oversizedX || game.oversizedY) ? "#e74c3c" : "#2c3e50"}
                    strokeWidth={(game.oversizedX || game.oversizedY) ? "2" : "1"}
                    strokeDasharray={(game.oversizedX || game.oversizedY) ? "4,2" : "none"}
                  />
                  <text
                    x={rectX + rectWidth / 2}
                    y={rectY + rectHeight / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="12"
                    fontWeight="bold"
                    fill="#2c3e50"
                    className="game-label"
                  >
                    {index + 1}
                  </text>
                </g>
              );
            })}
          </svg>
          <p className="dimension-label">13" W × 13" H</p>
        </div>
        
        <div className="list-view">
          <h4>Game List (In Order)</h4>
          <ol>
            {cube.games.map((game, index) => {
              const backgroundColor = getGameColor(index, cube.games.length);
              const borderColor = backgroundColor.replace('80%', '60%');
              const orientedDims = game.actualOrientedDims || game.orientedDims || { x: 0, y: 0, z: 0 };
              const isExcluded = Boolean(excludedLookup[game.id]);
              const forcedOrientation = orientationLookup[game.id] || null;
              const userDims = dimensionLookup[game.id] || null;
              const editingThisGame = dimensionEditor.gameId === game.id;
              const bggDims = game.bggDimensions || game.dimensions;
              const dimensionWarning = game.dimensions?.missingDimensions;
              const oversizedWarning = game.oversizedX || game.oversizedY;
              const orientationIcon =
                forcedOrientation === 'horizontal' ? (
                  <FaArrowsAltH aria-hidden="true" className="button-icon" />
                ) : forcedOrientation === 'vertical' ? (
                  <FaArrowsAltV aria-hidden="true" className="button-icon" />
                ) : (
                  <FaArrowsAlt aria-hidden="true" className="button-icon" />
                );
              const orientationTitle = forcedOrientation
                ? `Forced ${forcedOrientation} orientation. Click to change or clear.`
                : 'Cycle orientation override (vertical → horizontal → none)';

              return (
                <li
                  key={game.id}
                  className={`game-list-item${isExcluded ? ' is-excluded' : ''}${userDims ? ' has-dimension-override' : ''}`}
                  style={{
                    backgroundColor,
                    borderLeft: `4px solid ${borderColor}`,
                  }}
                >
                  <div className="game-header-row">
                    <strong>{game.name}</strong>
                    <div className="game-actions">
                      <button
                        type="button"
                        className={`game-action orientation${forcedOrientation ? ' active' : ''}`}
                        onClick={() => handleOrientationCycle(game, forcedOrientation)}
                        disabled={interactionsDisabled}
                        title={orientationTitle}
                      >
                        {orientationIcon}
                        <span className="sr-only">Cycle orientation override</span>
                      </button>
                      <button
                        type="button"
                        className={`game-action dimension${editingThisGame ? ' active' : ''}`}
                        onClick={() =>
                          editingThisGame ? closeDimensionEditor() : openDimensionEditor(game)
                        }
                        disabled={interactionsDisabled}
                        title="Edit custom dimensions"
                      >
                        <FaRulerCombined aria-hidden="true" className="button-icon" />
                        <span className="sr-only">
                          {editingThisGame ? 'Close custom dimension editor' : 'Edit custom dimensions'}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="game-action delete"
                        onClick={() => handleExcludeClick(game, isExcluded)}
                        disabled={interactionsDisabled || isExcluded}
                        title={
                          isExcluded
                            ? 'Already excluded from future runs'
                            : 'Exclude this game from future sorts'
                        }
                      >
                        <FaTrashAlt aria-hidden="true" className="button-icon" />
                        <span className="sr-only">Exclude game from future sorts</span>
                      </button>
                    </div>
                  </div>
                  <div className="game-details">
                    <span className="dimension-info">
                      {orientedDims.x.toFixed(1)}" × {orientedDims.y.toFixed(1)}" × {orientedDims.z.toFixed(1)}"
                      {dimensionWarning && (
                        <FaExclamationTriangle
                          className="inline-icon icon-end warning-icon"
                          title="Dimensions not available in BGG"
                          aria-hidden="true"
                        />
                      )}
                      {oversizedWarning && (
                        <FaBoxOpen
                          className="inline-icon icon-end oversized-icon"
                          title={`This game may be too large for the cube (${game.oversizedX ? 'width' : ''}${
                            game.oversizedX && game.oversizedY ? ' and ' : ''
                          }${game.oversizedY ? 'height' : ''} > 13")`}
                          aria-hidden="true"
                        />
                      )}
                    </span>
                    {game.categories && game.categories.length > 0 && (
                      <span className="category">{game.categories[0]}</span>
                    )}
                    {game.bggRank && <span className="rank">Rank: #{game.bggRank}</span>}
                  </div>
                  <div className="game-tags">
                    {isExcluded && <span className="override-pill">Excluded</span>}
                    {forcedOrientation && (
                      <span className="override-pill">Forced {forcedOrientation}</span>
                    )}
                    {userDims && <span className="override-pill">Custom dims</span>}
                  </div>
                  <div className="game-dimensions">
                    <div className="dimension-row">
                      <span className="dimension-label">BGG:</span>
                      <span>{formatDimensions(bggDims)}</span>
                    </div>
                    {userDims && (
                      <div className="dimension-row">
                        <span className="dimension-label">Yours:</span>
                        <span>{formatDimensions(userDims)}</span>
                        <button
                          type="button"
                          className="dimension-clear"
                          onClick={() => handleClearDimensionOverride(game)}
                          disabled={interactionsDisabled}
                          title="Remove custom dimensions"
                        >
                          <FaTimes aria-hidden="true" className="button-icon" />
                          <span className="sr-only">Remove custom dimensions</span>
                        </button>
                      </div>
                    )}
                  </div>
                  {editingThisGame && (
                    <form
                      className="dimension-edit-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        handleDimensionSave(game);
                      }}
                    >
                      <div className="dimension-edit-grid">
                        <label>
                          Length (in)
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={dimensionEditor.length}
                            onChange={(event) =>
                              handleDimensionFieldChange('length', event.target.value)
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
                            value={dimensionEditor.width}
                            onChange={(event) =>
                              handleDimensionFieldChange('width', event.target.value)
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
                            value={dimensionEditor.depth}
                            onChange={(event) =>
                              handleDimensionFieldChange('depth', event.target.value)
                            }
                            required
                          />
                        </label>
                      </div>
                      {dimensionEditor.error && (
                        <p className="dimension-edit-error">{dimensionEditor.error}</p>
                      )}
                      <div className="dimension-edit-actions">
                        <button type="submit" className="primary" disabled={interactionsDisabled}>
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={closeDimensionEditor}
                          className="secondary"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}

