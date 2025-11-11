import React, { useEffect, useMemo, useRef } from 'react';
import { FaChevronDown, FaChevronRight } from 'react-icons/fa';

import useActiveFilterBadges from '../../hooks/useActiveFilterBadges.jsx';
import FilterControls from './FilterControls';

const SearchPanel = ({
  formRef,
  loading,
  onSubmit,
  username,
  onUsernameChange,
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
  filtersCollapsed,
  onToggleFiltersCollapsed,
  isFilterDrawerOpen,
  onRequestCloseDrawer,
  isMobileLayout,
  collapsedBadgeLimit,
  includeExpansions,
  groupExpansions,
  groupSeries,
  respectSortOrder,
  fitOversized,
  bypassVersionWarning,
  lockRotation,
  shouldShowInlineUsername,
}) => {
  const headerRef = useRef(null);
  const filterDrawerCloseRef = useRef(null);

  const badgeOptions = useMemo(
    () => ({
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
      collapsedBadgeLimit,
    }),
    [
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
      collapsedBadgeLimit,
    ]
  );

  const { activeFilterCount, headerBadgeTags, headerBadgeOverflow } =
    useActiveFilterBadges(badgeOptions);

  const searchPanelBodyId = isMobileLayout ? 'filter-drawer' : 'search-panel-content';
  const isPanelCollapsed = isMobileLayout ? !isFilterDrawerOpen : filtersCollapsed;

  const focusHeader = () => {
    headerRef.current?.focus();
  };

  const handleHeaderClick = (event) => {
    if (loading) {
      return;
    }

    const target = event?.target;
    if (
      target instanceof Element &&
      (target.closest('.search-panel-submit') ||
        target.closest('.search-panel-actions') ||
        target.closest('.username-field'))
    ) {
      return;
    }

    onToggleFiltersCollapsed();
  };

  const handleHeaderKeyDown = (event) => {
    if (loading) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onToggleFiltersCollapsed();
    }
  };

  const handleCloseDrawer = () => {
    onRequestCloseDrawer();
    focusHeader();
  };

  useEffect(() => {
    if (!isFilterDrawerOpen) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleCloseDrawer();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFilterDrawerOpen]);

  useEffect(() => {
    if (isFilterDrawerOpen) {
      filterDrawerCloseRef.current?.focus();
    }
  }, [isFilterDrawerOpen]);

  return (
    <section className={`card search-panel ${isPanelCollapsed ? 'collapsed' : ''}`}>
      <form ref={formRef} onSubmit={onSubmit} className="search-panel-form">
        <div
          className={`search-panel-header ${isPanelCollapsed ? 'is-collapsed' : ''} ${
            loading ? 'is-disabled' : ''
          }`}
          role="button"
          tabIndex={loading ? -1 : 0}
          aria-expanded={!isPanelCollapsed}
          aria-controls={searchPanelBodyId}
          onClick={handleHeaderClick}
          onKeyDown={handleHeaderKeyDown}
          title={isPanelCollapsed ? 'Show search options' : 'Hide search options'}
          ref={headerRef}
        >
          <div className="search-panel-primary">
            <div className="search-panel-toggle">
              <span className="disclosure-arrow search-panel-icon" aria-hidden="true">
                {isPanelCollapsed ? (
                  <FaChevronRight className="disclosure-arrow-icon" />
                ) : (
                  <FaChevronDown className="disclosure-arrow-icon" />
                )}
              </span>
              <span className="search-panel-label">
                <strong className="search-panel-title">Options</strong>
                {activeFilterCount > 0 && (
                  <span className="search-panel-count" aria-label={`${activeFilterCount} active filters`}>
                    {activeFilterCount}
                  </span>
                )}
              </span>
            </div>
            {shouldShowInlineUsername && (
              <div className="username-field username-field--inline">
                <label htmlFor="username-inline">BoardGameGeek Username</label>
                <input
                  type="text"
                  id="username-inline"
                  value={username}
                  onChange={(event) => onUsernameChange(event.target.value)}
                  placeholder="Enter your BGG username"
                  disabled={loading}
                />
              </div>
            )}
            <div className="search-panel-actions">
              <button
                type="submit"
                className="search-panel-submit"
                disabled={loading || !hasIncludeStatuses}
                title={
                  !hasIncludeStatuses
                    ? 'Select at least one collection status to organize'
                    : undefined
                }
              >
                {loading ? 'Processing...' : 'Organize Collection'}
              </button>
            </div>
          </div>
          {activeFilterCount > 0 && collapsedBadgeLimit > 0 && (
            <div className="search-panel-tags" aria-label="Active filters">
              {headerBadgeTags.map(({ key, content }) => (
                <span key={key} className="search-panel-tag">
                  {content}
                </span>
              ))}
              {headerBadgeOverflow > 0 && (
                <span key="filter-overflow" className="search-panel-tag">
                  + {headerBadgeOverflow} more
                </span>
              )}
            </div>
          )}
        </div>

        {!isMobileLayout && (
          <div className="search-panel-body" id="search-panel-content">
            <FilterControls
              username={username}
              onUsernameChange={onUsernameChange}
              loading={loading}
              onResetSettings={onResetSettings}
              hasIncludeStatuses={hasIncludeStatuses}
              filterPanelsCollapsed={filterPanelsCollapsed}
              onTogglePanel={onTogglePanel}
              stacking={stacking}
              onStackingChange={onStackingChange}
              preferenceState={preferenceState}
              collectionFilters={collectionFilters}
              onCollectionFilterChange={onCollectionFilterChange}
        includeStatusList={includeStatusList}
        excludeStatusList={excludeStatusList}
        sorting={sorting}
        onSortingChange={onSortingChange}
              optimizeSpace={optimizeSpace}
            />
          </div>
        )}

        {isMobileLayout && (
          <>
            <div
              className={`filter-drawer-backdrop ${isFilterDrawerOpen ? 'is-visible' : ''}`}
              onClick={handleCloseDrawer}
              aria-hidden="true"
            />
            <div
              className={`filter-drawer ${isFilterDrawerOpen ? 'is-open' : ''}`}
              role="dialog"
              aria-modal={isFilterDrawerOpen}
              aria-hidden={!isFilterDrawerOpen}
              aria-labelledby="filter-drawer-title"
              id="filter-drawer"
            >
              <div className="filter-drawer__header">
                <h2 id="filter-drawer-title">Options</h2>
                <button
                  type="button"
                  className="filter-drawer__close"
                  onClick={handleCloseDrawer}
                  ref={filterDrawerCloseRef}
                >
                  Close
                </button>
              </div>
              <div className="filter-drawer__body">
                <FilterControls
                  username={username}
                  onUsernameChange={onUsernameChange}
                  loading={loading}
                  onResetSettings={onResetSettings}
                  hasIncludeStatuses={hasIncludeStatuses}
                  filterPanelsCollapsed={filterPanelsCollapsed}
                  onTogglePanel={onTogglePanel}
                  stacking={stacking}
                  onStackingChange={onStackingChange}
                  preferenceState={preferenceState}
                  collectionFilters={collectionFilters}
                  onCollectionFilterChange={onCollectionFilterChange}
                  includeStatusList={includeStatusList}
                  excludeStatusList={excludeStatusList}
                  sorting={sorting}
                  onSortingChange={onSortingChange}
                  optimizeSpace={optimizeSpace}
                />
              </div>
              <div className="filter-drawer__footer">
                <button
                  type="submit"
                  className="filter-drawer__submit search-panel-submit"
                  disabled={loading || !hasIncludeStatuses}
                  title={
                    !hasIncludeStatuses
                      ? 'Select at least one collection status to organize'
                      : undefined
                  }
                >
                  {loading ? 'Processing...' : 'Organize Collection'}
                </button>
              </div>
            </div>
          </>
        )}
      </form>
    </section>
  );
};

export default SearchPanel;

