import React from 'react';
import DimensionInput from './DimensionInput';

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

  const dimensionFields = [
    { key: 'length', label: 'Length (in)' },
    { key: 'width', label: 'Width (in)' },
    { key: 'depth', label: 'Depth (in)' },
  ];

  return (
    <form className={className} onSubmit={handleSubmit}>
      <div className={gridClassName}>
        {dimensionFields.map(({ key, label }) => (
          <DimensionInput
            key={key}
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
