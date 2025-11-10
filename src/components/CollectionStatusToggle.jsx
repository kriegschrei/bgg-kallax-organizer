import React, { useCallback } from 'react';
import { FaCheck, FaTimes, FaMinus } from 'react-icons/fa';
import './CollectionStatusToggle.css';

const STATE_SEQUENCE = ['include', 'exclude', 'neutral'];

const STATE_CONFIG = {
  include: {
    label: 'Include',
    Icon: FaCheck,
    className: 'collection-status-toggle--include',
  },
  exclude: {
    label: 'Exclude',
    Icon: FaTimes,
    className: 'collection-status-toggle--exclude',
  },
  neutral: {
    label: 'Neutral',
    Icon: FaMinus,
    className: 'collection-status-toggle--neutral',
  },
};

function getNextState(current) {
  const safeCurrent = STATE_SEQUENCE.includes(current) ? current : 'neutral';
  const nextIndex = (STATE_SEQUENCE.indexOf(safeCurrent) + 1) % STATE_SEQUENCE.length;
  return STATE_SEQUENCE[nextIndex];
}

const CollectionStatusToggle = ({
  label,
  value = 'neutral',
  onChange,
  disabled = false,
}) => {
  const handleClick = useCallback(() => {
    if (disabled) {
      return;
    }
    const nextState = getNextState(value);
    onChange?.(nextState);
  }, [disabled, onChange, value]);

  const safeValue = STATE_SEQUENCE.includes(value) ? value : 'neutral';
  const { Icon, className } = STATE_CONFIG[safeValue];

  return (
    <button
      type="button"
      className={`collection-status-toggle ${className}`}
      onClick={handleClick}
      disabled={disabled}
      aria-pressed={safeValue !== 'neutral'}
      aria-label={`${label}: ${STATE_CONFIG[safeValue].label}`}
    >
      <span className="collection-status-toggle__icon">
        <Icon aria-hidden="true" />
      </span>
      <span className="collection-status-toggle__label">{label}</span>
    </button>
  );
};

export default CollectionStatusToggle;

