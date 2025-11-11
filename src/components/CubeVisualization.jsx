import React, { useCallback, useEffect, useMemo, useState } from 'react';
import CubeFrontView from './CubeFrontView';
import CubeGameList from './CubeGameList';
import './CubeVisualization.css';
import {
  SORTING_BADGE_BUILDERS,
  buildBadgesForGame as computeBadgesForGame,
} from '../utils/cubeVisualization';
import { resolveGameIdentity } from '../utils/overrideIdentity';

const KALLAX_WIDTH = 13;
const KALLAX_HEIGHT = 13;
const SCALE = 20; // pixels per inch for visualization

export default function CubeVisualization({
  cube,
  sorting = [],
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
    overrideKey: null,
    length: '',
    width: '',
    depth: '',
    error: '',
  });
  const interactionsDisabled = !overridesReady || isLoading;
  const [badgeVisibility, setBadgeVisibility] = useState({});

  const getOverrideKey = useCallback((game) => {
    const identity = resolveGameIdentity(game);
    return identity?.key ?? null;
  }, []);

  const gameIdsKey = useMemo(() => {
    if (!Array.isArray(cube.games)) {
      return '';
    }
    return cube.games.map((game) => getOverrideKey(game) ?? '').join('|');
  }, [cube.games, getOverrideKey]);

  useEffect(() => {
    if (!Array.isArray(cube.games)) {
      return;
    }
    setBadgeVisibility((prev) => {
      const next = {};
      cube.games.forEach((game) => {
        const overrideKey = getOverrideKey(game);
        if (!overrideKey) {
          return;
        }
        next[overrideKey] = prev[overrideKey] ?? false;
      });
      return next;
    });
  }, [cube.games, gameIdsKey, getOverrideKey]);

  const activeSortingFields = useMemo(
    () =>
      sorting
        .filter(
          (rule) =>
            rule?.enabled &&
            typeof rule.field === 'string' &&
            SORTING_BADGE_BUILDERS[rule.field]
        )
        .map((rule) => rule.field),
    [sorting]
  );

  const buildBadgesForGame = useCallback(
    (game) => computeBadgesForGame(game, activeSortingFields),
    [activeSortingFields]
  );

  const toggleBadgeVisibility = useCallback((overrideKey) => {
    setBadgeVisibility((prev) => ({
      ...prev,
      [overrideKey]: !prev[overrideKey],
    }));
  }, []);

  const closeDimensionEditor = () => {
    setDimensionEditor({
      overrideKey: null,
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

    const overrideKey = getOverrideKey(game);
    if (!overrideKey) {
      return;
    }

    const customDims = dimensionLookup[overrideKey];
    const source =
      customDims ||
      game.userDimensions ||
      game.bggDimensions ||
      game.dimensions ||
      {};

    setDimensionEditor({
      overrideKey,
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
          : typeof source.height === 'number' && Number.isFinite(source.height)
          ? String(source.height)
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
    const overrideKey = getOverrideKey(game);
    if (
      interactionsDisabled ||
      !onSaveDimensionOverride ||
      !overrideKey ||
      dimensionEditor.overrideKey !== overrideKey
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
    const overrideKey = getOverrideKey(game);
    if (!overrideKey) {
      return;
    }
    onRemoveDimensionOverride(overrideKey);
    if (dimensionEditor.overrideKey === overrideKey) {
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
      const overrideKey = getOverrideKey(game);
      if (overrideKey) {
        onClearOrientationOverride(overrideKey);
      }
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

