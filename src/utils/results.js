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

