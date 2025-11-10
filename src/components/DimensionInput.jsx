import React from 'react';

function DimensionInput({ label, value, onChange, disabled = false }) {
  return (
    <label>
      {label}
      <input
        type="number"
        step="0.01"
        min="0.01"
        value={value}
        onChange={onChange}
        required
        disabled={disabled}
      />
    </label>
  );
}

export default DimensionInput;

