
import React from 'react';
import CollapsibleCallout from './CollapsibleCallout';
import { getScrollableListClassName } from '../utils/results';

function WarningCallout({
  variant = 'warning',
  expanded,
  onToggle,
  renderToggleIcon,
  icon,
  title,
  count,
  description,
  items = [],
  renderItem,
  children,
  className,
}) {
  const hasList =
    Array.isArray(items) && items.length > 0 && typeof renderItem === 'function';

  return (
    <CollapsibleCallout
      variant={variant}
      expanded={expanded}
      onToggle={onToggle}
      renderToggleIcon={renderToggleIcon}
      icon={icon}
      title={title}
      count={count}
      className={className}
    >
      {description ? <div className="callout__description">{description}</div> : null}
      {children}
      {hasList ? (
        <ul className={getScrollableListClassName(items.length)}>
          {items.map((item, index) => (
            <li key={item?.id ?? index}>{renderItem(item, index)}</li>
          ))}
        </ul>
      ) : null}
    </CollapsibleCallout>
  );
}

export default WarningCallout;

