import { useCallback, useState, useEffect, useRef } from 'react';
import { useUnitPreference } from '../contexts/UnitPreferenceContext';
import { convertInchesToCm, convertCmToInches, convertDimensionInputToInches } from '../utils/unitConversion';

const INITIAL_STATE = {
  overrideKey: null,
  length: '',
  width: '',
  depth: '',
  error: '',
};

/**
 * Hook to manage dimension override editor state and actions.
 * @param {Object} options - Configuration object
 * @param {boolean} options.overridesReady - Whether overrides are ready
 * @param {boolean} options.isLoading - Whether a request is in progress
 * @param {Function} options.onSaveDimensionOverride - Handler for saving dimension override
 * @returns {Object} Object containing editor state and handlers
 */
export function useDimensionOverrideEditor({
  overridesReady,
  isLoading,
  onSaveDimensionOverride,
}) {
  const [editorState, setEditorState] = useState(INITIAL_STATE);
  const { isMetric } = useUnitPreference();
  const prevIsMetricRef = useRef(isMetric);

  const normalizeDimensionPart = useCallback((value) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();

      if (!trimmed) {
        return '';
      }

      if (Number.isFinite(Number(trimmed))) {
        return trimmed;
      }
    }

    return '';
  }, []);

  const openEditor = useCallback((game) => {
    if (!game) {
      return;
    }

    // Convert from inches to cm for display if metric is enabled
    const convertForDisplay = (value) => {
      const numeric = normalizeDimensionPart(value);
      if (!numeric || numeric === '') {
        return '';
      }
      const numValue = parseFloat(numeric);
      if (!Number.isFinite(numValue)) {
        return '';
      }
      return isMetric ? String(convertInchesToCm(numValue)) : numeric;
    };

    setEditorState({
      overrideKey: game.key,
      length: convertForDisplay(game.length),
      width: convertForDisplay(game.width),
      depth: convertForDisplay(game.depth),
      error: '',
    });
    prevIsMetricRef.current = isMetric;
  }, [normalizeDimensionPart, isMetric]);

  // Convert editor values when unit preference changes
  useEffect(() => {
    // Only convert if editor is open and unit preference actually changed
    if (editorState.overrideKey && prevIsMetricRef.current !== isMetric) {
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

      setEditorState((prev) => ({
        ...prev,
        length: convertValue(prev.length),
        width: convertValue(prev.width),
        depth: convertValue(prev.depth),
      }));
      
      prevIsMetricRef.current = isMetric;
    }
  }, [isMetric, editorState.overrideKey]);

  const closeEditor = useCallback(() => {
    setEditorState(INITIAL_STATE);
  }, []);

  const handleFieldChange = useCallback((field, value) => {
    setEditorState((prev) => ({
      ...prev,
      [field]: value,
      error: '',
    }));
  }, []);

  const handleSave = useCallback(
    async (game) => {
      if (!onSaveDimensionOverride || !overridesReady || isLoading || !game) {
        return;
      }

      if (editorState.overrideKey !== game.key) {
        openEditor(game);
        return;
      }

      // Convert from display unit (cm if metric) to inches before saving
      const convertForSave = (value) => {
        const converted = convertDimensionInputToInches(value, isMetric);
        return converted !== null ? String(converted) : value;
      };

      const success = await onSaveDimensionOverride(game, {
        length: convertForSave(editorState.length),
        width: convertForSave(editorState.width),
        depth: convertForSave(editorState.depth),
      });

      if (success) {
        closeEditor();
      } else {
        const unitLabel = isMetric ? 'cm' : 'inches';
        setEditorState((prev) => ({
          ...prev,
          error: `Please enter positive decimal ${unitLabel} for all fields.`,
        }));
      }
    },
    [closeEditor, editorState, isLoading, isMetric, onSaveDimensionOverride, openEditor, overridesReady]
  );

  const isEditingGame = useCallback(
    (overrideKey) => editorState.overrideKey === overrideKey,
    [editorState.overrideKey]
  );

  return {
    editorState,
    openEditor,
    closeEditor,
    handleFieldChange,
    handleSave,
    isEditingGame,
  };
}


