import React from 'react';
import DimensionInput from './DimensionInput';
import { useUnitPreference } from '../contexts/UnitPreferenceContext';

function DimensionForm({
  className,
  gridClassName,
  errorClassName,
  actionsClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  values,
  error,
  disabled,
  onChange,
  onSubmit,
  onCancel,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
}) {
  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit?.();
  };

  const handleFieldChange = (field) => (event) => {
    onChange?.(field, event.target.value);
  };

  const { isMetric } = useUnitPreference();
  const unitLabel = isMetric ? 'cm' : 'in';
  
  const dimensionFields = [
    { key: 'length', label: `Length (${unitLabel})` },
    { key: 'width', label: `Width (${unitLabel})` },
    { key: 'depth', label: `Depth (${unitLabel})` },
  ];

  return (
    <form className={className} onSubmit={handleSubmit}>
      <div className={gridClassName}>
        {dimensionFields.map(({ key, label }) => (
          <DimensionInput
            key={key}
            id={`dimension-${key}`}
            name={key}
            label={label}
            value={values?.[key] ?? ''}
            onChange={handleFieldChange(key)}
            disabled={disabled}
          />
        ))}
      </div>
      {error ? <p className={errorClassName}>{error}</p> : null}
      <div className={actionsClassName}>
        <button type="submit" className={primaryButtonClassName} disabled={disabled}>
          {submitLabel}
        </button>
        <button type="button" className={secondaryButtonClassName} onClick={onCancel}>
          {cancelLabel}
        </button>
      </div>
    </form>
  );
}

export default DimensionForm;
