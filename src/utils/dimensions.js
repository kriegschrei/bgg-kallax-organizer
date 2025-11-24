import { formatDimension } from './unitConversion';

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

/**
 * Normalizes a dimension value, using fallback if parsing fails.
 * @param {*} value - The value to normalize
 * @param {number} fallback - Fallback value if parsing fails
 * @returns {number} Normalized dimension value
 */
export const normalizeDimensionValue = (value, fallback) => {
  const parsed = parsePositiveNumber(value);
  return parsed ?? fallback;
};

/**
 * Gets the primary dimension object from the dimensions array.
 * Prioritizes dimensions in order: user, version, guessed, default.
 * Skips dimensions that are missing or have invalid values.
 * @param {Array} dimensionsArray - Array of dimension objects
 * @returns {Object|null} Primary dimension object or null if array is empty
 */
export const getPrimaryDimension = (dimensionsArray) => {
  if (!Array.isArray(dimensionsArray) || dimensionsArray.length === 0) {
    return null;
  }

  // Priority order: user > version > guessed > default
  const priorityOrder = ['user', 'version', 'guessed', 'default'];
  
  for (const type of priorityOrder) {
    const dim = dimensionsArray.find((d) => d?.type === type);
    // Use dimension if it has valid values (missing flag is just metadata, not a validity check)
    if (dim && hasValidDimensions(dim)) {
      return dim;
    }
  }

  // Fallback: try to find any dimension with valid values (regardless of type)
  const validDim = dimensionsArray.find((d) => d && hasValidDimensions(d));
  if (validDim) {
    return validDim;
  }

  // Last resort: return first dimension even if missing (for display purposes)
  return dimensionsArray[0];
};

/**
 * Resolves display dimensions from override entry, oriented dims, or editor state.
 * @param {Object} overrideEntry - Override entry object
 * @param {Object} orientedDims - Oriented dimensions object
 * @param {Object} dimensionEditor - Current dimension editor state
 * @param {string} overrideKey - Override key for the game
 * @returns {Object} Display dimensions object with x, y, z properties
 */
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

/**
 * Formats editor dimensions for display.
 * @param {Object} editor - Editor state object
 * @param {Object} options - Formatting options
 * @param {number} options.precision - Decimal precision (default: 2)
 * @param {string} options.placeholder - Placeholder for missing values (default: '—')
 * @param {boolean} options.isMetric - Whether to display in metric units (default: false)
 * @returns {string} Formatted dimensions string
 */
export const formatEditorDimensions = (
  editor,
  { precision = 2, placeholder = '—', isMetric = false } = {}
) => {
  if (!editor) {
    return `${placeholder} × ${placeholder} × ${placeholder}`;
  }

  const formatPart = (value) => {
    const numeric = parsePositiveNumber(value);
    if (numeric === null) {
      return placeholder;
    }
    // Don't convert - editor values are already in the display unit
    const unit = isMetric ? 'cm' : '"';
    return `${numeric.toFixed(precision)}${unit}`;
  };

  return `${formatPart(editor.length)} × ${formatPart(editor.width)} × ${formatPart(
    editor.depth
  )}`;
};

/**
 * Validates that dimensions object has valid length, width, and depth/height values.
 * @param {Object} dimensions - The dimensions object to validate
 * @param {number} dimensions.length - Length value
 * @param {number} dimensions.width - Width value
 * @param {number} dimensions.depth - Depth value (optional)
 * @param {number} dimensions.height - Height value (optional, used if depth not provided)
 * @returns {boolean} True if all dimensions are valid positive numbers
 */
export const hasValidDimensions = ({ length, width, depth, height }) => {
  const normalizedDepth = typeof depth === 'number' ? depth : height;
  return [length, width, normalizedDepth].every(
    (value) => typeof value === 'number' && !Number.isNaN(value) && value > 0,
  );
};