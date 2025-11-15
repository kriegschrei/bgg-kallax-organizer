import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Results from './components/Results';
import NoSelectedVersionWarning from './components/noSelectedVersionWarning';
import SearchPanel from './components/SearchPanel/SearchPanel';
import AppHeader from './components/AppHeader';
import AppFooter from './components/AppFooter';
import useCollectionRequestHandlers from './hooks/useCollectionRequestHandlers';
import { saveUserSettings, clearUserSettings, clearLastResult } from './services/storage/indexedDb';
import useInputSettingsState from './hooks/useInputSettingsState';
import useResultsState from './hooks/useResultsState';
import useHydrationState from './hooks/useHydrationState';
import { useSettingsHydration } from './hooks/useSettingsHydration';
import { useOverrideHandlers } from './hooks/useOverrideHandlers';
import { useBodyOverflow } from './hooks/useBodyOverflow';
import { getCollapsedBadgeLimit } from './utils/layout';
import {
  COLLECTION_STATUSES,
  FILTER_PANEL_KEYS,
  MOBILE_BREAKPOINT,
} from './constants/appDefaults';
import {
  deriveStatusSelections,
  hasIncludeSelection,
} from './utils/requestPayload';
import './App.css';

/**
 * Main application component.
 * Manages application state, hydration, and renders the main UI structure.
 */
