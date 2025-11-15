import { formatDimension } from './unitConversion';

export const formatGameDimensions = (dims, isMetric = false) => {
  if (!dims) {
    return '—';
  }

  const normalize = (value) =>
    typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;

  const length = normalize(dims.length ?? dims.height ?? dims.x ?? null);
  const width = normalize(dims.width ?? dims.y ?? null);
  const depth = normalize(dims.depth ?? dims.z ?? null);

  const segments = [length, width, depth].map((value) =>
    value !== null ? formatDimension(value, isMetric, 2) : '—'
  );

  return segments.join(' × ');
};

/**
 * Gets CSS class name for scrollable list based on length.
 * @param {number} length - Number of items in the list
 * @returns {string} CSS class name
 */
export const getScrollableListClassName = (length) =>
  length > 8 ? 'callout__list scrollable' : 'callout__list';

/**
 * Converts a value to an array. Returns the value if it's already an array, otherwise returns an empty array.
 */
export const toArray = (value) => (Array.isArray(value) ? value : []);

/**
 * Sorts items by display name.
 * Works with both game objects (uses displayName field) and override entries (uses name field).
 */
export const sortByName = (a, b) => {
  // Override entries already have a name field
  // Game objects have displayName field from the API
  const nameA = a?.name || a?.displayName || a?.gameName || 'Unknown';
  const nameB = b?.name || b?.displayName || b?.gameName || 'Unknown';
  return nameA.localeCompare(nameB);
};

/**
 * Formats a stat value with optional fallback and suffix.
 * @param {*} value - The value to format
 * @param {*} fallback - Fallback value if value is invalid
 * @param {string} suffix - Optional suffix to append
 * @returns {string} Formatted value string
 */
export const formatStatValue = (value, fallback, suffix = '') => {
  const isNumeric = typeof value === 'number' && Number.isFinite(value);
  const isDefined = value !== null && value !== undefined && value !== '';

  if (!isNumeric && !isDefined) {
    return fallback;
  }

  const formatted = isNumeric ? value : value;
  return suffix ? `${formatted}${suffix}` : formatted;
};

/**
 * Creates a stat item object with formatted value.
 * @param {string} label - The stat label
 * @param {*} value - The stat value
 * @param {*} fallback - Fallback value if value is invalid
 * @param {string} suffix - Optional suffix to append
 * @returns {Object} Stat item object with label and formatted value
 */
export const createStatItem = (label, value, fallback, suffix) => ({
  label,
  value: formatStatValue(value, fallback, suffix),
});

