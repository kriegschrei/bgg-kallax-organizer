import { COLLECTION_STATUSES, FILTER_PANEL_KEYS } from '../constants/appDefaults';
import { normalizeStacking } from './helpers';

/**
 * Normalizes a stored stacking value to 'horizontal' or 'vertical'.
 * @param {*} value - The stacking value to normalize
 * @returns {'horizontal'|'vertical'} The normalized stacking value
 */
export const normalizeStoredStacking = (value) => {
  return normalizeStacking(value);
};

/**
 * Validates that stored settings object has valid structure.
 * @param {*} settings - The settings object to validate
 * @returns {boolean} True if settings is a valid object
 */
export const validateStoredSettings = (settings) => {
  return settings && typeof settings === 'object' && Object.keys(settings).length > 0;
};

/**
 * Applies stored settings to state setters.
 * @param {Object} storedSettings - The stored settings object
 * @param {Object} setters - Object containing all state setters
 * @param {Object} [refs] - Optional refs object to track which settings were applied
 * @param {Object} [refs.filtersCollapsedFromStorageRef] - Ref to track if filtersCollapsed was set from storage
 */
export const applyStoredSettings = (storedSettings, setters, refs = {}) => {
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

  if (typeof storedUsername === 'string') {
    setters.setUsername(storedUsername);
  }
  if (typeof storedIncludeExpansions === 'boolean') {
    setters.setIncludeExpansions(storedIncludeExpansions);
  }
  if (typeof storedGroupExpansions === 'boolean') {
    setters.setGroupExpansions(storedGroupExpansions);
  }
  if (typeof storedGroupSeries === 'boolean') {
    setters.setGroupSeries(storedGroupSeries);
  }
  if (typeof storedStacking === 'string') {
    setters.setStacking(normalizeStoredStacking(storedStacking));
  }
  if (typeof storedLockRotation === 'boolean') {
    setters.setLockRotation(storedLockRotation);
  }
  if (typeof storedOptimizeSpace === 'boolean') {
    setters.setOptimizeSpace(storedOptimizeSpace);
  }
  if (typeof storedRespectSortOrder === 'boolean') {
    setters.setRespectSortOrder(storedRespectSortOrder);
  }
  if (typeof storedFitOversized === 'boolean') {
    setters.setFitOversized(storedFitOversized);
  }
  if (typeof storedBypassVersionWarning === 'boolean') {
    setters.setBypassVersionWarning(storedBypassVersionWarning);
  }
  if (typeof storedFiltersCollapsed === 'boolean') {
    setters.setFiltersCollapsed(storedFiltersCollapsed);
    if (refs.filtersCollapsedFromStorageRef) {
      refs.filtersCollapsedFromStorageRef.current = true;
    }
  }
  if (storedFilterPanelsCollapsed && typeof storedFilterPanelsCollapsed === 'object') {
    setters.setFilterPanelsCollapsed((prev) => ({
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
    setters.setSorting(storedSorting);
  }
  if (storedCollectionFilters && typeof storedCollectionFilters === 'object') {
    setters.setCollectionFilters((prev) => ({
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
};

