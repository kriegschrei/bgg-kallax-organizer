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
  className,
}) {
  const baseClassName = variant && variant !== 'warning' ? `callout callout--${variant}` : 'callout';
  const wrapperClassName = className ? `${baseClassName} ${className}` : baseClassName;
  const toggleIcon = renderToggleIcon ? renderToggleIcon(expanded) : null;

  // Always render content for oversized panel (CSS will control visibility in print)
  const isOversizedPanel = className?.includes('warning-callout--oversized');
  const shouldRenderContent = expanded || isOversizedPanel;
  
  return (
    <div className={wrapperClassName} aria-expanded={expanded}>
      <button type="button" className="callout__header" onClick={onToggle} aria-expanded={expanded}>
        {toggleIcon}
        <strong>
          {icon}
          {title} ({count})
        </strong>
      </button>
      {shouldRenderContent && <div className="callout__content">{children}</div>}
    </div>
  );
}

export default CollapsibleCallout;

