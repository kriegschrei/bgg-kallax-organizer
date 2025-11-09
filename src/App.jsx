import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  FaUndoAlt,
  FaExclamationTriangle,
  FaBug,
  FaArrowUp,
  FaArrowDown,
  FaChevronRight,
  FaChevronDown,
} from 'react-icons/fa';
import SortablePriorities from './components/SortablePriorities';
import ToggleSwitch from './components/ToggleSwitch';
import CollectionStatusToggle from './components/CollectionStatusToggle';
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

const COLLECTION_STATUSES = [
  { key: 'own', label: 'Own' },
  { key: 'preordered', label: 'Pre-Ordered' },
  { key: 'wanttoplay', label: 'Want To Play' },
  { key: 'prevowned', label: 'Previously Owned' },
  { key: 'fortrade', label: 'For Trade' },
  { key: 'want', label: 'Want' },
  { key: 'wanttobuy', label: 'Want To Buy' },
  { key: 'wishlist', label: 'Wishlist' },
];

const DEFAULT_COLLECTION_FILTERS = COLLECTION_STATUSES.reduce((acc, status) => {
  acc[status.key] = status.key === 'own' ? 'include' : 'neutral';
  return acc;
}, {});

const FILTER_PANEL_KEYS = ['preferences', 'collections', 'priorities'];
const DEFAULT_FILTER_PANEL_STATE = FILTER_PANEL_KEYS.reduce((acc, key) => {
  acc[key] = true; // collapsed by default
  return acc;
}, {});

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

const getCollapsedBadgeLimit = (width) => {
  if (!Number.isFinite(width) || width <= 0) {
    return 4;
  }

  if (width >= 1280) {
    return 4;
  }
  if (width >= 1080) {
    return 3;
  }
  if (width >= 900) {
    return 2;
  }
  if (width >= 720) {
    return 1;
  }
  return 0;
};

