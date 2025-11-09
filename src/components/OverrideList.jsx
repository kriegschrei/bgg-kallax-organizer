import React from 'react';

function OverrideList({ items, renderActions, showDimensions = false }) {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  return (
    <>
      {items.map((item) => (
        <li key={item.id} className="override-list-item">
          <div className="override-entry-row">
            <span className="override-entry-name">{item.name}</span>
            <div className="override-entry-actions">
              {showDimensions ? <span className="override-pill">{item.dimensions}</span> : null}
              {renderActions(item)}
            </div>
          </div>
          {item.extraContent}
        </li>
      ))}
    </>
  );
}

export default OverrideList;

