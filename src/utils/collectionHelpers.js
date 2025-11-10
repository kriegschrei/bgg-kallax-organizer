export const arrayToMap = (items = []) => {
  if (!Array.isArray(items)) {
    return {};
  }

  return items.reduce((acc, item) => {
    if (item?.id) {
      acc[item.id] = { ...item };
    }
    return acc;
  }, {});
};

