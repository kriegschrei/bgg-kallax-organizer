import React, { useMemo } from 'react';
import { FaArrowDown, FaArrowUp } from 'react-icons/fa';

import {
  COLLECTION_STATUSES,
  SORTING_FIELD_DEFINITIONS,
} from '../constants/appDefaults';

/**
 * Builds preference-related filter labels.
 * @param {Object} options - Preference options
 * @param {Function} pushLabel - Function to add labels
 */
const buildPreferenceLabels = (options, pushLabel) => {
  pushLabel(options.includeExpansions, 'includeExpansions', 'Include expansions');
  pushLabel(options.groupExpansions, 'groupExpansions', 'Group expansions');
  pushLabel(options.respectSortOrder, 'respectSortOrder', 'Respect sorting order');
  pushLabel(options.optimizeSpace, 'optimizeSpace', 'Optimize for space');
  pushLabel(options.fitOversized, 'fitOversized', 'Fit oversized games');
  pushLabel(options.bypassVersionWarning, 'bypassVersionWarning', 'Bypass version warning');
  pushLabel(options.stacking === 'horizontal', 'horizontalStacking', 'Horizontal stacking');
  pushLabel(options.lockRotation, 'lockRotation', 'Lock rotation');
};

/**
 * Builds collection status filter labels.
 * @param {Object} options - Collection status options
 * @param {Function} pushLabel - Function to add labels
 */
const buildCollectionStatusLabels = (options, pushLabel) => {
  if (options.includeStatusList.length > 0) {
    const includeLabels = options.includeStatusList
      .map((statusKey) => COLLECTION_STATUSES.find((status) => status.key === statusKey)?.label)
      .filter(Boolean);
    const showIncludeLabel =
      includeLabels.length > 0 &&
      !(options.includeStatusList.length === 1 && options.includeStatusList[0] === 'own');

    if (showIncludeLabel) {
      pushLabel(true, 'collectionInclude', `Include: ${includeLabels.join(', ')}`);
    }
  }

  if (options.excludeStatusList.length > 0) {
    const excludeLabels = options.excludeStatusList
      .map((statusKey) => COLLECTION_STATUSES.find((status) => status.key === statusKey)?.label)
      .filter(Boolean);
    if (excludeLabels.length > 0) {
      pushLabel(true, 'collectionExclude', `Exclude: ${excludeLabels.join(', ')}`);
    }
  }
};

/**
 * Builds sorting-related filter labels.
 * @param {Object} options - Sorting options
 * @param {Function} pushLabel - Function to add labels
 */
const buildSortingLabels = (options, pushLabel) => {
  if (options.optimizeSpace) {
    return;
  }

  const enabledSortingRules = [];
  const disabledDefaultLabels = [];

  options.sorting.forEach((rule) => {
    const fieldDef = SORTING_FIELD_DEFINITIONS.find((f) => f.field === rule.field);
    const defaultConfig = fieldDef
      ? { field: fieldDef.field, enabled: fieldDef.defaultEnabled, order: fieldDef.defaultOrder }
      : null;
    const baseLabel = fieldDef?.label || rule.field;
    const ArrowIcon = rule.order === 'desc' ? FaArrowDown : FaArrowUp;

    if (rule.enabled) {
      enabledSortingRules.push({
        field: rule.field,
        label: baseLabel,
        Icon: ArrowIcon,
        order: rule.order,
      });
    } else if (defaultConfig?.enabled) {
      disabledDefaultLabels.push(baseLabel);
    }
  });

  if (enabledSortingRules.length > 0) {
    pushLabel(true, 'sorting:enabled', (
      <span className="sorting-badge-content">
        Sorting:{' '}
        {enabledSortingRules.map((rule, index) => (
          <React.Fragment key={`${rule.field}-${rule.order}`}>
            <span className="sorting-entry">
              {rule.label}{' '}
              <rule.Icon aria-hidden="true" className="sorting-badge-icon" />
            </span>
            {index < enabledSortingRules.length - 1 && (
              <span className="sorting-separator">, </span>
            )}
          </React.Fragment>
        ))}
      </span>
    ));
  }

  if (disabledDefaultLabels.length > 0) {
    pushLabel(
      true,
      'sorting:disabled-defaults',
      `Sorting rule disabled: ${disabledDefaultLabels.join(', ')}`
    );
  }
};

/**
 * Builds all active filter labels from options.
 * @param {Object} options - All filter options
 * @returns {Array} Array of label objects
 */
const buildActiveFilterLabels = (options) => {
  const labels = [];

  const pushLabel = (condition, key, content) => {
    if (condition) {
      labels.push({ key, content });
    }
  };

  buildPreferenceLabels(options, pushLabel);
  buildCollectionStatusLabels(options, pushLabel);
  buildSortingLabels(options, pushLabel);

  return labels;
};

const useActiveFilterBadges = (options) => {
  const activeFilterLabels = useMemo(() => buildActiveFilterLabels(options), [options]);
  const activeFilterCount = activeFilterLabels.length;

  const { headerBadgeTags, headerBadgeOverflow } = useMemo(() => {
    const limit = Number.isFinite(options.collapsedBadgeLimit)
      ? options.collapsedBadgeLimit
      : 0;

    if (activeFilterLabels.length === 0 || limit <= 0) {
      return { headerBadgeTags: [], headerBadgeOverflow: 0 };
    }

    const limited = activeFilterLabels.slice(0, limit);
    const overflow = Math.max(0, activeFilterLabels.length - limited.length);

    return { headerBadgeTags: limited, headerBadgeOverflow: overflow };
  }, [activeFilterLabels, options.collapsedBadgeLimit]);

  return {
    activeFilterLabels,
    activeFilterCount,
    headerBadgeTags,
    headerBadgeOverflow,
  };
};

export default useActiveFilterBadges;

