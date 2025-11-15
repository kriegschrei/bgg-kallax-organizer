import React, { useMemo, useCallback } from 'react';
import CubeVisualization from './CubeVisualization';
import ResultsStats from './ResultsStats';
import ResultsOverrides from './ResultsOverrides';
import ResultsWarningPanels from './ResultsWarningPanels';
import DisclosureIcon from './DisclosureIcon';
import {
  formatGameDimensions,
  getScrollableListClassName,
  formatStatValue,
  createStatItem,
} from '../utils/results';
import { formatEditorDimensions } from '../utils/dimensions';
import { collectWarningGroups } from '../utils/resultsWarnings';
import { useOverrideData } from '../hooks/useOverrideData';
import { useDimensionOverrideEditor } from '../hooks/useDimensionOverrideEditor';
import './Results.css';

export default function Results({
  cubes,
  stats,
  oversizedGames = [],
  fitOversized = false,
  excludedGames = [],
  onExcludeGame,
  onRestoreExcludedGame,
  orientationOverrides = [],
  onSetOrientationOverride,
  onClearOrientationOverride,
  dimensionOverrides = [],
  onSaveDimensionOverride,
  onRemoveDimensionOverride,
  overridesReady = true,
  isLoading = false,
  sorting = [],
}) {
  const statsSummaryItems = useMemo(
    () => [
      createStatItem('Total Games', stats?.totalGames, 'Unknown'),
      createStatItem('Kallax Cubes Needed', stats?.totalCubes, 'Unknown'),
      createStatItem('Avg Games/Cube', stats?.avgGamesPerCube, 'N/A'),
      createStatItem('Avg Space Utilization', stats?.totalUtilization, 'N/A', '%'),
    ],
    [stats?.avgGamesPerCube, stats?.totalUtilization, stats?.totalCubes, stats?.totalGames]
  );
  const renderDisclosureIcon = useCallback((expanded) => <DisclosureIcon expanded={expanded} />, []);

  const {
    excludedLookup,
    orientationLookup,
    dimensionLookup,
    sortedExcludedGames,
    orientationOverrideItems,
    sortedDimensionOverrides,
  } = useOverrideData({
    excludedGames,
    orientationOverrides,
    dimensionOverrides,
  });
  const warningGroups = useMemo(
    () => collectWarningGroups({ cubes, oversizedGames }),
    [cubes, oversizedGames]
  );
  const {
    editorState: panelDimensionEditor,
    openEditor: openPanelDimensionEditor,
    closeEditor: closePanelDimensionEditor,
    handleFieldChange: handlePanelDimensionFieldChange,
    handleSave: handlePanelDimensionSave,
    isEditingGame: isPanelDimensionEditing,
  } = useDimensionOverrideEditor({
    overridesReady,
    isLoading,
    onSaveDimensionOverride,
  });

  return (
    <div className="results">
 
      <ResultsStats items={statsSummaryItems} />

      <ResultsOverrides
        excludedGames={sortedExcludedGames}
        orientationItems={orientationOverrideItems}
        dimensionOverrides={sortedDimensionOverrides}
        overridesReady={overridesReady}
        isLoading={isLoading}
        renderDisclosureIcon={renderDisclosureIcon}
        onRestoreExcludedGame={onRestoreExcludedGame}
        onSetOrientationOverride={onSetOrientationOverride}
        onClearOrientationOverride={onClearOrientationOverride}
        onRemoveDimensionOverride={onRemoveDimensionOverride}
        onDimensionFieldChange={handlePanelDimensionFieldChange}
        onDimensionSave={handlePanelDimensionSave}
        onDimensionOpen={openPanelDimensionEditor}
        onDimensionClose={closePanelDimensionEditor}
        isDimensionEditing={isPanelDimensionEditing}
        dimensionEditorState={panelDimensionEditor}
        getScrollableListClassName={getScrollableListClassName}
        formatGameDimensions={formatGameDimensions}
        formatEditorDimensions={formatEditorDimensions}
      />

      <ResultsWarningPanels
        warningGroups={warningGroups}
        fitOversized={fitOversized}
        renderDisclosureIcon={renderDisclosureIcon}
      />

      <div className="cubes-container">
        {cubes.map((cube) => (
          <CubeVisualization
            key={cube.id}
            cube={cube}
            sorting={sorting}
            excludedLookup={excludedLookup}
            orientationLookup={orientationLookup}
            dimensionLookup={dimensionLookup}
            onExcludeGame={onExcludeGame}
            onSetOrientationOverride={onSetOrientationOverride}
            onClearOrientationOverride={onClearOrientationOverride}
            onSaveDimensionOverride={onSaveDimensionOverride}
            onRemoveDimensionOverride={onRemoveDimensionOverride}
            overridesReady={overridesReady}
            isLoading={isLoading}
          />
        ))}
      </div>
    </div>
  );
}

