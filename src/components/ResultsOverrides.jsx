import React, { useCallback, useMemo, useState } from 'react';
import {
  FaTrashAlt,
  FaArrowsAlt,
  FaArrowsAltH,
  FaArrowsAltV,
  FaRulerCombined,
  FaEdit,
  FaTimes,
} from 'react-icons/fa';
import OverridesSection from './OverridesSection';
import OverrideList from './OverrideList';
import DimensionForm from './DimensionForm';
import IconButton from './IconButton';

const PANEL_KEYS = {
  excluded: 'excluded',
  orientation: 'orientation',
  dimensions: 'dimensions',
};

export default function ResultsOverrides({
  excludedGames,
  orientationItems,
  dimensionOverrides,
  overridesReady,
  isLoading,
  renderDisclosureIcon,
  onRestoreExcludedGame,
  onSetOrientationOverride,
  onClearOrientationOverride,
  onRemoveDimensionOverride,
  onDimensionFieldChange,
  onDimensionSave,
  onDimensionOpen,
  onDimensionClose,
  isDimensionEditing,
  dimensionEditorState,
  getScrollableListClassName,
  formatGameDimensions,
  formatEditorDimensions,
}) {
  const [expandedPanels, setExpandedPanels] = useState({
    [PANEL_KEYS.excluded]: false,
    [PANEL_KEYS.orientation]: false,
    [PANEL_KEYS.dimensions]: false,
  });

  const togglePanel = useCallback((panelKey) => {
    setExpandedPanels((prev) => ({
      ...prev,
      [panelKey]: !prev[panelKey],
    }));
  }, []);

  const hasExcludedGames = excludedGames.length > 0;
  const hasOrientationOverrides = orientationItems.length > 0;
  const hasDimensionOverrides = dimensionOverrides.length > 0;
  const activePanelCount = [hasExcludedGames, hasOrientationOverrides, hasDimensionOverrides].filter(
    Boolean
  ).length;

  const handleOrientationCycle = useCallback(
    (game) => {
      if (!onSetOrientationOverride || !overridesReady || isLoading || !game) {
        return;
      }
      const nextOrientation = game.orientation === 'vertical' ? 'horizontal' : 'vertical';
      onSetOrientationOverride(game, nextOrientation);
    },
    [isLoading, onSetOrientationOverride, overridesReady]
  );

  const orientationActions = useCallback(
    (game) => {
      const orientationIcon =
        game.orientation === 'horizontal' ? (
          <FaArrowsAltH aria-hidden="true" className="button-icon" />
        ) : (
          <FaArrowsAltV aria-hidden="true" className="button-icon" />
        );
      return (
        <>
          <span className="override-pill orientation-pill">{game.orientationLabel}</span>
          <IconButton
            className="override-action-button"
            onClick={() => handleOrientationCycle(game)}
            disabled={!overridesReady || isLoading}
            title={`Switch to ${game.nextOrientation} orientation`}
            icon={orientationIcon}
            srLabel={`Switch to ${game.nextOrientation} orientation`}
          />
          <IconButton
            className="override-action-button"
            onClick={() => onClearOrientationOverride?.(game.id)}
            disabled={!overridesReady || isLoading}
            title="Remove forced orientation"
            icon={<FaTimes aria-hidden="true" className="button-icon" />}
            srLabel="Clear orientation override"
          />
        </>
      );
    },
    [handleOrientationCycle, isLoading, onClearOrientationOverride, overridesReady]
  );

  const dimensionActions = useCallback(
    (game) => (
      <>
        <IconButton
          className="override-action-button"
          onClick={() => (game.isEditing ? onDimensionClose() : onDimensionOpen(game))}
          disabled={!overridesReady || isLoading}
          title={game.isEditing ? 'Close editor' : 'Edit custom dimensions'}
          icon={<FaEdit aria-hidden="true" className="button-icon" />}
          srLabel={game.isEditing ? 'Close editor' : 'Edit custom dimensions'}
        />
        <IconButton
          className="override-action-button"
          onClick={() => {
            onRemoveDimensionOverride?.(game.id);
            if (isDimensionEditing(game.id)) {
              onDimensionClose();
            }
          }}
          disabled={!overridesReady || isLoading}
          title="Remove custom dimensions"
          icon={<FaTimes aria-hidden="true" className="button-icon" />}
          srLabel="Clear custom dimensions"
        />
      </>
    ),
    [
      isDimensionEditing,
      isLoading,
      onDimensionClose,
      onDimensionOpen,
      onRemoveDimensionOverride,
      overridesReady,
    ]
  );

  const dimensionItems = useMemo(
    () =>
      dimensionOverrides.map((game) => ({
        ...game,
        isEditing: isDimensionEditing(game.id),
        dimensions: isDimensionEditing(game.id)
          ? formatEditorDimensions(dimensionEditorState)
          : formatGameDimensions(game),
        extraContent: isDimensionEditing(game.id) ? (
          <DimensionForm
            className="override-dimension-form"
            gridClassName="override-dimension-grid"
            errorClassName="override-dimension-error"
            actionsClassName="override-dimension-actions"
            primaryButtonClassName="override-dimension-primary"
            secondaryButtonClassName="override-dimension-secondary"
            values={dimensionEditorState}
            error={dimensionEditorState.error}
            disabled={!overridesReady || isLoading}
            onChange={onDimensionFieldChange}
            onSubmit={() => onDimensionSave(game)}
            onCancel={onDimensionClose}
          />
        ) : null,
      })),
    [
      dimensionEditorState,
      dimensionOverrides,
      formatEditorDimensions,
      formatGameDimensions,
      isDimensionEditing,
      isLoading,
      onDimensionClose,
      onDimensionFieldChange,
      onDimensionSave,
      overridesReady,
    ]
  );

  if (activePanelCount === 0) {
    return null;
  }

  return (
    <div className={`results-overrides callout-grid callout-count-${activePanelCount}`}>
      {hasExcludedGames && (
        <OverridesSection
          expanded={expandedPanels[PANEL_KEYS.excluded]}
          onToggle={() => togglePanel(PANEL_KEYS.excluded)}
          renderToggleIcon={renderDisclosureIcon}
          icon={<FaTrashAlt className="inline-icon" aria-hidden="true" />}
          title="Manual exclusions"
          count={excludedGames.length}
          description="Excluded games will not be included the next time you organize your collection."
          listClassName={getScrollableListClassName(excludedGames.length)}
        >
          <OverrideList
            items={excludedGames}
            renderActions={(game) => (
              <IconButton
                className="override-action-button"
                onClick={() => onRestoreExcludedGame?.(game.id)}
                disabled={!overridesReady || isLoading}
                title="Remove from excluded list"
                icon={<FaTimes aria-hidden="true" className="button-icon" />}
                srLabel="Remove from excluded list"
              />
            )}
          />
        </OverridesSection>
      )}

      {hasOrientationOverrides && (
        <OverridesSection
          expanded={expandedPanels[PANEL_KEYS.orientation]}
          onToggle={() => togglePanel(PANEL_KEYS.orientation)}
          renderToggleIcon={renderDisclosureIcon}
          icon={<FaArrowsAlt className="inline-icon" aria-hidden="true" />}
          title="Orientation overrides"
          count={orientationItems.length}
          description="These games will ignore rotation settings and be placed exactly as chosen."
          listClassName={getScrollableListClassName(orientationItems.length)}
        >
          <OverrideList items={orientationItems} renderActions={orientationActions} />
        </OverridesSection>
      )}

      {hasDimensionOverrides && (
        <OverridesSection
          expanded={expandedPanels[PANEL_KEYS.dimensions]}
          onToggle={() => togglePanel(PANEL_KEYS.dimensions)}
          renderToggleIcon={renderDisclosureIcon}
          icon={<FaRulerCombined className="inline-icon" aria-hidden="true" />}
          title="Custom dimensions"
          count={dimensionOverrides.length}
          description="Your overrides will be used instead of the dimensions supplied by BoardGameGeek."
          listClassName={getScrollableListClassName(dimensionOverrides.length)}
        >
          <OverrideList items={dimensionItems} showDimensions renderActions={dimensionActions} />
        </OverridesSection>
      )}
    </div>
  );
}


