/**
 * Parses a value as an integer, returning a default value if parsing fails.
 * @param {*} value - The value to parse
 * @param {number} defaultValue - The default value to return if parsing fails (default: -1)
 * @returns {number} The parsed integer or the default value
 */
export const parseInteger = (value, defaultValue = -1) => {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
};

/**
 * Parses a value as a float, returning a default value if parsing fails.
 * @param {*} value - The value to parse
 * @param {number} defaultValue - The default value to return if parsing fails (default: -1)
 * @returns {number} The parsed float or the default value
 */
export const parseFloat = (value, defaultValue = -1) => {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? defaultValue : parsed;
};

/**
 * Normalizes a value to a positive number, returning null if invalid.
 * @param {*} value - The value to normalize
 * @returns {number|null} The positive number or null if invalid
 */
export const normalizePositiveNumber = (value) =>
  Number.isFinite(value) && value > 0 ? value : null;

/**
 * Normalizes a value to a number, returning a fallback if invalid.
 * @param {*} value - The value to normalize
 * @param {number} fallback - The fallback value if invalid (default: 0)
 * @returns {number} The normalized number or fallback
 */
export const normalizeNumber = (value, fallback = 0) =>
  Number.isFinite(value) ? value : fallback;

/**
 * Converts a value to an integer, returning a fallback if not an integer.
 * @param {*} value - The value to convert
 * @param {number} fallback - The fallback value if not an integer (default: -1)
 * @returns {number} The integer value or fallback
 */
export const toIntegerOrFallback = (value, fallback = -1) =>
  Number.isInteger(value) ? value : fallback;

/**
 * Checks if a value is a positive finite number.
 * @param {*} value - The value to check
 * @returns {boolean} True if the value is a positive finite number
 */
export const isPositiveFinite = (value) =>
  Number.isFinite(value) && value > 0;

/**
 * Checks if a value is a non-negative integer.
 * @param {*} value - The value to check
 * @returns {boolean} True if the value is a non-negative integer
 */
export const isNonNegativeInteger = (value) =>
  Number.isInteger(value) && value >= 0;

