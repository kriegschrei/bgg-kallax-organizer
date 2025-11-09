import React from 'react';

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

  return (
    <form className={className} onSubmit={handleSubmit}>
      <div className={gridClassName}>
        <label>
          Length (in)
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={values.length}
            onChange={handleFieldChange('length')}
            required
          />
        </label>
        <label>
          Width (in)
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={values.width}
            onChange={handleFieldChange('width')}
            required
          />
        </label>
        <label>
          Depth (in)
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={values.depth}
            onChange={handleFieldChange('depth')}
            required
          />
        </label>
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
