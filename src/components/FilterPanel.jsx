import React from 'react';
import { FaChevronRight } from 'react-icons/fa';

function FilterPanel({ panelKey, title, collapsed = false, onToggle, children }) {
  const sectionClassName = `filter-panel ${collapsed ? 'filter-panel--collapsed' : ''}`;
  const panelId = `filter-panel-${panelKey}`;

  return (
    <section className={sectionClassName}>
      <button
        type="button"
        className="filter-panel__header"
        onClick={onToggle}
        aria-expanded={!collapsed}
        aria-controls={panelId}
      >
        <span className="filter-panel__chevron" aria-hidden="true">
          <FaChevronRight className="filter-panel__chevron-icon" />
        </span>
        <span className="filter-panel__title">{title}</span>
      </button>
      <div className="filter-panel__body" id={panelId} hidden={collapsed}>
        <span className="filter-panel__print-title">{title}</span>
        {children}
      </div>
    </section>
  );
}

export default FilterPanel;

