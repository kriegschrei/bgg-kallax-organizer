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