function App() {
  const formRef = useRef(null);
  const {
    username,
    setUsername,
    includeExpansions,
    setIncludeExpansions,
    groupExpansions,
    setGroupExpansions,
    groupSeries,
    setGroupSeries,
    stacking,
    setStacking,
    lockRotation,
    setLockRotation,
    optimizeSpace,
    setOptimizeSpace,
    respectSortOrder,
    setRespectSortOrder,
    fitOversized,
    setFitOversized,
    bypassVersionWarning,
    setBypassVersionWarning,
    filtersCollapsed,
    setFiltersCollapsed,
    sorting,
    setSorting,
    collectionFilters,
    setCollectionFilters,
    filterPanelsCollapsed,
    setFilterPanelsCollapsed,
    isFilterDrawerOpen,
    setIsFilterDrawerOpen,
    resetInputSettings,
  } = useInputSettingsState();
  const [excludedGamesMap, setExcludedGamesMap] = useState({});
  const [orientationOverridesMap, setOrientationOverridesMap] = useState({});
  const [dimensionOverridesMap, setDimensionOverridesMap] = useState({});
  
  const [loading, setLoading] = useState(false);
  const {
    cubes,
    setCubes,
    stats,
    setStats,
    oversizedGames,
    setOversizedGames,
    noSelectedVersionWarning,
    setnoSelectedVersionWarning,
    lastRequestConfig,
    setLastRequestConfig,
    error,
    setError,
    progress,
    setProgress,
    resetResults,
  } = useResultsState();
  const {
    settingsHydrated,
    setSettingsHydrated,
    lastResultHydrated,
    setLastResultHydrated,
    hasStoredData,
    setHasStoredData,
    resetHydration,
  } = useHydrationState();
  const [collapsedBadgeLimit, setCollapsedBadgeLimit] = useState(() =>
    typeof window === 'undefined' ? 4 : getCollapsedBadgeLimit(window.innerWidth)
  );
  const initialCollapseAppliedRef = useRef(false);
  const filtersCollapsedFromStorageRef = useRef(false);
  const [isMobileLayout, setIsMobileLayout] = useState(() =>
    typeof window === 'undefined' ? false : window.innerWidth < MOBILE_BREAKPOINT
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleResize = () => {
      const width = window.innerWidth;
      setCollapsedBadgeLimit(getCollapsedBadgeLimit(width));
      setIsMobileLayout(width < MOBILE_BREAKPOINT);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Memoize setters object to prevent hydration effect from re-running
  const setters = useMemo(
    () => ({
      setUsername,
      setIncludeExpansions,
      setGroupExpansions,
      setGroupSeries,
      setStacking,
      setLockRotation,
      setOptimizeSpace,
      setRespectSortOrder,
      setFitOversized,
      setBypassVersionWarning,
      setFiltersCollapsed,
      setFilterPanelsCollapsed,
      setSorting,
      setCollectionFilters,
    }),
    [
      setUsername,
      setIncludeExpansions,
      setGroupExpansions,
      setGroupSeries,
      setStacking,
      setLockRotation,
      setOptimizeSpace,
      setRespectSortOrder,
      setFitOversized,
      setBypassVersionWarning,
      setFiltersCollapsed,
      setFilterPanelsCollapsed,
      setSorting,
      setCollectionFilters,
    ]
  );

  // Hydrate settings and last result from storage
  useSettingsHydration({
    setExcludedGamesMap,
    setOrientationOverridesMap,
    setDimensionOverridesMap,
    setHasStoredData,
    setSettingsHydrated,
    setLastResultHydrated,
    settingsHydrated,
    lastResultHydrated,
    cubes,
    setters,
    setCubes,
    setStats,
    setOversizedGames,
    setFitOversized,
    setLockRotation,
    setStacking,
    setLastRequestConfig,
    setError,
    setProgress,
    filtersCollapsedFromStorageRef,
  });

  const hydrationComplete = settingsHydrated && lastResultHydrated;

  useEffect(() => {
    if (!settingsHydrated) {
      return;
    }

    // Don't persist during initial hydration - wait for hydration to complete
    // This prevents a feedback loop where hydration sets values, persistence saves them,
    // and then hydration reads them again
    if (!hydrationComplete) {
      return;
    }

    const settingsToPersist = {
      username,
      includeExpansions,
      groupExpansions,
      groupSeries,
      stacking,
      lockRotation,
      optimizeSpace,
      respectSortOrder,
      fitOversized,
      filtersCollapsed,
      sorting,
      bypassVersionWarning,
      collectionFilters,
      filterPanelsCollapsed,
    };

    saveUserSettings(settingsToPersist).catch((persistError) => {
      console.error('Unable to persist user settings', persistError);
    });
  }, [
    settingsHydrated,
    hydrationComplete,
    username,
    includeExpansions,
    groupExpansions,
    groupSeries,
    stacking,
    lockRotation,
    optimizeSpace,
    respectSortOrder,
    fitOversized,
    filtersCollapsed,
    sorting,
    bypassVersionWarning,
    collectionFilters,
    filterPanelsCollapsed,
  ]);


  useEffect(() => {
    if (!isMobileLayout) {
      setIsFilterDrawerOpen(false);
    }
  }, [isMobileLayout, setIsFilterDrawerOpen]);

  // Manage body overflow when filter drawer is open
  useBodyOverflow(isFilterDrawerOpen, isMobileLayout);

  const excludedGamesList = useMemo(
    () => Object.values(excludedGamesMap),
    [excludedGamesMap]
  );
  const orientationOverridesList = useMemo(
    () => Object.values(orientationOverridesMap),
    [orientationOverridesMap]
  );
  const dimensionOverridesList = useMemo(
    () => Object.values(dimensionOverridesMap),
    [dimensionOverridesMap]
  );
  const statusSelections = useMemo(
    () => deriveStatusSelections(collectionFilters),
    [collectionFilters]
  );
  const includeStatusList = useMemo(
    () =>
      Object.entries(statusSelections)
        .filter(([, value]) => value === 'include')
        .map(([key]) => key),
    [statusSelections]
  );
  const excludeStatusList = useMemo(
    () =>
      Object.entries(statusSelections)
        .filter(([, value]) => value === 'exclude')
        .map(([key]) => key),
    [statusSelections]
  );
  const hasIncludeStatuses = hasIncludeSelection(statusSelections);

  const {
    handleSubmit,
    handleWarningCancel,
    handleWarningContinue,
  } = useCollectionRequestHandlers({
    username,
    hasIncludeStatuses,
    statusSelections,
    includeExpansions,
    sorting,
    stacking,
    lockRotation,
    optimizeSpace,
    respectSortOrder,
    fitOversized,
    groupExpansions,
    groupSeries,
    bypassVersionWarning,
    excludedGamesList,
    orientationOverridesList,
    dimensionOverridesList,
    setError,
    setLoading,
    setCubes,
    setOversizedGames,
    setProgress,
    setnoSelectedVersionWarning,
    setFiltersCollapsed,
    setIsFilterDrawerOpen,
    setStats,
    setLastRequestConfig,
    lastRequestConfig,
  });

  // Override handlers
  const {
    handleExcludeGame,
    handleReincludeGame,
    handleSetOrientationOverride,
    handleClearOrientationOverride,
    handleSaveDimensionOverride,
    handleRemoveDimensionOverride,
  } = useOverrideHandlers({
    setExcludedGamesMap,
    setOrientationOverridesMap,
    setDimensionOverridesMap,
  });

  const handleCollectionFilterChange = useCallback((statusKey, nextState) => {
    if (!COLLECTION_STATUSES.some((status) => status.key === statusKey)) {
      return;
    }
    if (!['include', 'exclude', 'neutral'].includes(nextState)) {
      return;
    }
    setCollectionFilters((prev) => {
      if (prev[statusKey] === nextState) {
        return prev;
      }
      return {
        ...prev,
        [statusKey]: nextState,
      };
    });
  }, []);

  const toggleFilterPanel = useCallback((panelKey) => {
    if (!FILTER_PANEL_KEYS.includes(panelKey)) {
      return;
    }
    setFilterPanelsCollapsed((prev) => ({
      ...prev,
      [panelKey]: !prev[panelKey],
    }));
  }, []);

  const handleResetSettings = useCallback(async () => {
    resetInputSettings();
    resetResults();
    resetHydration();

    try {
      await clearUserSettings();
      await clearLastResult();
    } catch (storageError) {
      console.error('Unable to clear stored user settings', storageError);
    }
  }, [resetHydration, resetInputSettings, resetResults]);

  const handleOptimizeSpaceChange = useCallback(
    (checked) => {
      setOptimizeSpace(checked);
      if (checked) {
        setRespectSortOrder(false);
      }
    },
    [setOptimizeSpace, setRespectSortOrder]
  );

  const handleIncludeExpansionsChange = useCallback(
    (next) => {
      setIncludeExpansions(next);
      if (!next) {
        setGroupExpansions(false);
      }
    },
    [setGroupExpansions, setIncludeExpansions]
  );

  const preferenceState = useMemo(
    () => ({
      optimizeSpace,
      onOptimizeSpaceChange: handleOptimizeSpaceChange,
      includeExpansions,
      onIncludeExpansionsChange: handleIncludeExpansionsChange,
      groupExpansions,
      onGroupExpansionsChange: setGroupExpansions,
      groupSeries,
      onGroupSeriesChange: setGroupSeries,
      fitOversized,
      onFitOversizedChange: setFitOversized,
      lockRotation,
      onLockRotationChange: setLockRotation,
      respectSortOrder,
      onRespectSortOrderChange: setRespectSortOrder,
      bypassVersionWarning,
      onBypassVersionWarningChange: setBypassVersionWarning,
    }),
    [
      optimizeSpace,
      handleOptimizeSpaceChange,
      includeExpansions,
      handleIncludeExpansionsChange,
      groupExpansions,
      setGroupExpansions,
      groupSeries,
      setGroupSeries,
      fitOversized,
      setFitOversized,
      lockRotation,
      setLockRotation,
      respectSortOrder,
      setRespectSortOrder,
      bypassVersionWarning,
      setBypassVersionWarning,
    ]
  );

  const isFirstRun = hydrationComplete && !hasStoredData && cubes === null;
  const shouldShowInlineUsername = isMobileLayout && (!hydrationComplete || isFirstRun);

  useEffect(() => {
    if (initialCollapseAppliedRef.current) {
      return;
    }

    if (!hydrationComplete) {
      return;
    }

    // If filtersCollapsed was set from storage, respect that preference and don't override it
    if (filtersCollapsedFromStorageRef.current) {
      initialCollapseAppliedRef.current = true;
      return;
    }

    // Only apply initial collapse logic for non-first-run scenarios when there are cubes
    // This only runs when there's no stored filtersCollapsed preference
    if (!isFirstRun && Array.isArray(cubes) && cubes.length > 0) {
      setFiltersCollapsed(true);
    }
    
    initialCollapseAppliedRef.current = true;
    // Only run once when hydration completes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrationComplete]);

  const handleToggleFiltersCollapsed = useCallback(() => {
    if (loading) {
      return;
    }

    if (isMobileLayout) {
      setIsFilterDrawerOpen((prev) => !prev);
      return;
    }

    setFiltersCollapsed((prev) => !prev);
  }, [isMobileLayout, loading]);

  const handleCloseFilterDrawer = useCallback(() => {
    setIsFilterDrawerOpen(false);
  }, []);

  return (
    <div className="app">
      <AppHeader hasResults={!!cubes && cubes.length > 0} />

      {error && (
        <div className="error">
          <strong>Error:</strong> {error}
        </div>
      )}

      <SearchPanel
        formRef={formRef}
        loading={loading}
        onSubmit={handleSubmit}
        username={username}
        onUsernameChange={setUsername}
        onResetSettings={handleResetSettings}
        hasIncludeStatuses={hasIncludeStatuses}
        filterPanelsCollapsed={filterPanelsCollapsed}
        onTogglePanel={toggleFilterPanel}
        stacking={stacking}
        onStackingChange={setStacking}
        preferenceState={preferenceState}
        collectionFilters={collectionFilters}
        onCollectionFilterChange={handleCollectionFilterChange}
        includeStatusList={includeStatusList}
        excludeStatusList={excludeStatusList}
        sorting={sorting}
        onSortingChange={setSorting}
        optimizeSpace={optimizeSpace}
        filtersCollapsed={filtersCollapsed}
        onToggleFiltersCollapsed={handleToggleFiltersCollapsed}
        isFilterDrawerOpen={isFilterDrawerOpen}
        onRequestCloseDrawer={handleCloseFilterDrawer}
        isMobileLayout={isMobileLayout}
        collapsedBadgeLimit={collapsedBadgeLimit}
        includeExpansions={includeExpansions}
        groupExpansions={groupExpansions}
        groupSeries={groupSeries}
        respectSortOrder={respectSortOrder}
        fitOversized={fitOversized}
        bypassVersionWarning={bypassVersionWarning}
        lockRotation={lockRotation}
        shouldShowInlineUsername={shouldShowInlineUsername}
      />

      {loading && (
        <div className="loading">
          <div className="spinner"></div>
          <p>{progress}</p>
        </div>
      )}

      {noSelectedVersionWarning && (
        <NoSelectedVersionWarning
          warning={noSelectedVersionWarning}
          onContinue={handleWarningContinue}
          onCancel={handleWarningCancel}
          isProcessing={loading}
        />
      )}

      {cubes && (
        <Results
          cubes={cubes}
          stats={stats}
          oversizedGames={oversizedGames}
          fitOversized={fitOversized}
          sorting={sorting}
          excludedGames={excludedGamesList}
          onExcludeGame={handleExcludeGame}
          onRestoreExcludedGame={handleReincludeGame}
          orientationOverrides={orientationOverridesList}
          onSetOrientationOverride={handleSetOrientationOverride}
          onClearOrientationOverride={handleClearOrientationOverride}
          dimensionOverrides={dimensionOverridesList}
          onSaveDimensionOverride={handleSaveDimensionOverride}
          onRemoveDimensionOverride={handleRemoveDimensionOverride}
          overridesReady={settingsHydrated}
          isLoading={loading}
          stacking={stacking}
          optimizeSpace={optimizeSpace}
          includeExpansions={includeExpansions}
          groupExpansions={groupExpansions}
          groupSeries={groupSeries}
          respectSortOrder={respectSortOrder}
          bypassVersionWarning={bypassVersionWarning}
          lockRotation={lockRotation}
          collectionFilters={collectionFilters}
        />
      )}

      <AppFooter />
    </div>
  );
}

export default App;

