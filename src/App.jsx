import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { FaUndoAlt, FaExclamationTriangle, FaBug } from 'react-icons/fa';
import SortablePriorities from './components/SortablePriorities';
import ToggleSwitch from './components/ToggleSwitch';
import Results from './components/Results';
import MissingVersionsWarning from './components/MissingVersionsWarning';
import { fetchPackedCubes } from './services/bggApi';
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
  saveLastResult,
  clearLastResult,
} from './services/storage/indexedDb';
import './App.css';

const DEFAULT_PRIORITIES = [
  { field: 'name', enabled: true, order: 'asc' },
  { field: 'categories', enabled: false, order: 'asc' },
  { field: 'families', enabled: false, order: 'asc' },
  { field: 'bggRank', enabled: false, order: 'asc' }, // Lower rank # is better
  { field: 'minPlayers', enabled: false, order: 'asc' },
  { field: 'maxPlayers', enabled: false, order: 'asc' },
  { field: 'bestPlayerCount', enabled: false, order: 'asc' },
  { field: 'minPlaytime', enabled: false, order: 'asc' },
  { field: 'maxPlaytime', enabled: false, order: 'asc' },
  { field: 'age', enabled: false, order: 'asc' },
  { field: 'communityAge', enabled: false, order: 'asc' },
  { field: 'weight', enabled: false, order: 'asc' },
  { field: 'bggRating', enabled: false, order: 'desc' }, // Higher rating is better
];

const DEFAULT_ENABLED_PRIORITY_FIELDS = DEFAULT_PRIORITIES
  .filter((priority) => priority.enabled)
  .map((priority) => priority.field);

const DEFAULT_PRIORITIES_BY_FIELD = DEFAULT_PRIORITIES.reduce((accumulator, priority) => {
  accumulator[priority.field] = priority;
  return accumulator;
}, {});

const PRIORITY_LABELS = {
  name: 'Name',
  categories: 'Categories',
  families: 'Families',
  bggRank: 'BGG Rank',
  minPlayers: 'Min Players',
  maxPlayers: 'Max Players',
  bestPlayerCount: 'Best Player Count',
  minPlaytime: 'Min Playtime',
  maxPlaytime: 'Max Playtime',
  age: 'Age',
  communityAge: 'Community Age',
  weight: 'Weight',
  bggRating: 'BGG Rating',
};

const arrayToMap = (items = []) =>
  Array.isArray(items)
    ? items.reduce((acc, item) => {
        if (item?.id) {
          acc[item.id] = { ...item };
        }
        return acc;
      }, {})
    : {};

const parseDimensionValue = (value) => {
  const numeric = typeof value === 'string' ? parseFloat(value) : value;
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
};

