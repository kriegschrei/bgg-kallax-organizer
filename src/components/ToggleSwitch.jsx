import React from 'react';
import { FaInfoCircle } from 'react-icons/fa';
import TooltipTrigger from './TooltipTrigger';
import './ToggleSwitch.css';

function ToggleSwitch({
  id,
  label,
  checked,
  onChange,
  disabled = false,
  tooltip,
  tooltipIcon: TooltipIcon = FaInfoCircle,
  tooltipIconClassName = '',
}) {
  const handleChange = (event) => {
    if (!disabled && onChange) {
      onChange(event.target.checked);
    }
  };

  return (
    <div className={`toggle-control${disabled ? ' is-disabled' : ''}`}>
      <div className="toggle-label">
        <label htmlFor={id} className="toggle-label-text">
          {label}
        </label>
        {tooltip && (
          <TooltipTrigger
            tooltip={tooltip}
            icon={TooltipIcon}
            iconClassName={tooltipIconClassName}
          />
        )}
      </div>
      <label className="toggle-switch" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={handleChange}
          disabled={disabled}
        />
        <span className="toggle-track">
          <span className="toggle-thumb" />
        </span>
      </label>
    </div>
  );
}

export default ToggleSwitch;

