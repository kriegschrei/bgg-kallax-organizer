import React, { useMemo } from 'react';
import { FaExclamationTriangle, FaUndoAlt } from 'react-icons/fa';

import FilterPanel from '../FilterPanel';
import IconButton from '../IconButton';
import SettingsToggleGroup from '../SettingsToggleGroup';
import CollectionStatusToggle from '../CollectionStatusToggle';
import Sorting from '../Sorting';
import { COLLECTION_STATUSES } from '../../constants/appDefaults';

const UserSettingsRow = ({ username, onUsernameChange, loading, onResetSettings }) => (
  <div className="options-row">
    <div className="username-field">
      <label htmlFor="username">BoardGameGeek Username</label>
      <input
        type="text"
        id="username"
        value={username}
        onChange={(event) => onUsernameChange(event.target.value)}
        placeholder="Enter your BGG username"
        disabled={loading}
      />
    </div>
    <div className="options-actions">
      <IconButton
        className="reset-settings-button"
        onClick={onResetSettings}
        disabled={loading}
        title="Restore all search options to their default values"
        icon={<FaUndoAlt aria-hidden="true" className="button-icon" />}
      >
        <span>Reset settings</span>
      </IconButton>
    </div>
  </div>
);

const CollectionFiltersWarning = ({ isVisible }) =>
  !isVisible ? (
    <div className="collection-filters-warning" role="alert">
      <FaExclamationTriangle aria-hidden="true" className="collection-filters-warning__icon" />
      <span>Select at least one collection status to organize.</span>
    </div>
  ) : null;

const StackingToggle = ({ stacking, onStackingChange, disabled }) => (
  <div className="stacking-row">
    <span className="stacking-label">Stacking</span>
    <div className="toggle-button-group toggle-button-group--compact">
      <button
        type="button"
        className={`toggle-button ${stacking === 'horizontal' ? 'active' : ''}`}
        onClick={() => onStackingChange('horizontal')}
        disabled={disabled}
      >
        Horizontal
      </button>
      <button
        type="button"
        className={`toggle-button ${stacking === 'vertical' ? 'active' : ''}`}
        onClick={() => onStackingChange('vertical')}
        disabled={disabled}
      >
        Vertical
      </button>
    </div>
  </div>
);

const PreferencesPanel = ({
  collapsed,
  onToggle,
  stacking,
  onStackingChange,
  loading,
  preferenceState,
}) => {
  const toggles = useMemo(
    () => [
      {
        id: 'optimizeSpace',
        label: 'Optimize for space',
        checked: preferenceState.optimizeSpace,
        onChange: preferenceState.onOptimizeSpaceChange,
        disabled: loading,
        tooltip: 'Ignore all sorting preferences and pack games in as few cubes as possible',
      },
      {
        id: 'includeExpansions',
        label: 'Include expansions',
        checked: preferenceState.includeExpansions,
        onChange: preferenceState.onIncludeExpansionsChange,
        disabled: loading,
      },
      {
        id: 'groupExpansions',
        label: 'Group expansions with base game',
        checked: preferenceState.groupExpansions,
        onChange: preferenceState.onGroupExpansionsChange,
        disabled: loading || !preferenceState.includeExpansions || preferenceState.optimizeSpace,
        tooltip: 'Keep expansions with their base game in the same cube when possible',
      },
      {
        id: 'groupSeries',
        label: 'Group series',
        checked: preferenceState.groupSeries,
        onChange: preferenceState.onGroupSeriesChange,
        disabled: loading || preferenceState.optimizeSpace,
        tooltip: 'Keep games from the same series/family together in the same cube when possible',
      },
      {
        id: 'fitOversized',
        label: 'Fit oversized games',
        checked: preferenceState.fitOversized,
        onChange: preferenceState.onFitOversizedChange,
        disabled: loading,
        tooltip: 'Set oversized games dimension to 13 inches to fit in cubes',
      },
      {
        id: 'lockRotation',
        label: 'Lock rotation',
        checked: preferenceState.lockRotation,
        onChange: preferenceState.onLockRotationChange,
        disabled: loading,
        tooltip:
          'Disabled: Prefer stacking preference, may rotate some games to fit.\nEnabled: Force games to follow stacking preference',
      },
      {
        id: 'respectSortOrder',
        label: 'Respect sorting order',
        checked: preferenceState.respectSortOrder,
        onChange: preferenceState.onRespectSortOrderChange,
        disabled: loading || preferenceState.optimizeSpace,
        tooltip:
          'Games will not be backfilled to earlier cubes for better fit to match sorting preferences. May use more space.',
      },
      {
        id: 'bypassVersionWarning',
        label: 'Bypass version warning',
        checked: preferenceState.bypassVersionWarning,
        onChange: preferenceState.onBypassVersionWarningChange,
        disabled: loading,
        tooltip:
          'You will not be warned about missing versions or dimensions. This may result in incorrect data and longer processing times.',
        tooltipIcon: FaExclamationTriangle,
        tooltipIconClassName: 'warning-icon',
      },
    ],
    [loading, preferenceState]
  );

  return (
    <FilterPanel
      panelKey="preferences"
      title="Preferences"
      collapsed={Boolean(collapsed)}
      onToggle={onToggle}
    >
      <div className="preferences-panel">
        <StackingToggle
          stacking={stacking}
          onStackingChange={onStackingChange}
          disabled={loading}
        />
        <SettingsToggleGroup toggles={toggles} />
      </div>
    </FilterPanel>
  );
};

