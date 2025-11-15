/**
 * Shared utility functions used across the codebase.
 */

/**
 * Converts a value to an integer, returning null if not a valid integer.
 * @param {*} value - The value to convert
 * @returns {number|null} The integer value or null if invalid
 */
export const toInteger = (value) => {
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
};

/**
 * Converts a value to a positive number, returning null if not valid.
 * @param {*} value - The value to convert
 * @returns {number|null} The positive number or null if invalid
 */
export const toPositiveNumber = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return null;
  }
  return number;
};

/**
 * Normalizes stacking value to 'horizontal' or 'vertical', defaulting to 'vertical'.
 * @param {*} value - The stacking value to normalize
 * @returns {'horizontal'|'vertical'} The normalized stacking value
 */
export const normalizeStacking = (value) => {
  return value === 'horizontal' ? 'horizontal' : 'vertical';
};

/**
 * Picks the first available URL from an object based on provided keys.
 * @param {Object} obj - The object to search
 * @param {string[]} keys - Array of keys to check in order
 * @returns {string|null} The first valid URL found or null
 */
export const pickFirstUrl = (obj, keys = []) => {
  return keys
    .map((key) => obj?.[key])
    .find((value) => typeof value === 'string' && value.trim());
};

