import React from 'react';
import { COLLECTION_STATUSES, SORTING_FIELD_DEFINITIONS } from '../constants/appDefaults';
import './PrintOptionsPanel.css';

/**
 * Print-friendly options panel showing preferences, collections, and sorting.
 * Only visible in print mode.
 */
function PrintOptionsPanel({
  stacking,
  optimizeSpace,
  includeExpansions,
  groupExpansions,
  groupSeries,
  backfillPercentage,
  fitOversized,
  bypassVersionWarning,
  lockRotation,
  collectionFilters,
  sorting,
}) {
  const enabledSortingRules = sorting.filter((rule) => rule.enabled);

  return (
    <div className="print-options-panel">
      <div className="print-options-section">
        <h4 className="print-options-title">Preferences</h4>
        <div className="print-options-list">
          <div className="print-option-item">
            <strong>Stacking:</strong> {stacking === 'horizontal' ? 'Horizontal' : 'Vertical'}
          </div>
          {optimizeSpace && (
            <div className="print-option-item">
              <strong>Optimize for space:</strong> Enabled
            </div>
          )}
          {includeExpansions && (
            <div className="print-option-item">
              <strong>Include expansions:</strong> Enabled
            </div>
          )}
          {groupExpansions && (
            <div className="print-option-item">
              <strong>Group expansions with base game:</strong> Enabled
            </div>
          )}
          {fitOversized && (
            <div className="print-option-item">
              <strong>Fit oversized games:</strong> Enabled
            </div>
          )}
          {lockRotation && (
            <div className="print-option-item">
              <strong>Lock rotation:</strong> Enabled
            </div>
          )}
          {typeof backfillPercentage === 'number' && (
            <div className="print-option-item">
              <strong>Backfill tolerance:</strong> {backfillPercentage}%
            </div>
          )}
          {bypassVersionWarning && (
            <div className="print-option-item">
              <strong>Bypass version warning:</strong> Enabled
            </div>
          )}
        </div>
      </div>

      <div className="print-options-section">
        <h4 className="print-options-title">Collections</h4>
        <div className="print-options-list">
          {COLLECTION_STATUSES.map((status) => {
            const filterValue = collectionFilters?.[status.key];
            if (filterValue === 'include') {
              return (
                <div key={status.key} className="print-option-item">
                  <strong>{status.label}:</strong> Include
                </div>
              );
            } else if (filterValue === 'exclude') {
              return (
                <div key={status.key} className="print-option-item">
                  <strong>{status.label}:</strong> Exclude
                </div>
              );
            }
            return null;
          })}
        </div>
      </div>

      {enabledSortingRules.length > 0 && (
        <div className="print-options-section">
          <h4 className="print-options-title">Sorting</h4>
          <div className="print-options-list">
            {enabledSortingRules.map((rule, index) => {
              const orderLabel = rule.order === 'asc' ? 'Ascending' : 'Descending';
              const fieldDef = SORTING_FIELD_DEFINITIONS.find((def) => def.field === rule.field);
              const fieldLabel = fieldDef?.label || rule.field;
              return (
                <div key={rule.field || index} className="print-option-item">
                  <strong>{index + 1}.</strong> {fieldLabel} ({orderLabel})
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default PrintOptionsPanel;

