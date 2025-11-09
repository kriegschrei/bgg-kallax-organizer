import React from 'react';
import ToggleSwitch from './ToggleSwitch';

function SettingsToggleGroup({ toggles, className = 'preferences-toggle-grid' }) {
  if (!Array.isArray(toggles) || toggles.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      {toggles.map(({ id, ...toggleProps }) => (
        <ToggleSwitch key={id} id={id} {...toggleProps} />
      ))}
    </div>
  );
}

export default SettingsToggleGroup;
