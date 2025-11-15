import React from 'react';

function DimensionInput({ label, value, onChange, disabled = false, id, name }) {
  return (
    <label htmlFor={id}>
      {label}
      <input
        type="number"
        id={id}
        name={name}
        step="0.01"
        min="0.01"
        value={value}
        onChange={onChange}
        required
        disabled={disabled}
        autoComplete="off"
      />
    </label>
  );
}

export default DimensionInput;