function App() {
  const formRef = useRef(null);
  const [username, setUsername] = useState('');
  const [includeExpansions, setIncludeExpansions] = useState(false);
  const [groupExpansions, setGroupExpansions] = useState(false);
  const [groupSeries, setGroupSeries] = useState(false);
  const [verticalStacking, setVerticalStacking] = useState(true);
  const [lockRotation, setLockRotation] = useState(false);
  const [optimizeSpace, setOptimizeSpace] = useState(false);
  const [respectSortOrder, setRespectSortOrder] = useState(false);
  const [fitOversized, setFitOversized] = useState(false);
  const [bypassVersionWarning, setBypassVersionWarning] = useState(false);
  const [priorities, setPriorities] = useState(DEFAULT_PRIORITIES);
  const [collectionFilters, setCollectionFilters] = useState(
    () => ({ ...DEFAULT_COLLECTION_FILTERS })
  );
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
  const [filterPanelsCollapsed, setFilterPanelsCollapsed] = useState(
    () => ({ ...DEFAULT_FILTER_PANEL_STATE })
  );
  const [settingsHydrated, setSettingsHydrated] = useState(false);
  const [lastResultHydrated, setLastResultHydrated] = useState(false);
  const [collapsedBadgeLimit, setCollapsedBadgeLimit] = useState(() =>
    typeof window === 'undefined' ? 4 : getCollapsedBadgeLimit(window.innerWidth)
  );
  const [hasStoredData, setHasStoredData] = useState(false);
  const initialCollapseAppliedRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleResize = () => {
      setCollapsedBadgeLimit(getCollapsedBadgeLimit(window.innerWidth));
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
            verticalStacking: storedVerticalStacking,
            lockRotation: storedLockRotation,
            optimizeSpace: storedOptimizeSpace,
            respectSortOrder: storedRespectSortOrder,
            fitOversized: storedFitOversized,
            filtersCollapsed: storedFiltersCollapsed,
            filterPanelsCollapsed: storedFilterPanelsCollapsed,
            bypassVersionWarning: storedBypassVersionWarning,
            priorities: storedPriorities,
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
          if (typeof storedVerticalStacking === 'boolean') {
            setVerticalStacking(storedVerticalStacking);
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
          if (Array.isArray(storedPriorities) && storedPriorities.length > 0) {
            setPriorities(storedPriorities);
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
      includeExpansions,
      groupExpansions,
      groupSeries,
      verticalStacking,
      lockRotation,
      optimizeSpace,
      respectSortOrder,
      fitOversized,
      filtersCollapsed,
      priorities,
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
    verticalStacking,
    lockRotation,
    optimizeSpace,
    respectSortOrder,
    fitOversized,
    filtersCollapsed,
    priorities,
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
        setOversizedGames(storedResult.response.oversizedGames || []);
        setHasStoredData(true);

        if (typeof storedResult.response.fitOversized === 'boolean') {
          setFitOversized(storedResult.response.fitOversized);
        }
        if (typeof storedResult.response.verticalStacking === 'boolean') {
          setVerticalStacking(storedResult.response.verticalStacking);
        }
        if (typeof storedResult.response.lockRotation === 'boolean') {
          setLockRotation(storedResult.response.lockRotation);
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
  const includeStatusList = useMemo(
    () =>
      COLLECTION_STATUSES.filter((status) => collectionFilters[status.key] === 'include').map(
        (status) => status.key
      ),
    [collectionFilters]
  );
  const excludeStatusList = useMemo(
    () =>
      COLLECTION_STATUSES.filter((status) => collectionFilters[status.key] === 'exclude').map(
        (status) => status.key
      ),
    [collectionFilters]
  );
  const hasIncludeStatuses = includeStatusList.length > 0;
  const renderFilterPanel = (panelKey, title, content) => {
    const isCollapsed = Boolean(filterPanelsCollapsed[panelKey]);
    return (
      <section
        key={panelKey}
        className={`filter-panel ${isCollapsed ? 'filter-panel--collapsed' : ''}`}
      >
        <button
          type="button"
          className="filter-panel__header"
          onClick={() => toggleFilterPanel(panelKey)}
          aria-expanded={!isCollapsed}
          aria-controls={`filter-panel-${panelKey}`}
        >
          <span className="filter-panel__chevron" aria-hidden>
            <FaChevronRight className="filter-panel__chevron-icon" />
          </span>
          <span className="filter-panel__title">{title}</span>
        </button>
        <div
          className="filter-panel__body"
          id={`filter-panel-${panelKey}`}
          hidden={isCollapsed}
        >
          {content}
        </div>
      </section>
    );
  };

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
    setUsername('');
    setIncludeExpansions(false);
    setGroupExpansions(false);
    setGroupSeries(false);
    setVerticalStacking(true);
    setLockRotation(false);
    setOptimizeSpace(false);
    setRespectSortOrder(false);
    setFitOversized(false);
    setBypassVersionWarning(false);
    setFiltersCollapsed(false);
    setPriorities(DEFAULT_PRIORITIES.map((priority) => ({ ...priority })));
    setCollectionFilters({ ...DEFAULT_COLLECTION_FILTERS });
    setFilterPanelsCollapsed({ ...DEFAULT_FILTER_PANEL_STATE });
    setCubes(null);
    setOversizedGames([]);
    setMissingVersionWarning(null);
    setLastRequestConfig(null);
    setError(null);
    setProgress('');
    setHasStoredData(false);

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
      setRespectSortOrder(false);
    }
  };

  const activeFilterLabels = useMemo(() => {
    const labels = [];
    const pushLabel = (condition, key, content) => {
      if (condition) {
        labels.push({ key, content });
      }
    };

    pushLabel(includeExpansions, 'includeExpansions', 'Include expansions');
    pushLabel(groupExpansions, 'groupExpansions', 'Group expansions');
    pushLabel(groupSeries, 'groupSeries', 'Group series');
    pushLabel(respectSortOrder, 'respectSortOrder', 'Respect priority order');
    pushLabel(optimizeSpace, 'optimizeSpace', 'Optimize for space');
    pushLabel(fitOversized, 'fitOversized', 'Fit oversized games');
    pushLabel(bypassVersionWarning, 'bypassVersionWarning', 'Bypass version warning');
    pushLabel(!verticalStacking, 'horizontalStacking', 'Horizontal stacking');
    pushLabel(lockRotation, 'lockRotation', 'Lock rotation');

    if (includeStatusList.length > 0) {
      const includeLabels = includeStatusList
        .map((statusKey) => COLLECTION_STATUSES.find((status) => status.key === statusKey)?.label)
        .filter(Boolean);
      const showIncludeLabel =
        includeLabels.length > 0 &&
        !(includeStatusList.length === 1 && includeStatusList[0] === 'own');
      if (showIncludeLabel) {
        pushLabel(true, 'collectionInclude', `Include: ${includeLabels.join(', ')}`);
      }
    }

    if (excludeStatusList.length > 0) {
      const excludeLabels = excludeStatusList
        .map((statusKey) => COLLECTION_STATUSES.find((status) => status.key === statusKey)?.label)
        .filter(Boolean);
      if (excludeLabels.length > 0) {
        pushLabel(true, 'collectionExclude', `Exclude: ${excludeLabels.join(', ')}`);
      }
    }

    if (!optimizeSpace) {
      const enabledPriorities = [];
      const disabledDefaultLabels = [];

      priorities.forEach((priority) => {
        const defaultConfig = DEFAULT_PRIORITIES_BY_FIELD[priority.field];
        const baseLabel = PRIORITY_LABELS[priority.field] || priority.field;
        const ArrowIcon = priority.order === 'desc' ? FaArrowDown : FaArrowUp;

        if (priority.enabled) {
          enabledPriorities.push({
            field: priority.field,
            label: baseLabel,
            Icon: ArrowIcon,
            order: priority.order,
          });
        } else if (defaultConfig?.enabled) {
          disabledDefaultLabels.push(baseLabel);
        }
      });

      if (enabledPriorities.length > 0) {
        pushLabel(true, 'priority:enabled', (
          <span className="priority-badge-content">
            Priority:{' '}
            {enabledPriorities.map((priority, index) => (
              <React.Fragment key={`${priority.field}-${priority.order}`}>
                <span className="priority-entry">
                  {priority.label}{' '}
                  <priority.Icon aria-hidden className="priority-badge-icon" />
                </span>
                {index < enabledPriorities.length - 1 && (
                  <span className="priority-separator">, </span>
                )}
              </React.Fragment>
            ))}
          </span>
        ));
      }

      if (disabledDefaultLabels.length > 0) {
        pushLabel(
          true,
          'priority:disabled-defaults',
          `Priority disabled: ${disabledDefaultLabels.join(', ')}`
        );
      }
    }

    return labels;
  }, [
    lockRotation,
    fitOversized,
    bypassVersionWarning,
    groupExpansions,
    groupSeries,
    includeExpansions,
    optimizeSpace,
    priorities,
    respectSortOrder,
    verticalStacking,
    includeStatusList,
    excludeStatusList,
  ]);

  const activeFilterCount = activeFilterLabels.length;

  const { headerBadgeTags, headerBadgeOverflow } = useMemo(() => {
    if (activeFilterLabels.length === 0 || collapsedBadgeLimit <= 0) {
      return { headerBadgeTags: [], headerBadgeOverflow: 0 };
    }

    const limited = activeFilterLabels.slice(0, collapsedBadgeLimit);
    const overflow = Math.max(0, activeFilterLabels.length - limited.length);

    return { headerBadgeTags: limited, headerBadgeOverflow: overflow };
  }, [activeFilterLabels, collapsedBadgeLimit]);

  useEffect(() => {
    if (initialCollapseAppliedRef.current) {
      return;
    }

    if (!settingsHydrated || !lastResultHydrated) {
      return;
    }

    const shouldCollapse = hasStoredData || (Array.isArray(cubes) && cubes.length > 0);
    setFiltersCollapsed(shouldCollapse);
    initialCollapseAppliedRef.current = true;
  }, [settingsHydrated, lastResultHydrated, hasStoredData, cubes]);

  const toggleFiltersCollapsed = useCallback(() => {
    if (loading) {
      return;
    }
    setFiltersCollapsed((prev) => !prev);
  }, [loading]);

  const handleHeaderClick = useCallback(
    (event) => {
      if (loading) {
        return;
      }

      const target = event?.target;
      if (
        target instanceof Element &&
        (target.closest('.search-panel-submit') || target.closest('.search-panel-actions'))
      ) {
        return;
      }

      toggleFiltersCollapsed();
    },
    [loading, toggleFiltersCollapsed]
  );

  const handleHeaderKeyDown = useCallback(
    (event) => {
      if (loading) {
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleFiltersCollapsed();
      }
    },
    [loading, toggleFiltersCollapsed]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!username.trim()) {
      setError('Please enter a BoardGameGeek username');
      return;
    }

    if (!hasIncludeStatuses) {
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
        includeStatuses: includeStatusList,
        excludeStatuses: excludeStatusList,
        includeExpansions,
        priorities,
        verticalStacking,
        lockRotation,
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
        {
          includeStatuses: includeStatusList,
          excludeStatuses: excludeStatusList,
          includeExpansions,
          priorities,
          verticalStacking,
          lockRotation,
          optimizeSpace,
          respectSortOrder,
          fitOversized,
          groupExpansions: effectiveGroupExpansions,
          groupSeries: effectiveGroupSeries,
        },
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
        setError(
          response?.message || 'No games matched your selected collections.'
        );
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
          lockRotation,
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

      const fallbackLockRotation =
        typeof lastRequestConfig.lockRotation === 'boolean'
          ? lastRequestConfig.lockRotation
          : lockRotation;

      const fallbackIncludeStatuses = Array.isArray(lastRequestConfig.includeStatuses)
        ? lastRequestConfig.includeStatuses
        : includeStatusList;
      const fallbackExcludeStatuses = Array.isArray(lastRequestConfig.excludeStatuses)
        ? lastRequestConfig.excludeStatuses
        : excludeStatusList;

      const response = await fetchPackedCubes(
        lastRequestConfig.username,
        {
          includeStatuses: fallbackIncludeStatuses,
          excludeStatuses: fallbackExcludeStatuses,
          includeExpansions: lastRequestConfig.includeExpansions,
          priorities: lastRequestConfig.priorities,
          verticalStacking: lastRequestConfig.verticalStacking,
          lockRotation: fallbackLockRotation,
          optimizeSpace: lastRequestConfig.optimizeSpace,
          respectSortOrder: lastRequestConfig.respectSortOrder,
          fitOversized: lastRequestConfig.fitOversized,
          groupExpansions: lastRequestConfig.groupExpansions,
          groupSeries: lastRequestConfig.groupSeries,
        },
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
        setError(
          response?.message || 'No games matched your selected collections.'
        );
        setLoading(false);
        return;
      }

      setProgress('Rendering results...');
      setCubes(response.cubes);
      setOversizedGames(response.oversizedGames || []);
      setProgress('');
      setLoading(false);

      const normalizedRequestConfig = {
        ...lastRequestConfig,
        lockRotation: fallbackLockRotation,
        includeStatuses: fallbackIncludeStatuses,
        excludeStatuses: fallbackExcludeStatuses,
      };

      setLastRequestConfig(normalizedRequestConfig);

      saveLastResult({
        requestConfig: normalizedRequestConfig,
        response: {
          cubes: response.cubes,
          oversizedGames: response.oversizedGames || [],
          fitOversized: normalizedRequestConfig.fitOversized,
          verticalStacking: normalizedRequestConfig.verticalStacking,
          lockRotation: fallbackLockRotation,
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
        <form ref={formRef} onSubmit={handleSubmit} className="search-panel-form">
          <div
            className={`search-panel-header ${filtersCollapsed ? 'is-collapsed' : ''} ${
              loading ? 'is-disabled' : ''
            }`}
            role="button"
            tabIndex={loading ? -1 : 0}
            aria-expanded={!filtersCollapsed}
            aria-controls="search-panel-content"
            onClick={handleHeaderClick}
            onKeyDown={handleHeaderKeyDown}
            title={filtersCollapsed ? 'Show search options' : 'Hide search options'}
          >
            <div className="search-panel-primary">
              <div className="search-panel-toggle">
                <span className="disclosure-arrow search-panel-icon" aria-hidden>
                  {filtersCollapsed ? (
                    <FaChevronRight className="disclosure-arrow-icon" />
                  ) : (
                    <FaChevronDown className="disclosure-arrow-icon" />
                  )}
                </span>
                <span className="search-panel-label">
                  <strong className="search-panel-title">Options</strong>
                  {activeFilterCount > 0 && (
                    <span className="search-panel-count" aria-label={`${activeFilterCount} active filters`}>
                      {activeFilterCount}
                    </span>
                  )}
                </span>
              </div>
              <div className="search-panel-actions">
                <button
                  type="submit"
                  className="search-panel-submit"
                  disabled={loading || !hasIncludeStatuses}
                  title={
                    !hasIncludeStatuses
                      ? 'Select at least one collection status to organize'
                      : undefined
                  }
                >
                  {loading ? 'Processing...' : 'Organize Collection'}
                </button>
              </div>
            </div>
            {activeFilterCount > 0 && collapsedBadgeLimit > 0 && (
              <div className="search-panel-tags" aria-label="Active filters">
                {headerBadgeTags.map(({ key, content }) => (
                  <span key={key} className="search-panel-tag">
                    {content}
                  </span>
                ))}
                {headerBadgeOverflow > 0 && (
                  <span key="filter-overflow" className="search-panel-tag">
                    + {headerBadgeOverflow} more
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="search-panel-body" id="search-panel-content">
            <div className="options-row">
              <div className="options-field">
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
              <div className="options-actions">
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

            {!hasIncludeStatuses && (
              <div className="collection-filters-warning" role="alert">
                <FaExclamationTriangle aria-hidden className="collection-filters-warning__icon" />
                <span>Select at least one collection status to organize.</span>
              </div>
            )}

            <div className="filter-panels-grid">
              {renderFilterPanel(
                'preferences',
                'Preferences',
                <div className="preferences-panel">
                  <div className="stacking-row">
                    <span className="stacking-label">Stacking</span>
                    <div className="toggle-button-group toggle-button-group--compact">
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

                  <div className="preferences-toggle-grid">
                    <ToggleSwitch
                      id="optimizeSpace"
                      label="Optimize for space"
                      checked={optimizeSpace}
                      onChange={handleOptimizeSpaceChange}
                      disabled={loading}
                      tooltip="Ignore all sorting priorities, allow rotation, and pack games in as few cubes as possible"
                    />
                    <ToggleSwitch
                      id="includeExpansions"
                      label="Include expansions"
                      checked={includeExpansions}
                      onChange={(next) => {
                        setIncludeExpansions(next);
                        if (!next) {
                          setGroupExpansions(false);
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
                      id="lockRotation"
                      label="Lock rotation"
                      checked={lockRotation}
                      onChange={setLockRotation}
                      disabled={loading}
                      tooltip="Prefer vertical or horizontal, but may rotate games for better fit"
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
                      id="bypassVersionWarning"
                      label="Bypass version warning"
                      checked={bypassVersionWarning}
                      onChange={setBypassVersionWarning}
                      disabled={loading}
                      tooltip="You will not be warned about missing versions. This may result in incorrect data and longer processing times."
                      tooltipIcon={FaExclamationTriangle}
                      tooltipIconClassName="warning-icon"
                    />
                  </div>
                </div>
              )}

              {renderFilterPanel(
                'collections',
                'Collections',
                <div className="collection-status-content">
                  {(includeStatusList.length > 1 || excludeStatusList.length > 0) && (
                    <div className="collection-status-helper" role="note">
                      Include matches any selected category. Exclude removes games with those categories.
                    </div>
                  )}
                  <div className="collection-status-grid">
                    {COLLECTION_STATUSES.map((status) => (
                      <CollectionStatusToggle
                        key={status.key}
                        label={status.label}
                        value={collectionFilters[status.key]}
                        onChange={(nextState) => handleCollectionFilterChange(status.key, nextState)}
                        disabled={loading}
                      />
                    ))}
                  </div>
                </div>
              )}

              {renderFilterPanel(
                'priorities',
                'Sorting',
                <SortablePriorities
                  priorities={priorities}
                  onChange={setPriorities}
                  disabled={optimizeSpace}
                />
              )}
            </div>
          </div>
        </form>
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

