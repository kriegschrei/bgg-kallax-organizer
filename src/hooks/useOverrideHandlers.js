import { useCallback } from 'react';
import {
  saveExcludedGame,
  removeExcludedGame,
  saveOrientationOverride,
  removeOrientationOverride,
  saveDimensionOverride,
  removeDimensionOverride,
} from '../services/storage/indexedDb';
import {
  createExcludedOverrideEntry,
  createOrientationOverrideEntry,
  createDimensionOverrideEntry,
} from '../utils/overrideIdentity';

/**
 * Hook to manage override handlers for excluded games, orientation, and dimensions.
 * @param {Object} options - Configuration object
 * @param {Function} options.setExcludedGamesMap - Setter for excluded games map
 * @param {Function} options.setOrientationOverridesMap - Setter for orientation overrides map
 * @param {Function} options.setDimensionOverridesMap - Setter for dimension overrides map
 * @returns {Object} Object containing all override handler functions
 */
export const useOverrideHandlers = ({
  setExcludedGamesMap,
  setOrientationOverridesMap,
  setDimensionOverridesMap,
}) => {
  /**
   * Handles excluding a game from future sorts.
   * @param {Object} game - The game object to exclude
   */
  const handleExcludeGame = useCallback(
    async (game) => {
      const entry = createExcludedOverrideEntry(game);
      if (!entry) {
        console.warn('Unable to exclude game – missing gameId/versionId metadata', game);
        return;
      }

      setExcludedGamesMap((prev) => {
        if (prev[entry.key]) {
          return prev;
        }
        return {
          ...prev,
          [entry.key]: entry,
        };
      });

      try {
        await saveExcludedGame(entry);
      } catch (storageError) {
        console.error('Unable to persist excluded game', storageError);
      }
    },
    [setExcludedGamesMap]
  );

  /**
   * Handles re-including a previously excluded game.
   * @param {string} overrideKey - The override key of the game to re-include
   */
  const handleReincludeGame = useCallback(
    async (overrideKey) => {
      if (!overrideKey) {
        return;
      }

      setExcludedGamesMap((prev) => {
        if (!prev[overrideKey]) {
          return prev;
        }
        const next = { ...prev };
        delete next[overrideKey];
        return next;
      });

      try {
        await removeExcludedGame(overrideKey);
      } catch (storageError) {
        console.error('Unable to remove excluded game', storageError);
      }
    },
    [setExcludedGamesMap]
  );

  /**
   * Handles setting an orientation override for a game.
   * @param {Object} game - The game object
   * @param {string} orientation - The orientation ('horizontal' or 'vertical')
   */
  const handleSetOrientationOverride = useCallback(
    async (game, orientation) => {
      const entry = createOrientationOverrideEntry(game, orientation);
      if (!entry) {
        console.warn('Unable to set orientation override – missing metadata or orientation', {
          game,
          orientation,
        });
        return;
      }

      setOrientationOverridesMap((prev) => ({
        ...prev,
        [entry.key]: entry,
      }));

      try {
        await saveOrientationOverride(entry);
      } catch (storageError) {
        console.error('Unable to persist orientation override', storageError);
      }
    },
    [setOrientationOverridesMap]
  );

  /**
   * Handles clearing an orientation override for a game.
   * @param {string} overrideKey - The override key of the game
   */
  const handleClearOrientationOverride = useCallback(
    async (overrideKey) => {
      if (!overrideKey) {
        return;
      }

      setOrientationOverridesMap((prev) => {
        if (!prev[overrideKey]) {
          return prev;
        }
        const next = { ...prev };
        delete next[overrideKey];
        return next;
      });

      try {
        await removeOrientationOverride(overrideKey);
      } catch (storageError) {
        console.error('Unable to remove orientation override', storageError);
      }
    },
    [setOrientationOverridesMap]
  );

  /**
   * Handles saving a dimension override for a game.
   * @param {Object} game - The game object
   * @param {Object} rawDimensions - The raw dimensions object
   * @returns {Promise<boolean>} True if successful, false otherwise
   */
  const handleSaveDimensionOverride = useCallback(
    async (game, rawDimensions) => {
      if (!rawDimensions) {
        return false;
      }

      const entry = createDimensionOverrideEntry(game, rawDimensions);
      if (!entry) {
        return false;
      }

      setDimensionOverridesMap((prev) => ({
        ...prev,
        [entry.key]: entry,
      }));

      try {
        await saveDimensionOverride(entry);
        return true;
      } catch (storageError) {
        console.error('Unable to persist dimension override', storageError);
        return false;
      }
    },
    [setDimensionOverridesMap]
  );

  /**
   * Handles removing a dimension override for a game.
   * @param {string} overrideKey - The override key of the game
   */
  const handleRemoveDimensionOverride = useCallback(
    async (overrideKey) => {
      if (!overrideKey) {
        return;
      }

      setDimensionOverridesMap((prev) => {
        if (!prev[overrideKey]) {
          return prev;
        }
        const next = { ...prev };
        delete next[overrideKey];
        return next;
      });

      try {
        await removeDimensionOverride(overrideKey);
      } catch (storageError) {
        console.error('Unable to remove dimension override', storageError);
      }
    },
    [setDimensionOverridesMap]
  );

  return {
    handleExcludeGame,
    handleReincludeGame,
    handleSetOrientationOverride,
    handleClearOrientationOverride,
    handleSaveDimensionOverride,
    handleRemoveDimensionOverride,
  };
};

