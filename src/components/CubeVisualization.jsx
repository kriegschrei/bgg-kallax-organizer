import React, { useCallback, useEffect, useMemo, useState } from 'react';
import CubeFrontView from './CubeFrontView';
import CubeGameList from './CubeGameList';
import './CubeVisualization.css';
import {
  PRIORITY_BADGE_BUILDERS,
  buildBadgesForGame as computeBadgesForGame,
} from '../utils/cubeVisualization';

const KALLAX_WIDTH = 13;
const KALLAX_HEIGHT = 13;
const SCALE = 20; // pixels per inch for visualization

export default function CubeVisualization({
  cube,
  priorities = [],
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
  const [badgeVisibility, setBadgeVisibility] = useState({});

  const gameIdsKey = useMemo(
    () => (Array.isArray(cube.games) ? cube.games.map((game) => game.id).join('|') : ''),
    [cube.games]
  );

  useEffect(() => {
    if (!Array.isArray(cube.games)) {
      return;
    }
    setBadgeVisibility((prev) => {
      const next = {};
      cube.games.forEach((game) => {
        if (game?.id == null) {
          return;
        }
        next[game.id] = prev[game.id] ?? false;
      });
      return next;
    });
  }, [gameIdsKey, cube.games]);

  const activePriorityFields = useMemo(
    () =>
      priorities
        .filter(
          (priority) =>
            priority?.enabled &&
            typeof priority.field === 'string' &&
            priority.field !== 'name' &&
            PRIORITY_BADGE_BUILDERS[priority.field]
        )
        .map((priority) => priority.field),
    [priorities]
  );

  const buildBadgesForGame = useCallback(
    (game) => {
      if (activePriorityFields.length === 0) {
        return [];
      }
      const badges = [];
      activePriorityFields.forEach((field) => {
        const builder = PRIORITY_BADGE_BUILDERS[field];
        if (!builder) {
          return;
        }
        const fieldBadges = builder(game);
        if (!Array.isArray(fieldBadges) || fieldBadges.length === 0) {
          return;
        }
        fieldBadges.forEach((badge, index) => {
          const fallbackKey = `${field}-${game.id}-${index}`;
          badges.push({
            field,
            label: badge.label,
            key: badge.key ?? fallbackKey,
          });
        });
      });
      return badges;
    },
    [activePriorityFields]
  );

  const toggleBadgeVisibility = useCallback((gameId) => {
    setBadgeVisibility((prev) => ({
      ...prev,
      [gameId]: !prev[gameId],
    }));
  }, []);

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
    <div className="cube-visualization card">
      <h3>Cube #{cube.id}</h3>
      <div className="visualization-container">
        <CubeFrontView cube={cube} canvasWidth={canvasWidth} canvasHeight={canvasHeight} scale={SCALE} />
        <CubeGameList
          cube={cube}
          interactionsDisabled={interactionsDisabled}
          excludedLookup={excludedLookup}
          orientationLookup={orientationLookup}
          dimensionLookup={dimensionLookup}
          dimensionEditor={dimensionEditor}
          onOrientationCycle={handleOrientationCycle}
          onOpenDimensionEditor={openDimensionEditor}
          onCloseDimensionEditor={closeDimensionEditor}
          onClearDimensionOverride={handleClearDimensionOverride}
          onDimensionFieldChange={handleDimensionFieldChange}
          onDimensionSave={handleDimensionSave}
          onExcludeClick={handleExcludeClick}
          badgeVisibility={badgeVisibility}
          onToggleBadgeVisibility={toggleBadgeVisibility}
          buildBadgesForGame={buildBadgesForGame}
        />
      </div>
    </div>
  );
}

