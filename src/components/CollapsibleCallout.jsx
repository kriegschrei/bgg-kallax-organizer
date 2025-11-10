import React from 'react';

function CollapsibleCallout({
  variant = 'warning',
  expanded,
  onToggle,
  renderToggleIcon,
  icon,
  title,
  count,
  children,
}) {
  const wrapperClassName =
    variant && variant !== 'warning' ? `callout callout--${variant}` : 'callout';
  const toggleIcon = renderToggleIcon ? renderToggleIcon(expanded) : null;

  return (
    <div className={wrapperClassName}>
      <button type="button" className="callout__header" onClick={onToggle} aria-expanded={expanded}>
        {toggleIcon}
        <strong>
          {icon}
          {title} ({count})
        </strong>
      </button>
      {expanded && <div className="callout__content">{children}</div>}
    </div>
  );
}

export default CollapsibleCallout;

