import { useState, useCallback } from 'react';

import {
  createDefaultCollectionFilters,
  createDefaultFilterPanelState,
  createDefaultPriorities,
} from '../constants/appDefaults';

export const useInputSettingsState = () => {
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
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const [priorities, setPriorities] = useState(createDefaultPriorities);
  const [collectionFilters, setCollectionFilters] = useState(createDefaultCollectionFilters);
  const [filterPanelsCollapsed, setFilterPanelsCollapsed] = useState(
    createDefaultFilterPanelState
  );
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  const resetInputSettings = useCallback(() => {
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
    setPriorities(createDefaultPriorities());
    setCollectionFilters(createDefaultCollectionFilters());
    setFilterPanelsCollapsed(createDefaultFilterPanelState());
    setIsFilterDrawerOpen(false);
  }, []);

  return {
    username,
    setUsername,
    includeExpansions,
    setIncludeExpansions,
    groupExpansions,
    setGroupExpansions,
    groupSeries,
    setGroupSeries,
    verticalStacking,
    setVerticalStacking,
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
    priorities,
    setPriorities,
    collectionFilters,
    setCollectionFilters,
    filterPanelsCollapsed,
    setFilterPanelsCollapsed,
    isFilterDrawerOpen,
    setIsFilterDrawerOpen,
    resetInputSettings,
  };
};

export default useInputSettingsState;

