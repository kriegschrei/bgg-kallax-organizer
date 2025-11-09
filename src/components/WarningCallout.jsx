import React from 'react';
import CollapsibleCallout from './CollapsibleCallout';

function WarningCallout({
  variant = 'warning',
  expanded,
  onToggle,
  renderToggleIcon,
  icon,
  title,
  count,
  description,
  items,
}) {
  return (
    <CollapsibleCallout
      variant={variant}
      expanded={expanded}
      onToggle={onToggle}
      renderToggleIcon={renderToggleIcon}
      icon={icon}
      title={title}
      count={count}
    >
      {description ? <div className="callout__description">{description}</div> : null}
      {items}
    </CollapsibleCallout>
  );
}

export default WarningCallout;

