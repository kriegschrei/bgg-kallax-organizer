import React from 'react';
import {
  FaTrashAlt,
  FaArrowsAltV,
  FaArrowsAltH,
  FaArrowsAlt,
  FaRulerCombined,
  FaTimes,
  FaExclamationTriangle,
  FaBoxOpen,
  FaChevronDown,
  FaChevronRight,
  FaUser,
  FaQuestionCircle,
  FaInfoCircle,
  FaTools,
} from 'react-icons/fa';
import DimensionForm from './DimensionForm';
import IconButton from './IconButton';
import { getGameColor } from '../utils/cubeVisualization';
import { resolveDisplayDimensions, getPrimaryDimension } from '../utils/dimensions';
import { resolveGameIdentity } from '../utils/overrideIdentity';

function CubeGameList({
  cube,
  interactionsDisabled,
  excludedLookup,
  orientationLookup,
  dimensionLookup,
  dimensionEditor,
  onOrientationCycle,
  onOpenDimensionEditor,
  onCloseDimensionEditor,
  onClearDimensionOverride,
  onDimensionFieldChange,
  onDimensionSave,
  onExcludeClick,
  badgeVisibility,
  onToggleBadgeVisibility,
  buildBadgesForGame,
}) {
  const games = Array.isArray(cube.games) ? cube.games : [];

  return (
    <div className="list-view">
      <ol>
        {games.map((game, index) => {
          const backgroundColor = getGameColor(index, games.length);
          const borderColor = backgroundColor.replace('80%', '60%');
          
          // Use packedDims directly from API response
          const packedDims = game.packedDims ?? { x: 0, y: 0, z: 0 };
          
          const identity = resolveGameIdentity(game);
          const overrideKey = identity?.key ?? null;
          const isExcluded = overrideKey ? Boolean(excludedLookup[overrideKey]) : false;
          const forcedOrientation = overrideKey ? orientationLookup[overrideKey] || null : null;
          const userDims = overrideKey ? dimensionLookup[overrideKey] || null : null;
          const displayDims = resolveDisplayDimensions(userDims, packedDims, dimensionEditor, overrideKey);
          const editingThisGame = dimensionEditor.overrideKey === overrideKey;
          
          // Get primary dimension from array to check missingDimensions
          const primaryDim = getPrimaryDimension(game.dimensions);
          const missingDimensions = primaryDim?.missing ?? false;
          const bggDefaultDimensions = Boolean(game.bggDefaultDimensions);
          const missingVersion = Boolean(game.missingVersion);
          const usedAlternateVersionDims = Boolean(game.usedAlternateVersionDims);
          const oversizedWarning = game.oversized?.x || game.oversized?.y;
          
          // Use gameName and versionName directly from the new schema
          const gameName = typeof game.gameName === 'string' ? game.gameName.trim() : '';
          const versionName = typeof game.versionName === 'string' ? game.versionName.trim() : '';
          const displayName = gameName || 'Unknown Game';
          const versionLabel = versionName || 'No Version Selected';
          const showVersionLine = Boolean(displayName) && Boolean(versionLabel);
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
          const badges = buildBadgesForGame(game);
          const hasBadges = badges.length > 0;
          const isBadgesExpanded = overrideKey ? badgeVisibility[overrideKey] ?? false : false;

          return (
            <li
              key={overrideKey ?? `game-${index}`}
              className={`game-list-item${isExcluded ? ' is-excluded' : ''}${
                userDims ? ' has-dimension-override' : ''
              }${isBadgesExpanded ? ' badges-expanded' : ''}`}
              style={{
                backgroundColor,
                borderLeft: `4px solid ${borderColor}`,
              }}
            >
              <div className="game-title-row">
                <span className="game-title">
                  <span className="game-index">{index + 1}.</span>
                  <span className="game-name">
                    <span className="game-base-name">{displayName}</span>
                    {showVersionLine && <span className="game-version">{versionLabel}</span>}
                  </span>
                </span>
              </div>
              <div className="game-actions-row">
                <IconButton
                  className={`game-action orientation${forcedOrientation ? ' active' : ''}`}
                  onClick={() => onOrientationCycle(game, forcedOrientation)}
                  disabled={interactionsDisabled}
                  title={orientationTitle}
                  icon={orientationIcon}
                  srLabel="Cycle orientation override"
                />
                <IconButton
                  className={`game-action dimension${editingThisGame ? ' active' : ''}`}
                  onClick={() =>
                    editingThisGame ? onCloseDimensionEditor() : onOpenDimensionEditor(game)
                  }
                  disabled={interactionsDisabled}
                  title="Edit custom dimensions"
                  icon={<FaRulerCombined aria-hidden="true" className="button-icon" />}
                  srLabel={
                    editingThisGame ? 'Close custom dimension editor' : 'Edit custom dimensions'
                  }
                />
                <IconButton
                  className="game-action delete"
                  onClick={() => onExcludeClick(game, isExcluded)}
                  disabled={interactionsDisabled || isExcluded}
                  title={
                    isExcluded ? 'Already excluded from future runs' : 'Exclude this game from future sorts'
                  }
                  icon={<FaTrashAlt aria-hidden="true" className="button-icon" />}
                  srLabel="Exclude game from future sorts"
                />
              </div>
              <div className="game-dimension-row">
                <span className={`game-dimension-chip${userDims ? ' has-user-dimensions' : ''}`}>
                  {userDims && (
                    <FaUser
                      aria-hidden="true"
                      className="dimension-override-icon"
                      title="Custom dimensions applied"
                    />
                  )}
                  <span className="game-dimension-text">
                    {displayDims.x.toFixed(1)}" × {displayDims.y.toFixed(1)}" ×{' '}
                    {displayDims.z.toFixed(1)}"
                  </span>
                </span>
                {bggDefaultDimensions && !usedAlternateVersionDims && (
                  <FaQuestionCircle
                    className="dimension-icon bgg-default-icon"
                    title={`BoardGameGeek default dimensions (11.7" × 11.7" × 2.8") were used`}
                    aria-hidden="true"
                  />
                )}
                {missingVersion && (
                  <FaInfoCircle
                    className="dimension-icon missing-version-icon"
                    title="No specific version selected - alternate version dimensions used"
                    aria-hidden="true"
                  />
                )}
                {usedAlternateVersionDims && (
                  <FaTools
                    className="dimension-icon alternate-dims-icon"
                    title="Dimensions from alternate version substituted"
                    aria-hidden="true"
                  />
                )}
                {(missingDimensions || (bggDefaultDimensions && !usedAlternateVersionDims)) && (
                  <FaExclamationTriangle
                    className="dimension-icon warning-icon"
                    title="Dimensions not available in BGG"
                    aria-hidden="true"
                  />
                )}
                {oversizedWarning && (
                  <FaBoxOpen
                    className="dimension-icon oversized-icon"
                    title={`This game may be too large for the cube (${game.oversized?.x ? 'width' : ''}${
                      game.oversized?.x && game.oversized?.y ? ' and ' : ''
                    }${game.oversized?.y ? 'height' : ''} > 13")`}
                    aria-hidden="true"
                  />
                )}
                {userDims && (
                  <IconButton
                    className="dimension-clear"
                    onClick={() => onClearDimensionOverride(game)}
                    disabled={interactionsDisabled}
                    title="Remove custom dimensions"
                    icon={<FaTimes aria-hidden="true" className="button-icon" />}
                    srLabel="Remove custom dimensions"
                  />
                )}
              </div>
              {(isExcluded || forcedOrientation || userDims) && (
                <div className="game-status-flags">
                  {isExcluded && <span className="override-pill">Excluded</span>}
                  {forcedOrientation && (
                    <span className="override-pill">Forced {forcedOrientation}</span>
                  )}
                  {userDims && <span className="override-pill">Custom dims</span>}
                </div>
              )}
              {editingThisGame && (
                <DimensionForm
                  className="dimension-edit-form"
                  gridClassName="dimension-edit-grid"
                  errorClassName="dimension-edit-error"
                  actionsClassName="dimension-edit-actions"
                  primaryButtonClassName="primary"
                  secondaryButtonClassName="secondary"
                  values={dimensionEditor}
                  error={dimensionEditor.error}
                  disabled={interactionsDisabled}
                  onChange={onDimensionFieldChange}
                  onSubmit={() => onDimensionSave(game)}
                  onCancel={onCloseDimensionEditor}
                />
              )}
              {hasBadges && (
                <div className="game-badges-section">
                  <button
                    type="button"
                    className="badge-toggle"
                    onClick={() => overrideKey && onToggleBadgeVisibility(overrideKey)}
                    aria-expanded={isBadgesExpanded}
                    disabled={!overrideKey}
                  >
                    {isBadgesExpanded ? (
                      <FaChevronDown aria-hidden="true" className="badge-toggle-icon" />
                    ) : (
                      <FaChevronRight aria-hidden="true" className="badge-toggle-icon" />
                    )}
                    <span className="badge-toggle-label">Details</span>
                  </button>
                  <div className="game-badge-list">
                    {badges.map((badge) => (
                      <span key={badge.key} className={`game-badge game-badge-${badge.field}`}>
                        {badge.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default CubeGameList;

