import { COLLECTION_STATUSES } from '../constants/appDefaults';
import { toInteger, toPositiveNumber } from './helpers';

const STATUS_KEYS = COLLECTION_STATUSES.map((status) => status.key);
const SORT_FIELDS = new Set([
  'gameId',
  'versionId',
  'gameName',
  'versionName',
  'bggRank',
  'bggWeight',
  'bggRating',
  'minPlayers',
  'maxPlayers',
  'bestPlayerCount',
  'minPlaytime',
  'maxPlaytime',
  'age',
  'communityAge',
  'languageDependence',
  'weight',
  'volume',
  'area',
  'numplays',
  'categories',
  'families',
  'mechanics',
  'gamePublishedYear',
  'versionPublishedYear',
]);
const ORIENTATION_VALUES = new Set(['horizontal', 'vertical']);

export const buildStatusesPayload = (selections = {}) => {
  const result = {};
  let includeCount = 0;

  STATUS_KEYS.forEach((key) => {
    const value = selections[key];
    if (value === 'include' || value === 'exclude') {
      result[key] = value;
      if (value === 'include') {
        includeCount += 1;
      }
    }
  });

  if (includeCount === 0) {
    result.own = 'include';
  }

  return result;
};

/**
 * Builds sort payload from sorting rules array.
 * Filters to only enabled rules with valid fields and orders.
 * Always returns at least the default sort (gameName ascending) if no rules are enabled.
 * @param {Array} sortingRules - Array of sorting rule objects
 * @returns {Array} Array of sort payload objects
 */
export const buildSortPayload = (sortingRules = []) => {
  const rules = sortingRules
    .filter(
      (rule) =>
        rule?.enabled === true &&
        SORT_FIELDS.has(rule.field) &&
        (rule.order === 'asc' || rule.order === 'desc'),
    )
    .map((rule) => ({
      field: rule.field,
      order: rule.order,
    }));
  
  // Always return at least the default sort if no rules are enabled
  // This ensures the backend always has a sort order to work with
  if (rules.length === 0) {
    return [{ field: 'gameName', order: 'asc' }];
  }
  
  return rules;
};

const buildExcludedVersions = (items = []) =>
  items
    .map((item) => {
      const game = toInteger(item?.gameId ?? item?.game ?? item?.gameID);
      const version = toInteger(item?.versionId ?? item?.version ?? item?.versionID);

      if (game === null || version === null) {
        return null;
      }

      return { game, version };
    })
    .filter(Boolean);

const buildStackingOverrides = (items = []) =>
  items
    .map((item) => {
      const game = toInteger(item?.gameId ?? item?.game ?? item?.gameID);
      const version = toInteger(item?.versionId ?? item?.version ?? item?.versionID);
      const orientation =
        typeof item?.orientation === 'string' && ORIENTATION_VALUES.has(item.orientation)
          ? item.orientation
          : null;

      if (game === null || version === null || orientation === null) {
        return null;
      }

      return { game, version, orientation };
    })
    .filter(Boolean);

const buildDimensionOverrides = (items = []) =>
  items
    .map((item) => {
      const game = toInteger(item?.gameId ?? item?.game ?? item?.gameID);
      const version = toInteger(item?.versionId ?? item?.version ?? item?.versionID);
      const length = toPositiveNumber(item?.length);
      const width = toPositiveNumber(item?.width);
      const height = toPositiveNumber(item?.height ?? item?.depth);

      if (
        game === null ||
        version === null ||
        length === null ||
        width === null ||
        height === null
      ) {
        return null;
      }

      return { game, version, length, width, height };
    })
    .filter(Boolean);

export const buildOverridesPayload = ({
  excludedVersions = [],
  stackingOverrides = [],
  dimensionOverrides = [],
} = {}) => {
  const excluded = buildExcludedVersions(excludedVersions);
  const stacking = buildStackingOverrides(stackingOverrides);
  const dimensions = buildDimensionOverrides(dimensionOverrides);

  const overrides = {};

  if (excluded.length > 0) {
    overrides.excludedVersions = excluded;
  }
  if (stacking.length > 0) {
    overrides.stackingOverrides = stacking;
  }
  if (dimensions.length > 0) {
    overrides.dimensionOverrides = dimensions;
  }

  return overrides;
};

/**
 * Array of boolean flag field names used in request payload.
 */
const BOOLEAN_FIELDS = [
  'lockRotation',
  'optimizeSpace',
  'fitOversized',
  'groupExpansions',
  'groupSeries',
  'includeExpansions',
  'bypassVersionWarning',
];

/**
 * Builds the complete request payload for the API.
 * @param {Object} options - Configuration object
 * @param {string} options.username - BoardGameGeek username
 * @param {string} options.stacking - Stacking preference
 * @param {Object} options.statusSelections - Collection status selections
 * @param {Array} options.sorting - Sorting rules array
 * @param {Object} options.overrides - Overrides object
 * @param {Object} options.flags - Boolean flags object
 * @returns {Object} Complete request payload object
 * @throws {Error} If username is missing or invalid
 */
export const buildRequestPayload = ({
  username,
  stacking,
  statusSelections,
  sorting,
  overrides,
  flags,
} = {}) => {
  if (!username || typeof username !== 'string') {
    throw new Error('Username is required for request payload.');
  }

  const payload = {
    username: username.trim(),
  };

  if (stacking === 'horizontal' || stacking === 'vertical') {
    payload.stacking = stacking;
  }

  const statuses = buildStatusesPayload(statusSelections);
  if (Object.keys(statuses).length > 0) {
    payload.statuses = statuses;
  }

  const sort = buildSortPayload(sorting);
  if (sort.length > 0) {
    payload.sort = sort;
  }

  const overridesPayload = buildOverridesPayload(overrides);
  if (Object.keys(overridesPayload).length > 0) {
    payload.overrides = overridesPayload;
  }

  const normalizedFlags = flags ?? {};
  BOOLEAN_FIELDS.forEach((field) => {
    if (normalizedFlags[field] === true) {
      payload[field] = true;
    }
  });

  // Add backfillPercentage if provided (0-100)
  if (typeof normalizedFlags.backfillPercentage === 'number' && 
      normalizedFlags.backfillPercentage >= 0 && 
      normalizedFlags.backfillPercentage <= 100) {
    payload.backfillPercentage = normalizedFlags.backfillPercentage;
  }

  return payload;
};

/**
 * Checks if any status selection is set to 'include'.
 * @param {Object} statusSelections - Status selections object
 * @returns {boolean} True if at least one status is 'include'
 */
export const hasIncludeSelection = (statusSelections = {}) =>
  STATUS_KEYS.some((key) => statusSelections[key] === 'include');

/**
 * Derives status selections from collection filters.
 * Only includes 'include' or 'exclude' values, filters out 'neutral'.
 * @param {Object} collectionFilters - Collection filters object
 * @returns {Object} Status selections object
 */
export const deriveStatusSelections = (collectionFilters = {}) => {
  const selections = {};

  STATUS_KEYS.forEach((key) => {
    const value = collectionFilters[key];
    if (value === 'include' || value === 'exclude') {
      selections[key] = value;
    }
  });

  return selections;
};

/**
 * Gets array of all valid status keys.
 * @returns {Array} Array of status key strings
 */
export const getStatusKeys = () => [...STATUS_KEYS];

