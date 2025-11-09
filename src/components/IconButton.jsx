import React from 'react';

function IconButton({
  type = 'button',
  icon,
  srLabel,
  children,
  className = '',
  iconPosition = 'start',
  ...buttonProps
}) {
  const renderIcon = () => {
    if (!icon) {
      return null;
    }

    if (React.isValidElement(icon)) {
      return icon;
    }

    const IconComponent = icon;
    return <IconComponent />;
  };

  const iconElement = renderIcon();

  return (
    <button type={type} className={className} {...buttonProps}>
      {iconPosition === 'start' && iconElement}
      {children}
      {iconPosition === 'end' && iconElement}
      {srLabel ? <span className="sr-only">{srLabel}</span> : null}
    </button>
  );
}

export default IconButton;
