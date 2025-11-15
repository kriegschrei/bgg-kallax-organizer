import React from 'react';
import GameListItem from './GameListItem';
import { getGameColor } from '../utils/cubeVisualization';
import { PRINT_TWO_COLUMN_GAME_THRESHOLD } from '../constants/appDefaults';

/**
 * Renders a list of games for a cube with color coding and interactive controls.
 * @param {Object} props - Component props
 * @param {Object} props.cube - The cube object containing games
 * @param {boolean} props.interactionsDisabled - Whether interactions are disabled
 * @param {Object} props.excludedLookup - Lookup map for excluded games
 * @param {Object} props.orientationLookup - Lookup map for orientation overrides
 * @param {Object} props.dimensionLookup - Lookup map for dimension overrides
 * @param {Object} props.dimensionEditor - Current dimension editor state
 * @param {Object} props.badgeVisibility - Badge visibility state map
 * @param {Function} props.onOrientationCycle - Handler for orientation cycling
 * @param {Function} props.onOpenDimensionEditor - Handler for opening dimension editor
 * @param {Function} props.onCloseDimensionEditor - Handler for closing dimension editor
 * @param {Function} props.onClearDimensionOverride - Handler for clearing dimension override
 * @param {Function} props.onDimensionFieldChange - Handler for dimension field changes
 * @param {Function} props.onDimensionSave - Handler for saving dimensions
 * @param {Function} props.onExcludeClick - Handler for exclude click
 * @param {Function} props.onToggleBadgeVisibility - Handler for toggling badge visibility
 * @param {Function} props.buildBadgesForGame - Function to build badges for a game
 */
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
  const hasManyGames = games.length > PRINT_TWO_COLUMN_GAME_THRESHOLD;

  return (
    <div className="list-view">
      <ol className={hasManyGames ? 'list-view--two-columns' : ''}>
        {games.map((game, index) => {
          const backgroundColor = getGameColor(index, games.length);
          const borderColor = backgroundColor.replace('80%', '60%');

          return (
            <GameListItem
              key={game.id || index}
              game={game}
              index={index}
              backgroundColor={backgroundColor}
              borderColor={borderColor}
              interactionsDisabled={interactionsDisabled}
              excludedLookup={excludedLookup}
              orientationLookup={orientationLookup}
              dimensionLookup={dimensionLookup}
              dimensionEditor={dimensionEditor}
              badgeVisibility={badgeVisibility}
              onOrientationCycle={onOrientationCycle}
              onOpenDimensionEditor={onOpenDimensionEditor}
              onCloseDimensionEditor={onCloseDimensionEditor}
              onClearDimensionOverride={onClearDimensionOverride}
              onDimensionFieldChange={onDimensionFieldChange}
              onDimensionSave={onDimensionSave}
              onExcludeClick={onExcludeClick}
              onToggleBadgeVisibility={onToggleBadgeVisibility}
              buildBadgesForGame={buildBadgesForGame}
            />
          );
        })}
      </ol>
    </div>
  );
}

export default CubeGameList;

