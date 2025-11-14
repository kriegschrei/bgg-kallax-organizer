export const parsePositiveNumber = (value) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const numeric = Number.parseFloat(trimmed);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
  }

  return null;
};

export const normalizeDimensionValue = (value, fallback) => {
  const parsed = parsePositiveNumber(value);
  return parsed ?? fallback;
};

/**
 * Gets the primary dimension object from the dimensions array.
 * Prioritizes dimensions in order: user, version, guessed, default.
 */
export const getPrimaryDimension = (dimensionsArray) => {
  if (!Array.isArray(dimensionsArray) || dimensionsArray.length === 0) {
    return null;
  }

  // Priority order: user > version > guessed > default
  const priorityOrder = ['user', 'version', 'guessed', 'default'];
  
  for (const type of priorityOrder) {
    const dim = dimensionsArray.find((d) => d?.type === type);
    if (dim) {
      return dim;
    }
  }

  // Fallback to first dimension if none match expected types
  return dimensionsArray[0];
};

export const resolveDisplayDimensions = (
  overrideEntry,
  orientedDims = { x: 0, y: 0, z: 0 },
  dimensionEditor,
  overrideKey
) => {
  const source =
    dimensionEditor && dimensionEditor.overrideKey === overrideKey ? dimensionEditor : overrideEntry;

  if (!source) {
    return orientedDims;
  }

  return {
    x: normalizeDimensionValue(source.length, orientedDims.x),
    y: normalizeDimensionValue(source.width, orientedDims.y),
    z: normalizeDimensionValue(source.depth ?? source.height, orientedDims.z),
  };
};

export const formatEditorDimensions = (
  editor,
  { precision = 2, placeholder = '—' } = {}
) => {
  if (!editor) {
    return `${placeholder} × ${placeholder} × ${placeholder}`;
  }

  const formatPart = (value) => {
    const numeric = parsePositiveNumber(value);
    return numeric !== null ? `${numeric.toFixed(precision)}"` : placeholder;
  };

  return `${formatPart(editor.length)} × ${formatPart(editor.width)} × ${formatPart(
    editor.depth
  )}`;
};
