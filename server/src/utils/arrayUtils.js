/**
 * Ensures a value is an array. Returns an empty array if value is falsy,
 * returns the value if it's already an array, or wraps a single value in an array.
 * @param {*} value - The value to ensure is an array
 * @returns {Array} An array containing the value(s)
 */
export const ensureArray = (value) => {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
};

/**
 * Clones an array, or returns an empty array if the value is not an array.
 * @param {*} value - The value to clone
 * @returns {Array} A cloned array or empty array
 */
export const cloneList = (value) => (Array.isArray(value) ? [...value] : []);

