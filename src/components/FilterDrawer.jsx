import React, { useEffect, useRef } from 'react';
import FilterControls from './SearchPanel/FilterControls';

/**
 * Mobile filter drawer component that slides in from the bottom.
 * Provides a full-screen modal experience for filter controls on mobile devices.
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether the drawer is open
 * @param {Function} props.onClose - Handler for closing the drawer
 * @param {Function} props.onFocusHeader - Handler to focus the header after closing
 * @param {Object} props.filterControlsProps - Props to pass to FilterControls component
 */
export default function FilterDrawer({ isOpen, onClose, onFocusHeader, filterControlsProps }) {
  const closeRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        onFocusHeader();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, onFocusHeader]);

  useEffect(() => {
    if (isOpen) {
      closeRef.current?.focus();
    }
  }, [isOpen]);

  const handleClose = () => {
    onClose();
    onFocusHeader();
  };

  return (
    <>
      <div
        className={`filter-drawer-backdrop ${isOpen ? 'is-visible' : ''}`}
        onClick={handleClose}
        aria-hidden="true"
      />
      <div
        className={`filter-drawer ${isOpen ? 'is-open' : ''}`}
        role="dialog"
        aria-modal={isOpen}
        aria-hidden={!isOpen}
        aria-labelledby="filter-drawer-title"
        id="filter-drawer"
      >
        <div className="filter-drawer__header">
          <h2 id="filter-drawer-title">Options</h2>
          <button
            type="button"
            className="filter-drawer__close"
            onClick={handleClose}
            ref={closeRef}
          >
            Close
          </button>
        </div>
        <div className="filter-drawer__body">
          <FilterControls {...filterControlsProps} />
        </div>
        <div className="filter-drawer__footer">
          <button
            type="submit"
            className="filter-drawer__submit search-panel-submit"
            disabled={filterControlsProps.loading || !filterControlsProps.hasIncludeStatuses}
            title={
              !filterControlsProps.hasIncludeStatuses
                ? 'Select at least one collection status to organize'
                : undefined
            }
          >
            {filterControlsProps.loading ? 'Processing...' : 'Organize Collection'}
          </button>
        </div>
      </div>
    </>
  );
}

