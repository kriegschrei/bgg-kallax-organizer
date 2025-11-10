import React from 'react';
import { FaInfoCircle } from 'react-icons/fa';

function TooltipTrigger({
  tooltip,
  icon,
  iconClassName = '',
  className = '',
  srLabel = 'More info',
  ...rest
}) {
  if (!tooltip) {
    return null;
  }

  const IconComponent = icon ?? FaInfoCircle;
  const iconElement = React.isValidElement(IconComponent)
    ? React.cloneElement(IconComponent, {
        'aria-hidden': true,
        className: `button-icon ${IconComponent.props.className ?? ''} ${iconClassName}`.trim(),
      })
    : (
        <IconComponent
          aria-hidden="true"
          className={`button-icon ${iconClassName}`.trim()}
        />
      );

  return (
    <span
      className={`tooltip-trigger ${className}`.trim()}
      data-tooltip={tooltip}
      {...rest}
    >
      {iconElement}
      <span className="sr-only">{srLabel}</span>
    </span>
  );
}

export default TooltipTrigger;
