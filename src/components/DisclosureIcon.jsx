import React from 'react';
import { FaChevronRight, FaChevronDown } from 'react-icons/fa';

/**
 * Reusable disclosure icon component that shows chevron right when collapsed
 * and chevron down when expanded.
 * @param {boolean} expanded - Whether the disclosure is expanded
 * @param {string} className - Optional additional CSS class name
 */
export default function DisclosureIcon({ expanded, className = '' }) {
  return (
    <span className={`disclosure-arrow ${className}`}>
      {expanded ? (
        <FaChevronDown className="disclosure-arrow-icon" aria-hidden="true" />
      ) : (
        <FaChevronRight className="disclosure-arrow-icon" aria-hidden="true" />
      )}
    </span>
  );
}

