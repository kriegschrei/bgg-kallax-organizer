import React from 'react';

function OverridesSection({
  expanded,
  onToggle,
  renderToggleIcon,
  icon,
  title,
  count,
  description,
  children,
  wrapperClassName = 'callout callout--manual',
  headerClassName = 'callout__header',
  contentClassName = 'callout__content',
  descriptionClassName = 'callout__description',
  listClassName,
}) {
  const toggleIcon = renderToggleIcon ? renderToggleIcon(expanded) : null;

  return (
    <div className={wrapperClassName}>
      <button className={headerClassName} onClick={onToggle} aria-expanded={expanded}>
        {toggleIcon}
        <strong>
          {icon}
          {title} ({count})
        </strong>
      </button>
      {expanded && (
        <div className={contentClassName}>
          {description ? <p className={descriptionClassName}>{description}</p> : null}
          {listClassName ? <ul className={listClassName}>{children}</ul> : children}
        </div>
      )}
    </div>
  );
}

export default OverridesSection;
