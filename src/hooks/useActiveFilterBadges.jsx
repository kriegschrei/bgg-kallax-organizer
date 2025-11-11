import React, { useMemo } from 'react';
import { FaArrowDown, FaArrowUp } from 'react-icons/fa';

import {
  COLLECTION_STATUSES,
  DEFAULT_SORTING_BY_FIELD,
  SORTING_LABELS,
} from '../constants/appDefaults';

const buildActiveFilterLabels = ({
  includeExpansions,
  groupExpansions,
  groupSeries,
  respectSortOrder,
  optimizeSpace,
  fitOversized,
  bypassVersionWarning,
  stacking,
  lockRotation,
  sorting,
  includeStatusList,
  excludeStatusList,
}) => {
  const labels = [];

  const pushLabel = (condition, key, content) => {
    if (condition) {
      labels.push({ key, content });
    }
  };

  pushLabel(includeExpansions, 'includeExpansions', 'Include expansions');
  pushLabel(groupExpansions, 'groupExpansions', 'Group expansions');
  pushLabel(groupSeries, 'groupSeries', 'Group series');
  pushLabel(respectSortOrder, 'respectSortOrder', 'Respect sorting order');
  pushLabel(optimizeSpace, 'optimizeSpace', 'Optimize for space');
  pushLabel(fitOversized, 'fitOversized', 'Fit oversized games');
  pushLabel(bypassVersionWarning, 'bypassVersionWarning', 'Bypass version warning');
  pushLabel(stacking === 'horizontal', 'horizontalStacking', 'Horizontal stacking');
  pushLabel(lockRotation, 'lockRotation', 'Lock rotation');

  if (includeStatusList.length > 0) {
    const includeLabels = includeStatusList
      .map((statusKey) => COLLECTION_STATUSES.find((status) => status.key === statusKey)?.label)
      .filter(Boolean);
    const showIncludeLabel =
      includeLabels.length > 0 && !(includeStatusList.length === 1 && includeStatusList[0] === 'own');

    if (showIncludeLabel) {
      pushLabel(true, 'collectionInclude', `Include: ${includeLabels.join(', ')}`);
    }
  }

  if (excludeStatusList.length > 0) {
    const excludeLabels = excludeStatusList
      .map((statusKey) => COLLECTION_STATUSES.find((status) => status.key === statusKey)?.label)
      .filter(Boolean);
    if (excludeLabels.length > 0) {
      pushLabel(true, 'collectionExclude', `Exclude: ${excludeLabels.join(', ')}`);
    }
  }

  if (!optimizeSpace) {
    const enabledSortingRules = [];
    const disabledDefaultLabels = [];

    sorting.forEach((rule) => {
      const defaultConfig = DEFAULT_SORTING_BY_FIELD[rule.field];
      const baseLabel = SORTING_LABELS[rule.field] || rule.field;
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
  }

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

