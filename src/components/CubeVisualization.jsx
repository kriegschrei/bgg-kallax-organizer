import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import CubeFrontView from './CubeFrontView';
import CubeGameList from './CubeGameList';
import './CubeVisualization.css';
import {
  SORTING_BADGE_BUILDERS,
  buildBadgesForGame as computeBadgesForGame,
} from '../utils/cubeVisualization';
import { resolveGameIdentity } from '../utils/overrideIdentity';
import { getPrimaryDimension } from '../utils/dimensions';
import { useUnitPreference } from '../contexts/UnitPreferenceContext';
import { convertInchesToCm, convertCmToInches, convertDimensionInputToInches } from '../utils/unitConversion';

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

  const { isMetric } = useUnitPreference();
  const prevIsMetricRef = useRef(isMetric);
  
  // Convert editor values when unit preference changes
  useEffect(() => {
    // Only convert if editor is open and unit preference actually changed
    if (dimensionEditor.overrideKey && prevIsMetricRef.current !== isMetric) {
      const convertValue = (value) => {
        const numeric = parseFloat(value);
        if (!Number.isFinite(numeric) || numeric <= 0) {
          return value; // Keep invalid values as-is
        }
        
        // Convert from previous unit to new unit
        if (prevIsMetricRef.current && !isMetric) {
          // Was metric, now imperial: convert cm to inches
          return String(convertCmToInches(numeric));
        } else if (!prevIsMetricRef.current && isMetric) {
          // Was imperial, now metric: convert inches to cm
          return String(convertInchesToCm(numeric));
        }
        return value;
      };

      setDimensionEditor((prev) => ({
        ...prev,
        length: convertValue(prev.length),
        width: convertValue(prev.width),
        depth: convertValue(prev.depth),
      }));
      
      prevIsMetricRef.current = isMetric;
    }
  }, [isMetric, dimensionEditor.overrideKey]);
  
  const openDimensionEditor = (game) => {
    if (interactionsDisabled) {
      return;
    }

    const overrideKey = getOverrideKey(game);
    if (!overrideKey) {
      return;
    }

    const customDims = dimensionLookup[overrideKey];
    // Get primary dimension from dimensions array, or use custom override
    const primaryDim = getPrimaryDimension(game.dimensions);
    const source = customDims || primaryDim || {};

    // Convert from inches to cm for display if metric is enabled
    const convertForDisplay = (value) => {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return '';
      }
      return isMetric ? String(convertInchesToCm(value)) : String(value);
    };

    setDimensionEditor({
      overrideKey,
      length: convertForDisplay(source.length),
      width: convertForDisplay(source.width),
      depth: convertForDisplay(source.depth ?? source.height),
      error: '',
    });
    prevIsMetricRef.current = isMetric;
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

    // Convert from display unit (cm if metric) to inches before saving
    const convertForSave = (value) => {
      const converted = convertDimensionInputToInches(value, isMetric);
      return converted !== null ? String(converted) : value;
    };

    const success = await onSaveDimensionOverride(game, {
      length: convertForSave(dimensionEditor.length),
      width: convertForSave(dimensionEditor.width),
      depth: convertForSave(dimensionEditor.depth),
    });

    if (success) {
      closeDimensionEditor();
    } else {
      const unitLabel = isMetric ? 'cm' : 'inches';
      setDimensionEditor((prev) => ({
        ...prev,
        error: `Please enter positive decimal ${unitLabel} for all fields.`,
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

