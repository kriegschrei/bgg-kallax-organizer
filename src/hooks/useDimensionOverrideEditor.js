import { useCallback, useState } from 'react';

const INITIAL_STATE = {
  gameId: null,
  length: '',
  width: '',
  depth: '',
  error: '',
};

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
    return '';
  }, []);

  const openEditor = useCallback((game) => {
    if (!game) {
      return;
    }

    setEditorState({
      gameId: game.id,
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

      if (editorState.gameId !== game.id) {
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
    (gameId) => editorState.gameId === gameId,
    [editorState.gameId]
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


