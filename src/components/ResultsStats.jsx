import React from 'react';

export default function ResultsStats({ items }) {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  return (
    <div className="stats-summary card">
      {items.map(({ label, value }) => (
        <div key={label} className="stat">
          <span className="stat-value">{value}</span>
          <span className="stat-label">{label}</span>
        </div>
      ))}
    </div>
  );
}


