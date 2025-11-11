import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { FaBug } from 'react-icons/fa';
import Results from './components/Results';
import MissingVersionsWarning from './components/MissingVersionsWarning';
import SearchPanel from './components/SearchPanel/SearchPanel';
import useCollectionRequestHandlers from './hooks/useCollectionRequestHandlers';
import {
  getExcludedGames,
  saveExcludedGame,
  removeExcludedGame,
  getOrientationOverrides,
  saveOrientationOverride,
  removeOrientationOverride,
  getDimensionOverrides,
  saveDimensionOverride,
  removeDimensionOverride,
  getUserSettings,
  saveUserSettings,
  clearUserSettings,
  getLastResult,
  clearLastResult,
} from './services/storage/indexedDb';
import useInputSettingsState from './hooks/useInputSettingsState';
import useResultsState from './hooks/useResultsState';
import useHydrationState from './hooks/useHydrationState';
import { arrayToMap } from './utils/collectionHelpers';
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
import {
  createDimensionOverrideEntry,
  createExcludedOverrideEntry,
  createOrientationOverrideEntry,
} from './utils/overrideIdentity';
import './App.css';

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
    missingVersionWarning,
    setMissingVersionWarning,
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
  const [isMobileLayout, setIsMobileLayout] = useState(() =>
    typeof window === 'undefined' ? false : window.innerWidth < MOBILE_BREAKPOINT
  );
  const previousBodyOverflowRef = useRef(null);

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

  useEffect(() => {
    let isCancelled = false;

    async function hydrateFromStorage() {
      try {
        let foundStoredData = false;

        const [
          storedExcluded,
          storedOrientation,
          storedDimensions,
          storedSettings,
        ] = await Promise.all([
          getExcludedGames(),
          getOrientationOverrides(),
          getDimensionOverrides(),
          getUserSettings(),
        ]);

        if (isCancelled) {
          return;
        }

        setExcludedGamesMap(arrayToMap(storedExcluded));
        setOrientationOverridesMap(arrayToMap(storedOrientation));
        setDimensionOverridesMap(arrayToMap(storedDimensions));

        if (
          (Array.isArray(storedExcluded) && storedExcluded.length > 0) ||
          (Array.isArray(storedOrientation) && storedOrientation.length > 0) ||
          (Array.isArray(storedDimensions) && storedDimensions.length > 0)
        ) {
          foundStoredData = true;
        }

        if (storedSettings && typeof storedSettings === 'object') {
          const {
            username: storedUsername,
            includeExpansions: storedIncludeExpansions,
            groupExpansions: storedGroupExpansions,
            groupSeries: storedGroupSeries,
            stacking: storedStacking,
            lockRotation: storedLockRotation,
            optimizeSpace: storedOptimizeSpace,
            respectSortOrder: storedRespectSortOrder,
            fitOversized: storedFitOversized,
            filtersCollapsed: storedFiltersCollapsed,
            filterPanelsCollapsed: storedFilterPanelsCollapsed,
            bypassVersionWarning: storedBypassVersionWarning,
            sorting: storedSorting,
            collectionFilters: storedCollectionFilters,
          } = storedSettings;

          if (Object.keys(storedSettings).length > 0) {
            foundStoredData = true;
          }

          if (typeof storedUsername === 'string') {
            setUsername(storedUsername);
          }
          if (typeof storedIncludeExpansions === 'boolean') {
            setIncludeExpansions(storedIncludeExpansions);
          }
          if (typeof storedGroupExpansions === 'boolean') {
            setGroupExpansions(storedGroupExpansions);
          }
          if (typeof storedGroupSeries === 'boolean') {
            setGroupSeries(storedGroupSeries);
          }
          if (typeof storedStacking === 'string') {
            const normalizedStacking =
              storedStacking === 'horizontal' ? 'horizontal' : 'vertical';
            setStacking(normalizedStacking);
          }
          if (typeof storedLockRotation === 'boolean') {
            setLockRotation(storedLockRotation);
          }
          if (typeof storedOptimizeSpace === 'boolean') {
            setOptimizeSpace(storedOptimizeSpace);
          }
          if (typeof storedRespectSortOrder === 'boolean') {
            setRespectSortOrder(storedRespectSortOrder);
          }
          if (typeof storedFitOversized === 'boolean') {
            setFitOversized(storedFitOversized);
          }
          if (typeof storedBypassVersionWarning === 'boolean') {
            setBypassVersionWarning(storedBypassVersionWarning);
          }
          if (typeof storedFiltersCollapsed === 'boolean') {
            setFiltersCollapsed(storedFiltersCollapsed);
          }
          if (
            storedFilterPanelsCollapsed &&
            typeof storedFilterPanelsCollapsed === 'object'
          ) {
            setFilterPanelsCollapsed((prev) => ({
              ...prev,
              ...FILTER_PANEL_KEYS.reduce((acc, key) => {
                if (typeof storedFilterPanelsCollapsed[key] === 'boolean') {
                  acc[key] = storedFilterPanelsCollapsed[key];
                }
                return acc;
              }, {}),
            }));
          }
          if (Array.isArray(storedSorting) && storedSorting.length > 0) {
            setSorting(storedSorting);
          }
          if (
            storedCollectionFilters &&
            typeof storedCollectionFilters === 'object'
          ) {
            setCollectionFilters((prev) => ({
              ...prev,
              ...COLLECTION_STATUSES.reduce((acc, status) => {
                const value = storedCollectionFilters[status.key];
                if (value === 'include' || value === 'exclude' || value === 'neutral') {
                  acc[status.key] = value;
                }
                return acc;
              }, {}),
            }));
          }
        }

        setHasStoredData(foundStoredData);
      } catch (storageError) {
        console.error('Unable to load stored preferences', storageError);
      } finally {
        if (!isCancelled) {
          setSettingsHydrated(true);
        }
      }
    }

    hydrateFromStorage();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!settingsHydrated) {
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
    if (!settingsHydrated || lastResultHydrated || cubes !== null) {
      return;
    }

    let isCancelled = false;

    (async () => {
      try {
        const storedResult = await getLastResult();
        if (
          isCancelled ||
          !storedResult ||
          !storedResult.response ||
          !Array.isArray(storedResult.response.cubes) ||
          storedResult.response.cubes.length === 0
        ) {
          return;
        }

        setCubes(storedResult.response.cubes);
        setStats(storedResult.response.stats || null);
        setOversizedGames(storedResult.response.oversizedGames || []);
        setHasStoredData(true);

        if (typeof storedResult.response.fitOversized === 'boolean') {
          setFitOversized(storedResult.response.fitOversized);
        }
        if (typeof storedResult.response.lockRotation === 'boolean') {
          setLockRotation(storedResult.response.lockRotation);
        }
        if (typeof storedResult.response.stacking === 'string') {
          const normalizedStoredStacking =
            storedResult.response.stacking === 'horizontal' ? 'horizontal' : 'vertical';
          setStacking(normalizedStoredStacking);
        }
        if (storedResult.requestConfig) {
          setLastRequestConfig(storedResult.requestConfig);
        }

        setError(null);
        setProgress('');
      } catch (resultError) {
        console.error('Unable to restore last result', resultError);
      } finally {
        if (!isCancelled) {
          setLastResultHydrated(true);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [settingsHydrated, lastResultHydrated, cubes]);

  useEffect(() => {
    if (!isMobileLayout) {
      setIsFilterDrawerOpen(false);
    }
  }, [isMobileLayout]);

  useEffect(() => {
    if (!isMobileLayout || !isFilterDrawerOpen) {
      if (previousBodyOverflowRef.current !== null) {
        document.body.style.overflow = previousBodyOverflowRef.current || '';
        previousBodyOverflowRef.current = null;
      }
      return;
    }

    previousBodyOverflowRef.current = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousBodyOverflowRef.current || '';
      previousBodyOverflowRef.current = null;
    };
  }, [isFilterDrawerOpen, isMobileLayout]);

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
    setMissingVersionWarning,
    setFiltersCollapsed,
    setIsFilterDrawerOpen,
    setStats,
    setLastRequestConfig,
    lastRequestConfig,
  });
  const handleExcludeGame = useCallback(async (game) => {
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
  }, []);

  const handleReincludeGame = useCallback(async (overrideKey) => {
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
  }, []);

  const handleSetOrientationOverride = useCallback(async (game, orientation) => {
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
  }, []);

  const handleClearOrientationOverride = useCallback(async (overrideKey) => {
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
  }, []);

  const handleSaveDimensionOverride = useCallback(async (game, rawDimensions) => {
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
  }, []);

  const handleRemoveDimensionOverride = useCallback(async (overrideKey) => {
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
  }, []);

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

  const hydrationComplete = settingsHydrated && lastResultHydrated;
  const isFirstRun = hydrationComplete && !hasStoredData && cubes === null;
  const shouldShowInlineUsername = isMobileLayout && (!hydrationComplete || isFirstRun);

  useEffect(() => {
    if (initialCollapseAppliedRef.current) {
      return;
    }

    if (!hydrationComplete) {
      return;
    }

    const shouldCollapse =
      !isFirstRun && (hasStoredData || (Array.isArray(cubes) && cubes.length > 0));
    setFiltersCollapsed(shouldCollapse);
    initialCollapseAppliedRef.current = true;
  }, [hydrationComplete, hasStoredData, cubes, isFirstRun]);

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
      <header>
        <div className="header-content">
          <img src="/bgcube_logo.png" alt="BGCUBE.app" className="app-logo" />
          <p className="subtitle">
            Organize your <a href="https://boardgamegeek.com" target="_blank" rel="noopener noreferrer" className="subtitle-link">BoardGameGeek</a> collection into <a href="https://www.ikea.com/us/en/cat/kallax-shelving-units-58285/" target="_blank" rel="noopener noreferrer" className="subtitle-link">IKEA Kallax shelving units</a>
          </p>
          <div className="kofi-widget" aria-live="polite">
            <a
              href="https://ko-fi.com/A0A11G62JT"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src="https://storage.ko-fi.com/cdn/kofi6.png?v=6"
                alt="Buy Me a Coffee at ko-fi.com"
                height="36"
              />
            </a>
          </div>
        </div>
      </header>

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

      {missingVersionWarning && (
        <MissingVersionsWarning
          warning={missingVersionWarning}
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
        />
      )}

      <footer className="disclaimer-footer">
        <div className="footer-banner">
          <div className="banner-item">
            <a href="https://boardgamegeek.com" target="_blank" rel="noopener noreferrer" className="banner-link">
              <img 
                src="/powered_by_bgg.png" 
                alt="Powered by BoardGameGeek" 
                className="banner-logo"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'block';
                }}
              />
              <span className="banner-fallback" style={{ display: 'none' }}>
                Powered by BoardGameGeek
              </span>
            </a>
          </div>
          <div className="banner-item">
            <a href="https://github.com/kriegschrei/bgg-kallax-organizer/issues" target="_blank" rel="noopener noreferrer" className="banner-link">
              <span className="banner-link-content banner-link-content--inverted">
                <FaBug aria-hidden="true" className="banner-link-icon banner-link-icon--inverted" />
                <span className="banner-link-text">Report Issues</span>
              </span>
            </a>
          </div>
        </div>
        <div className="footer-content">
          <div className="footer-section">
            <h4>About</h4>
            <p>
              This tool uses the <a href="https://boardgamegeek.com/using_the_xml_api" target="_blank" rel="noopener noreferrer">BoardGameGeek XML API2</a> to fetch your collection
              and calculates the optimal arrangement to fit your games into <a href="https://www.ikea.com/us/en/cat/kallax-shelving-units-58285/" target="_blank" rel="noopener noreferrer">IKEA Kallax shelving units</a>
              (13" W × 13" H × 15" D).
            </p>
          </div>
          <div className="footer-section">
            <h4>Disclaimer</h4>
            <p>
              BGCube is an independent tool not affiliated with or endorsed by BoardGameGeek or IKEA. 
              BoardGameGeek® is a trademark of BoardGameGeek, LLC. KALLAX® and IKEA® are trademarks of Inter IKEA Systems B.V.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;

