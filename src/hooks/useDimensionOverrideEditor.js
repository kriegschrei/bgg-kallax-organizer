import { useCallback, useState } from 'react';

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

    setEditorState({
      overrideKey: game.key,
      length: normalizeDimensionPart(game.length),
      width: normalizeDimensionPart(game.width),
      depth: normalizeDimensionPart(game.depth),
      error: '',
    });
  }, [normalizeDimensionPart]);

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

      const success = await onSaveDimensionOverride(game, {
        length: editorState.length,
        width: editorState.width,
        depth: editorState.depth,
      });

      if (success) {
        closeEditor();
      } else {
        setEditorState((prev) => ({
          ...prev,
          error: 'Please enter positive decimal inches for all fields.',
        }));
      }
    },
    [closeEditor, editorState, isLoading, onSaveDimensionOverride, openEditor, overridesReady]
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


