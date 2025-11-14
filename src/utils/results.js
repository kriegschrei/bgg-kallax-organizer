
export const formatGameDimensions = (dims) => {
  if (!dims) {
    return '—';
  }

  const normalize = (value) =>
    typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;

  const length = normalize(dims.length ?? dims.height ?? dims.x ?? null);
  const width = normalize(dims.width ?? dims.y ?? null);
  const depth = normalize(dims.depth ?? dims.z ?? null);

  const segments = [length, width, depth].map((value) =>
    value !== null ? `${value.toFixed(2)}"` : '—'
  );

  return segments.join(' × ');
};

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

