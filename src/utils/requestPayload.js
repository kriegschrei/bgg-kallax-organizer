import { COLLECTION_STATUSES } from '../constants/appDefaults';

const STATUS_KEYS = COLLECTION_STATUSES.map((status) => status.key);
const SORT_FIELDS = new Set([
  'gameId',
  'versionId',
  'gameName',
  'versionName',
  'bggRank',
  'minPlayers',
  'maxPlayers',
  'bestPlayerCount',
  'minPlaytime',
  'maxPlaytime',
  'age',
  'communityAge',
  'weight',
  'bggRating',
  'categories',
  'families',
  'mechanics',
]);
const ORIENTATION_VALUES = new Set(['horizontal', 'vertical']);

const toInteger = (value) => {
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
};

const toPositiveNumber = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return null;
  }
  return number > 0 ? number : null;
};

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

export const buildSortPayload = (sortingRules = []) =>
  sortingRules
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

const BOOLEAN_FIELDS = [
  'lockRotation',
  'optimizeSpace',
  'respectSortOrder',
  'fitOversized',
  'groupExpansions',
  'groupSeries',
  'includeExpansions',
  'bypassVersionWarning',
];

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

  return payload;
};

export const hasIncludeSelection = (statusSelections = {}) =>
  STATUS_KEYS.some((key) => statusSelections[key] === 'include');

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

export const getStatusKeys = () => [...STATUS_KEYS];

