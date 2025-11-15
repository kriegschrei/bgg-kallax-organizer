/**
 * Converts an array of items with 'key' properties into a map/object.
 * @param {Array} items - Array of items to convert
 * @returns {Object} Map object keyed by item.key
 */
export const arrayToMap = (items = []) => {
  if (!Array.isArray(items)) {
    return {};
  }

  return items.reduce((acc, item) => {
    if (item?.key) {
      acc[item.key] = { ...item };
    }
    return acc;
  }, {});
};

