import { useState, useCallback } from 'react';

import {
  createDefaultCollectionFilters,
  createDefaultFilterPanelState,
  createDefaultSortingRules,
} from '../constants/appDefaults';

export const useInputSettingsState = () => {
  const [username, setUsername] = useState('');
  const [includeExpansions, setIncludeExpansions] = useState(false);
  const [groupExpansions, setGroupExpansions] = useState(false);
  const [groupSeries, setGroupSeries] = useState(false);
  const [stacking, setStacking] = useState('vertical');
  const [lockRotation, setLockRotation] = useState(false);
  const [optimizeSpace, setOptimizeSpace] = useState(false);
  const [respectSortOrder, setRespectSortOrder] = useState(false);
  const [fitOversized, setFitOversized] = useState(false);
  const [bypassVersionWarning, setBypassVersionWarning] = useState(false);
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const [sorting, setSorting] = useState(createDefaultSortingRules);
  const [collectionFilters, setCollectionFilters] = useState(createDefaultCollectionFilters);
  const [filterPanelsCollapsed, setFilterPanelsCollapsed] = useState(
    createDefaultFilterPanelState
  );
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [useMetricUnits, setUseMetricUnits] = useState(false);

  const resetInputSettings = useCallback(() => {
    setUsername('');
    setIncludeExpansions(false);
    setGroupExpansions(false);
    setGroupSeries(false);
    setStacking('vertical');
    setLockRotation(false);
    setOptimizeSpace(false);
    setRespectSortOrder(false);
    setFitOversized(false);
    setBypassVersionWarning(false);
    setFiltersCollapsed(false);
    setSorting(createDefaultSortingRules());
    setCollectionFilters(createDefaultCollectionFilters());
    setFilterPanelsCollapsed(createDefaultFilterPanelState());
    setIsFilterDrawerOpen(false);
    setUseMetricUnits(false);
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
    useMetricUnits,
    setUseMetricUnits,
    resetInputSettings,
  };
};

export default useInputSettingsState;

