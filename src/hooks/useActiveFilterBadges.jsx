import React, { useMemo } from 'react';
import { FaArrowDown, FaArrowUp } from 'react-icons/fa';

import {
  COLLECTION_STATUSES,
  DEFAULT_PRIORITIES_BY_FIELD,
  PRIORITY_LABELS,
} from '../constants/appDefaults';

const buildActiveFilterLabels = ({
  includeExpansions,
  groupExpansions,
  groupSeries,
  respectSortOrder,
  optimizeSpace,
  fitOversized,
  bypassVersionWarning,
  verticalStacking,
  lockRotation,
  priorities,
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
  pushLabel(respectSortOrder, 'respectSortOrder', 'Respect priority order');
  pushLabel(optimizeSpace, 'optimizeSpace', 'Optimize for space');
  pushLabel(fitOversized, 'fitOversized', 'Fit oversized games');
  pushLabel(bypassVersionWarning, 'bypassVersionWarning', 'Bypass version warning');
  pushLabel(!verticalStacking, 'horizontalStacking', 'Horizontal stacking');
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
    const enabledPriorities = [];
    const disabledDefaultLabels = [];

    priorities.forEach((priority) => {
      const defaultConfig = DEFAULT_PRIORITIES_BY_FIELD[priority.field];
      const baseLabel = PRIORITY_LABELS[priority.field] || priority.field;
      const ArrowIcon = priority.order === 'desc' ? FaArrowDown : FaArrowUp;

      if (priority.enabled) {
        enabledPriorities.push({
          field: priority.field,
          label: baseLabel,
          Icon: ArrowIcon,
          order: priority.order,
        });
      } else if (defaultConfig?.enabled) {
        disabledDefaultLabels.push(baseLabel);
      }
    });

    if (enabledPriorities.length > 0) {
      pushLabel(true, 'priority:enabled', (
        <span className="priority-badge-content">
          Priority:{' '}
          {enabledPriorities.map((priority, index) => (
            <React.Fragment key={`${priority.field}-${priority.order}`}>
              <span className="priority-entry">
                {priority.label}{' '}
                <priority.Icon aria-hidden="true" className="priority-badge-icon" />
              </span>
              {index < enabledPriorities.length - 1 && (
                <span className="priority-separator">, </span>
              )}
            </React.Fragment>
          ))}
        </span>
      ));
    }

    if (disabledDefaultLabels.length > 0) {
      pushLabel(
        true,
        'priority:disabled-defaults',
        `Priority disabled: ${disabledDefaultLabels.join(', ')}`
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