const CollectionsPanel = ({
  collapsed,
  onToggle,
  collectionFilters,
  onCollectionFilterChange,
  loading,
  includeStatusList,
  excludeStatusList,
}) => {
  const showHelper = includeStatusList.length > 1 || excludeStatusList.length > 0;

  return (
    <FilterPanel
      panelKey="collections"
      title="Collections"
      collapsed={Boolean(collapsed)}
      onToggle={onToggle}
    >
      <div className="collection-status-content">
        {showHelper && (
          <div className="collection-status-helper" role="note">
            Include matches any selected category. Exclude removes games with those categories.
          </div>
        )}
        <div className="collection-status-grid">
          {collectionFilters.map((item) => (
            <CollectionStatusToggle
              key={item.key}
              label={item.label}
              value={item.value}
              onChange={(nextState) => onCollectionFilterChange(item.key, nextState)}
              disabled={loading}
            />
          ))}
        </div>
      </div>
    </FilterPanel>
  );
};

const SortingPanel = ({ collapsed, onToggle, sorting, onSortingChange, optimizeSpace }) => (
  <FilterPanel
    panelKey="sorting"
    title="Sorting"
    collapsed={Boolean(collapsed)}
    onToggle={onToggle}
  >
    <Sorting
      sorting={sorting}
      onChange={onSortingChange}
      disabled={optimizeSpace}
    />
  </FilterPanel>
);

const normalizeCollectionFilters = (filtersByKey) =>
  COLLECTION_STATUSES.map((status) => ({
    key: status.key,
    label: status.label,
    value: filtersByKey[status.key],
  }));

const FilterControls = ({
  username,
  onUsernameChange,
  loading,
  onResetSettings,
  hasIncludeStatuses,
  filterPanelsCollapsed,
  onTogglePanel,
  stacking,
  onStackingChange,
  preferenceState,
  collectionFilters,
  onCollectionFilterChange,
  includeStatusList,
  excludeStatusList,
  sorting,
  onSortingChange,
  optimizeSpace,
}) => {
  const normalizedCollectionFilters = useMemo(
    () => normalizeCollectionFilters(collectionFilters),
    [collectionFilters]
  );

  return (
    <>
      <UserSettingsRow
        username={username}
        onUsernameChange={onUsernameChange}
        loading={loading}
        onResetSettings={onResetSettings}
      />

      <CollectionFiltersWarning isVisible={hasIncludeStatuses} />

      <div className="filter-panels-grid">
        <PreferencesPanel
          collapsed={filterPanelsCollapsed.preferences}
          onToggle={() => onTogglePanel('preferences')}
          stacking={stacking}
          onStackingChange={onStackingChange}
          loading={loading}
          preferenceState={preferenceState}
        />

        <CollectionsPanel
          collapsed={filterPanelsCollapsed.collections}
          onToggle={() => onTogglePanel('collections')}
          collectionFilters={normalizedCollectionFilters}
          onCollectionFilterChange={onCollectionFilterChange}
          loading={loading}
          includeStatusList={includeStatusList}
          excludeStatusList={excludeStatusList}
        />

        <SortingPanel
        collapsed={filterPanelsCollapsed.sorting}
        onToggle={() => onTogglePanel('sorting')}
        sorting={sorting}
        onSortingChange={onSortingChange}
          optimizeSpace={optimizeSpace}
        />
      </div>
    </>
  );
};

export default FilterControls;

