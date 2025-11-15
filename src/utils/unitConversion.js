/**
 * Unit conversion utilities for converting between Imperial and Metric units.
 * Source data is always in Imperial (inches, lbs), so conversions are one-way:
 * - Display: Imperial → Metric (when metric mode is enabled)
 * - Input: Metric → Imperial (when metric mode is enabled, before saving)
 */

/**
 * Converts inches to centimeters.
 * @param {number} inches - Value in inches
 * @returns {number} Value in centimeters
 */
export const convertInchesToCm = (inches) => {
  if (typeof inches !== 'number' || !Number.isFinite(inches)) {
    return null;
  }
  return inches * 2.54;
};

/**
 * Converts centimeters to inches.
 * @param {number} cm - Value in centimeters
 * @returns {number} Value in inches
 */
export const convertCmToInches = (cm) => {
  if (typeof cm !== 'number' || !Number.isFinite(cm)) {
    return null;
  }
  return cm / 2.54;
};

/**
 * Converts pounds to grams.
 * @param {number} lbs - Value in pounds
 * @returns {number} Value in grams
 */
export const convertLbsToGrams = (lbs) => {
  if (typeof lbs !== 'number' || !Number.isFinite(lbs)) {
    return null;
  }
  return lbs * 453.592;
};

/**
 * Formats a dimension value with appropriate unit label.
 * @param {number} value - Dimension value in inches (will be converted if metric)
 * @param {boolean} isMetric - Whether to display in metric units
 * @param {number} precision - Decimal precision (default: 1)
 * @returns {string} Formatted dimension string with unit
 */
export const formatDimension = (value, isMetric, precision = 1) => {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }

  const displayValue = isMetric ? convertInchesToCm(value) : value;
  const unit = isMetric ? 'cm' : '"';
  
  return `${displayValue.toFixed(precision)}${unit}`;
};

/**
 * Formats a weight value with appropriate unit label.
 * @param {number} value - Weight value in pounds (will be converted if metric)
 * @param {boolean} isMetric - Whether to display in metric units
 * @param {number} precision - Decimal precision (default: 2)
 * @returns {string} Formatted weight string with unit
 */
export const formatWeight = (value, isMetric, precision = 2) => {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }

  const displayValue = isMetric ? convertLbsToGrams(value) : value;
  const unit = isMetric ? 'g' : 'lb';
  
  return `${displayValue.toFixed(precision)} ${unit}`;
};

/**
 * Converts a dimension input value from display unit to storage unit (inches).
 * @param {number|string} value - Input value in the current display unit
 * @param {boolean} isMetric - Whether the input is in metric units
 * @returns {number|null} Value in inches, or null if invalid
 */
export const convertDimensionInputToInches = (value, isMetric) => {
  const numeric = typeof value === 'string' ? parseFloat(value.trim()) : value;
  
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }

  return isMetric ? convertCmToInches(numeric) : numeric;
};