function App() {
  const [username, setUsername] = useState('');
  const [includePreordered, setIncludePreordered] = useState(false);
  const [includeExpansions, setIncludeExpansions] = useState(false);
  const [groupExpansions, setGroupExpansions] = useState(false);
  const [groupSeries, setGroupSeries] = useState(false);
  const [verticalStacking, setVerticalStacking] = useState(true);
  const [allowAlternateRotation, setAllowAlternateRotation] = useState(true);
  const [optimizeSpace, setOptimizeSpace] = useState(false);
  const [respectSortOrder, setRespectSortOrder] = useState(false);
  const [fitOversized, setFitOversized] = useState(false);
  const [bypassVersionWarning, setBypassVersionWarning] = useState(false);
  const [priorities, setPriorities] = useState(DEFAULT_PRIORITIES);
  const [excludedGamesMap, setExcludedGamesMap] = useState({});
  const [orientationOverridesMap, setOrientationOverridesMap] = useState({});
  const [dimensionOverridesMap, setDimensionOverridesMap] = useState({});
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState('');
  const [cubes, setCubes] = useState(null);
  const [oversizedGames, setOversizedGames] = useState([]);
  const [missingVersionWarning, setMissingVersionWarning] = useState(null);
  const [lastRequestConfig, setLastRequestConfig] = useState(null);
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const [settingsHydrated, setSettingsHydrated] = useState(false);
  const [lastResultHydrated, setLastResultHydrated] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    async function hydrateFromStorage() {
      try {
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

        if (storedSettings && typeof storedSettings === 'object') {
          const {
            username: storedUsername,
            includePreordered: storedIncludePreordered,
            includeExpansions: storedIncludeExpansions,
            groupExpansions: storedGroupExpansions,
            groupSeries: storedGroupSeries,
            verticalStacking: storedVerticalStacking,
            allowAlternateRotation: storedAllowAlternateRotation,
            optimizeSpace: storedOptimizeSpace,
            respectSortOrder: storedRespectSortOrder,
            fitOversized: storedFitOversized,
            filtersCollapsed: storedFiltersCollapsed,
            bypassVersionWarning: storedBypassVersionWarning,
            priorities: storedPriorities,
          } = storedSettings;

          if (typeof storedUsername === 'string') {
            setUsername(storedUsername);
          }
          if (typeof storedIncludePreordered === 'boolean') {
            setIncludePreordered(storedIncludePreordered);
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
          if (typeof storedVerticalStacking === 'boolean') {
            setVerticalStacking(storedVerticalStacking);
          }
          if (typeof storedAllowAlternateRotation === 'boolean') {
            setAllowAlternateRotation(storedAllowAlternateRotation);
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
          if (Array.isArray(storedPriorities) && storedPriorities.length > 0) {
            setPriorities(storedPriorities);
          }
        }
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
    const widgetId = 'ko-fi-overlay-widget';
    if (typeof window === 'undefined') {
      return;
    }

    if (document.getElementById(widgetId)) {
      window.kofiWidgetOverlay?.draw?.('kriegschrei', {
        type: 'floating-chat',
        'floating-chat.donateButton.text': 'Support me',
        'floating-chat.donateButton.background-color': '#00b9fe',
        'floating-chat.donateButton.text-color': '#fff',
      });
      return;
    }

    const script = document.createElement('script');
    script.id = widgetId;
    script.src = 'https://storage.ko-fi.com/cdn/scripts/overlay-widget.js';
    script.async = true;
    script.onload = () => {
      window.kofiWidgetOverlay?.draw?.('kriegschrei', {
        type: 'floating-chat',
        'floating-chat.donateButton.text': 'Support me',
        'floating-chat.donateButton.background-color': '#00b9fe',
        'floating-chat.donateButton.text-color': '#fff',
      });
    };

    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    if (!settingsHydrated) {
      return;
    }

    const settingsToPersist = {
      username,
      includePreordered,
      includeExpansions,
      groupExpansions,
      groupSeries,
      verticalStacking,
      allowAlternateRotation,
      optimizeSpace,
      respectSortOrder,
      fitOversized,
      filtersCollapsed,
      priorities,
    bypassVersionWarning,
    };

    saveUserSettings(settingsToPersist).catch((persistError) => {
      console.error('Unable to persist user settings', persistError);
    });
  }, [
    settingsHydrated,
    username,
    includePreordered,
    includeExpansions,
    groupExpansions,
    groupSeries,
    verticalStacking,
    allowAlternateRotation,
    optimizeSpace,
    respectSortOrder,
    fitOversized,
    filtersCollapsed,
    priorities,
    bypassVersionWarning,
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
        setOversizedGames(storedResult.response.oversizedGames || []);

        if (typeof storedResult.response.fitOversized === 'boolean') {
          setFitOversized(storedResult.response.fitOversized);
        }
        if (typeof storedResult.response.verticalStacking === 'boolean') {
          setVerticalStacking(storedResult.response.verticalStacking);
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

  const handleExcludeGame = useCallback(async (game) => {
    if (!game?.id) {
      return;
    }

    const entry = {
      id: game.id,
      name: game.name || game.id,
    };

    setExcludedGamesMap((prev) => {
      if (prev[entry.id]) {
        return prev;
      }
      return {
        ...prev,
        [entry.id]: entry,
      };
    });

    try {
      await saveExcludedGame(entry);
    } catch (storageError) {
      console.error('Unable to persist excluded game', storageError);
    }
  }, []);

  const handleReincludeGame = useCallback(async (gameId) => {
    if (!gameId) {
      return;
    }

    setExcludedGamesMap((prev) => {
      if (!prev[gameId]) {
        return prev;
      }
      const next = { ...prev };
      delete next[gameId];
      return next;
    });

    try {
      await removeExcludedGame(gameId);
    } catch (storageError) {
      console.error('Unable to remove excluded game', storageError);
    }
  }, []);

  const handleSetOrientationOverride = useCallback(async (game, orientation) => {
    if (!game?.id || !orientation) {
      return;
    }

    const normalizedOrientation =
      orientation === 'vertical' || orientation === 'horizontal'
        ? orientation
        : null;

    if (!normalizedOrientation) {
      return;
    }

    const entry = {
      id: game.id,
      name: game.name || game.id,
      orientation: normalizedOrientation,
    };

    setOrientationOverridesMap((prev) => ({
      ...prev,
      [entry.id]: entry,
    }));

    try {
      await saveOrientationOverride(entry);
    } catch (storageError) {
      console.error('Unable to persist orientation override', storageError);
    }
  }, []);

  const handleClearOrientationOverride = useCallback(async (gameId) => {
    if (!gameId) {
      return;
    }

    setOrientationOverridesMap((prev) => {
      if (!prev[gameId]) {
        return prev;
      }
      const next = { ...prev };
      delete next[gameId];
      return next;
    });

    try {
      await removeOrientationOverride(gameId);
    } catch (storageError) {
      console.error('Unable to remove orientation override', storageError);
    }
  }, []);

  const handleSaveDimensionOverride = useCallback(async (game, rawDimensions) => {
    if (!game?.id || !rawDimensions) {
      return false;
    }

    const length = parseDimensionValue(rawDimensions.length);
    const width = parseDimensionValue(rawDimensions.width);
    const depth = parseDimensionValue(rawDimensions.depth);

    if (!length || !width || !depth) {
      return false;
    }

    const entry = {
      id: game.id,
      name: game.name || game.id,
      length,
      width,
      depth,
    };

    setDimensionOverridesMap((prev) => ({
      ...prev,
      [entry.id]: entry,
    }));

    try {
      await saveDimensionOverride(entry);
      return true;
    } catch (storageError) {
      console.error('Unable to persist dimension override', storageError);
      return false;
    }
  }, []);

  const handleRemoveDimensionOverride = useCallback(async (gameId) => {
    if (!gameId) {
      return;
    }

    setDimensionOverridesMap((prev) => {
      if (!prev[gameId]) {
        return prev;
      }
      const next = { ...prev };
      delete next[gameId];
      return next;
    });

    try {
      await removeDimensionOverride(gameId);
    } catch (storageError) {
      console.error('Unable to remove dimension override', storageError);
    }
  }, []);

  const handleResetSettings = useCallback(async () => {
    setUsername('');
    setIncludePreordered(false);
    setIncludeExpansions(false);
    setGroupExpansions(false);
    setGroupSeries(false);
    setVerticalStacking(true);
    setAllowAlternateRotation(true);
    setOptimizeSpace(false);
    setRespectSortOrder(false);
    setFitOversized(false);
    setBypassVersionWarning(false);
    setFiltersCollapsed(false);
    setPriorities(DEFAULT_PRIORITIES.map((priority) => ({ ...priority })));
  setCubes(null);
  setOversizedGames([]);
  setMissingVersionWarning(null);
  setLastRequestConfig(null);
  setError(null);
  setProgress('');

    try {
      await clearUserSettings();
    await clearLastResult();
    } catch (storageError) {
      console.error('Unable to clear stored user settings', storageError);
    }
  }, []);

  const handleOptimizeSpaceChange = (checked) => {
    setOptimizeSpace(checked);
    if (checked) {
      // Disable all manual sorting controls when optimize space is enabled
      setPriorities((prev) => prev.map((p) => ({ ...p, enabled: false })));
      setRespectSortOrder(false);
    }
  };

  const activeFilterLabels = useMemo(() => {
    const labels = [];
    const pushLabel = (condition, label) => {
      if (condition) {
        labels.push(label);
      }
    };

    pushLabel(includePreordered, 'Pre-ordered games');
    pushLabel(includeExpansions, 'Include expansions');
    pushLabel(groupExpansions, 'Group expansions');
    pushLabel(groupSeries, 'Group series');
    pushLabel(respectSortOrder, 'Respect priority order');
    pushLabel(optimizeSpace, 'Optimize for space');
    pushLabel(fitOversized, 'Fit oversized games');
    pushLabel(bypassVersionWarning, 'Bypass version warning');
    pushLabel(!verticalStacking, 'Horizontal stacking');
    pushLabel(!allowAlternateRotation, 'Lock rotation');

    priorities.forEach((priority) => {
      const defaultConfig = DEFAULT_PRIORITIES_BY_FIELD[priority.field];
      const baseLabel = PRIORITY_LABELS[priority.field] || priority.field;
      const orderLabel = priority.order === 'desc' ? ' (desc)' : '';

      if (!defaultConfig) {
        if (priority.enabled) {
          labels.push(`Priority: ${baseLabel}${orderLabel}`);
        }
        return;
      }

      if (!defaultConfig.enabled && priority.enabled) {
        labels.push(`Priority: ${baseLabel}${orderLabel}`);
      }

      if (defaultConfig.enabled && !priority.enabled) {
        labels.push(`Priority disabled: ${baseLabel}`);
      }

      if (
        priority.enabled &&
        defaultConfig.enabled &&
        priority.order !== defaultConfig.order
      ) {
        labels.push(`Priority order: ${baseLabel}${orderLabel}`);
      }
    });

    return labels;
  }, [
    allowAlternateRotation,
    fitOversized,
    bypassVersionWarning,
    groupExpansions,
    groupSeries,
    includeExpansions,
    includePreordered,
    optimizeSpace,
    priorities,
    respectSortOrder,
    verticalStacking,
  ]);

  const activeFilterCount = activeFilterLabels.length;

  const toggleFiltersCollapsed = () => {
    if (loading) {
      return;
    }
    setFiltersCollapsed((prev) => !prev);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!username.trim()) {
      setError('Please enter a BoardGameGeek username');
      return;
    }

    setLoading(true);
    setError(null);
    setCubes(null);
    setOversizedGames([]);
    setProgress('Fetching your collection from BoardGameGeek...');
    setMissingVersionWarning(null);
    setFiltersCollapsed(true);

    try {
      const trimmedUsername = username.trim();
      const effectiveGroupExpansions = groupExpansions && !optimizeSpace;
      const effectiveGroupSeries = groupSeries && !optimizeSpace;
      const overridesPayload = {
        excludedGames: excludedGamesList.map((game) => ({ ...game })),
        orientationOverrides: orientationOverridesList.map((entry) => ({ ...entry })),
        dimensionOverrides: dimensionOverridesList.map((entry) => ({ ...entry })),
      };

      const requestConfig = {
        username: trimmedUsername,
        includePreordered,
        includeExpansions,
        priorities,
        verticalStacking,
        allowAlternateRotation,
        optimizeSpace,
        respectSortOrder,
        fitOversized,
        groupExpansions: effectiveGroupExpansions,
        groupSeries: effectiveGroupSeries,
        bypassVersionWarning,
        skipVersionCheck: bypassVersionWarning,
        overrides: overridesPayload,
      };

      setLastRequestConfig(requestConfig);

      // Get fully processed and packed cubes from server with progress updates
      const response = await fetchPackedCubes(
        trimmedUsername,
        includePreordered,
        includeExpansions,
        priorities,
        verticalStacking,
        allowAlternateRotation,
        optimizeSpace,
        respectSortOrder,
        fitOversized,
        effectiveGroupExpansions,
        effectiveGroupSeries,
        (progress) => {
          // Update progress message from SSE updates
          if (progress && progress.message) {
            setProgress(progress.message);
          }
        },
        {
          overrides: overridesPayload,
          skipVersionCheck: bypassVersionWarning,
          bypassVersionWarning,
        }
      );
      
      if (response?.status === 'missing_versions') {
        setLoading(false);
        setProgress('');
        setMissingVersionWarning({ ...response, username: trimmedUsername });
        return;
      }
      
      if (!response || !response.cubes || response.cubes.length === 0) {
        setError('No owned games found for this user');
        setLoading(false);
        return;
      }

      setProgress('Rendering results...');

      setCubes(response.cubes);
      setOversizedGames(response.oversizedGames || []);
      setProgress('');
      setLoading(false);

      saveLastResult({
        requestConfig,
        response: {
          cubes: response.cubes,
          oversizedGames: response.oversizedGames || [],
          fitOversized,
          verticalStacking,
        },
      }).catch((storageError) => {
        console.error('Unable to persist last result', storageError);
      });

    } catch (err) {
      console.error('Error:', err);
      setError(err.message || 'An error occurred while fetching data from BoardGameGeek. Please try again.');
      setLoading(false);
      setProgress('');
    }
  };

  const handleWarningCancel = () => {
    setMissingVersionWarning(null);
    setProgress('');
    setError('Processing cancelled. Please select versions for the highlighted games on BoardGameGeek and try again.');
  };

  const handleWarningContinue = async () => {
    if (!lastRequestConfig) {
      return;
    }

    setLoading(true);
    setError(null);
    setProgress('Attempting fallback dimension lookup. This may take a little while...');
    setMissingVersionWarning(null);
    setOversizedGames([]);
    setFiltersCollapsed(true);

    try {
      const effectiveBypassVersionWarning =
        lastRequestConfig?.bypassVersionWarning ?? bypassVersionWarning;
      const overridesPayload = lastRequestConfig.overrides
        ? {
            excludedGames: (lastRequestConfig.overrides.excludedGames || []).map((item) => ({
              ...item,
            })),
            orientationOverrides: (lastRequestConfig.overrides.orientationOverrides || []).map(
              (item) => ({ ...item })
            ),
            dimensionOverrides: (lastRequestConfig.overrides.dimensionOverrides || []).map(
              (item) => ({ ...item })
            ),
          }
        : {
            excludedGames: excludedGamesList.map((item) => ({ ...item })),
            orientationOverrides: orientationOverridesList.map((item) => ({ ...item })),
            dimensionOverrides: dimensionOverridesList.map((item) => ({ ...item })),
          };

      const response = await fetchPackedCubes(
        lastRequestConfig.username,
        lastRequestConfig.includePreordered,
        lastRequestConfig.includeExpansions,
        lastRequestConfig.priorities,
        lastRequestConfig.verticalStacking,
        lastRequestConfig.allowAlternateRotation,
        lastRequestConfig.optimizeSpace,
        lastRequestConfig.respectSortOrder,
        lastRequestConfig.fitOversized,
        lastRequestConfig.groupExpansions,
        lastRequestConfig.groupSeries,
        (progress) => {
          if (progress && progress.message) {
            setProgress(progress.message);
          }
        },
        {
          skipVersionCheck: true,
          overrides: overridesPayload,
          bypassVersionWarning: effectiveBypassVersionWarning,
        }
      );

      if (!response || !response.cubes || response.cubes.length === 0) {
        setError('No owned games found for this user');
        setLoading(false);
        return;
      }

      setProgress('Rendering results...');
      setCubes(response.cubes);
      setOversizedGames(response.oversizedGames || []);
      setProgress('');
      setLoading(false);

      saveLastResult({
        requestConfig: lastRequestConfig,
        response: {
          cubes: response.cubes,
          oversizedGames: response.oversizedGames || [],
          fitOversized: lastRequestConfig.fitOversized,
          verticalStacking: lastRequestConfig.verticalStacking,
        },
      }).catch((storageError) => {
        console.error('Unable to persist last result', storageError);
      });
    } catch (err) {
      console.error('Error:', err);
      setError(err.message || 'An error occurred while fetching data from BoardGameGeek. Please try again.');
      setLoading(false);
      setProgress('');
    }
  };

  return (
    <div className="app">
      <header>
        <div className="header-content">
          <img src="/bgcube_logo.png" alt="BGCUBE.app" className="app-logo" />
          <p className="subtitle">
            Organize your <a href="https://boardgamegeek.com" target="_blank" rel="noopener noreferrer" className="subtitle-link">BoardGameGeek</a> collection into <a href="https://www.ikea.com/us/en/cat/kallax-shelving-units-58285/" target="_blank" rel="noopener noreferrer" className="subtitle-link">IKEA Kallax shelving units</a>
          </p>
        </div>
      </header>

      {error && (
        <div className="error">
          <strong>Error:</strong> {error}
        </div>
      )}

      <section className={`card search-panel ${filtersCollapsed ? 'collapsed' : ''}`}>
        <div className="search-panel-header">
          <button
            type="button"
            className="search-panel-toggle"
            onClick={toggleFiltersCollapsed}
            aria-expanded={!filtersCollapsed}
            aria-controls="search-panel-content"
            disabled={loading}
            title={filtersCollapsed ? 'Show search options' : 'Hide search options'}
          >
            <div className="search-panel-title-row">
              <span className="search-panel-title">Search Options</span>
              <div className="search-panel-controls">
                {activeFilterCount > 0 && (
                  <span className="search-panel-badge" aria-label={`${activeFilterCount} active filters`}>
                    {activeFilterCount}
                  </span>
                )}
                <span className="search-panel-icon" aria-hidden>
                  ▾
                </span>
              </div>
            </div>
            {filtersCollapsed && activeFilterCount > 0 && (
              <div className="search-panel-tags" aria-label="Active filters">
                {activeFilterLabels.map((label) => (
                  <span key={label} className="search-panel-tag">
                    {label}
                  </span>
                ))}
              </div>
            )}
          </button>
        </div>
        <div className="search-panel-body" id="search-panel-content">
          <form onSubmit={handleSubmit} className="search-panel-form">
            <div className="form-layout">
              <div className="form-left">
                <div className="form-group">
                  <label htmlFor="username">BoardGameGeek Username</label>
                  <input
                    type="text"
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your BGG username"
                    disabled={loading}
                  />
                </div>

                <div className="toggle-list">
                  <ToggleSwitch
                    id="includePreordered"
                    label="Include Pre-ordered Games"
                    checked={includePreordered}
                    onChange={setIncludePreordered}
                    disabled={loading}
                  />

                  <ToggleSwitch
                    id="respectSortOrder"
                    label="Respect ordering priority"
                    checked={respectSortOrder}
                    onChange={setRespectSortOrder}
                    disabled={loading || optimizeSpace}
                    tooltip="Games will not be backfilled to earlier cubes for better fit, may use more space"
                  />

                  <ToggleSwitch
                    id="includeExpansions"
                    label="Include expansions"
                    checked={includeExpansions}
                    onChange={(next) => {
                      setIncludeExpansions(next);
                      if (!next) {
                        setGroupExpansions(false); // Disable grouping when expansions are disabled
                      }
                    }}
                    disabled={loading}
                  />

                  <ToggleSwitch
                    id="groupExpansions"
                    label="Group expansions with base game"
                    checked={groupExpansions}
                    onChange={setGroupExpansions}
                    disabled={loading || !includeExpansions || optimizeSpace}
                    tooltip="Keep expansions with their base game in the same cube when possible"
                  />

                  <ToggleSwitch
                    id="groupSeries"
                    label="Group series"
                    checked={groupSeries}
                    onChange={setGroupSeries}
                    disabled={loading || optimizeSpace}
                    tooltip="Keep games from the same series/family together in the same cube when possible"
                  />

                  <ToggleSwitch
                    id="fitOversized"
                    label="Fit oversized games"
                    checked={fitOversized}
                    onChange={setFitOversized}
                    disabled={loading}
                    tooltip="Force games up to 13 inches deep into the cube and optionally stuff even larger boxes at 12.8 inches."
                  />

                  <ToggleSwitch
                    id="bypassVersionWarning"
                    label="Bypass version warning"
                    checked={bypassVersionWarning}
                    onChange={setBypassVersionWarning}
                    disabled={loading}
                    tooltip="You will not be warned about missing versions. This may result in incorrect data and longer processing times."
                    tooltipIcon={FaExclamationTriangle}
                    tooltipIconClassName="warning-icon"
                  />

                  <ToggleSwitch
                    id="allowAlternateRotation"
                    label="Allow alternate rotation"
                    checked={allowAlternateRotation}
                    onChange={setAllowAlternateRotation}
                    disabled={loading}
                    tooltip="Prefer vertical or horizontal, but may rotate games for better fit"
                  />

                  <ToggleSwitch
                    id="optimizeSpace"
                    label="Optimize for space"
                    checked={optimizeSpace}
                    onChange={handleOptimizeSpaceChange}
                    disabled={loading}
                    tooltip="Ignore all sorting priorities, allow rotation, and pack games in as few cubes as possible"
                  />
                </div>

                <div className="form-group">
                  <label>Stacking Preference</label>
                  <div className="toggle-button-group">
                    <button
                      type="button"
                      className={`toggle-button ${!verticalStacking ? 'active' : ''}`}
                      onClick={() => setVerticalStacking(false)}
                      disabled={loading}
                    >
                      Horizontal
                    </button>
                    <button
                      type="button"
                      className={`toggle-button ${verticalStacking ? 'active' : ''}`}
                      onClick={() => setVerticalStacking(true)}
                      disabled={loading}
                    >
                      Vertical
                    </button>
                  </div>
                </div>

                <div className="form-actions">
                  <button type="submit" disabled={loading}>
                    {loading ? 'Processing...' : 'Organize Collection'}
                  </button>
                  <button
                    type="button"
                    className="reset-settings-button"
                    onClick={handleResetSettings}
                    disabled={loading}
                    title="Restore all search options to their default values"
                  >
                    <FaUndoAlt aria-hidden="true" className="button-icon" />
                    <span>Reset settings</span>
                  </button>
                </div>
              </div>

              <div className="form-right">
                <SortablePriorities 
                  priorities={priorities} 
                  onChange={setPriorities}
                  disabled={optimizeSpace}
                />
              </div>
            </div>
          </form>
        </div>
      </section>

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
          verticalStacking={verticalStacking}
          oversizedGames={oversizedGames}
          fitOversized={fitOversized}
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

