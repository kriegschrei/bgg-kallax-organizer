import React from 'react';
import { FaArrowUp, FaArrowDown } from 'react-icons/fa';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import './Sorting.css';

const AVAILABLE_FIELDS = [
  { field: 'gameName', label: 'Game Name' },
  { field: 'bggRank', label: 'BGG Rank' },
  { field: 'bggWeight', label: 'BGG Weight (Complexity)' },
  { field: 'bggRating', label: 'BGG Rating' },
  { field: 'categories', label: 'Categories' },
  { field: 'families', label: 'Families (Themes) / Languages' },
  { field: 'mechanics', label: 'Mechanics' },
  { field: 'numplays', label: 'Number of Plays' },
  { field: 'versionName', label: 'Version Name' },
  { field: 'minPlayers', label: 'Min Players' },
  { field: 'maxPlayers', label: 'Max Players' },
  { field: 'bestPlayerCount', label: 'Best Player Count (Community)' },
  { field: 'minPlaytime', label: 'Min Playtime' },
  { field: 'maxPlaytime', label: 'Max Playtime' },
  { field: 'age', label: 'Minimum Age (Publisher)' },
  { field: 'communityAge', label: 'Minimum Recommended Community Age' },
  { field: 'languageDependence', label: 'Language Dependence' },
  { field: 'volume', label: 'Volume' },
  { field: 'area', label: 'Area' },
  { field: 'gamePublishedYear', label: 'Game Published Year' },
  { field: 'versionPublishedYear', label: 'Version Published Year' },
];

function SortableItem({ id, sortingRule, onToggle, onToggleOrder, disabled = false }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id,
    disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const fieldData = AVAILABLE_FIELDS.find((field) => field.field === sortingRule.field);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`sortable-item ${sortingRule.enabled ? 'enabled' : 'disabled'} ${
        disabled ? 'item-disabled' : ''
      }`}
    >
      <div
        className="drag-handle"
        {...attributes}
        {...listeners}
        style={{ cursor: disabled ? 'not-allowed' : 'grab' }}
      >
        ⋮⋮
      </div>
      <input
        type="checkbox"
        checked={sortingRule.enabled}
        onChange={() => onToggle(sortingRule.field)}
        disabled={disabled}
      />
      <label>{fieldData?.label || sortingRule.field}</label>
      <button
        type="button"
        className="sort-order-toggle"
        onClick={() => onToggleOrder(sortingRule.field)}
        title={sortingRule.order === 'asc' ? 'Ascending (Low to High)' : 'Descending (High to Low)'}
        disabled={disabled}
      >
        {sortingRule.order === 'asc' ? <FaArrowUp aria-hidden="true" /> : <FaArrowDown aria-hidden="true" />}
      </button>
    </div>
  );
}

export default function Sorting({ sorting, onChange, disabled = false }) {
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = sorting.findIndex((rule) => rule.field === active.id);
    const newIndex = sorting.findIndex((rule) => rule.field === over.id);

    onChange(arrayMove(sorting, oldIndex, newIndex));
  };

  const handleToggle = (field) => {
    if (disabled) return;
    const updated = sorting.map((rule) =>
      rule.field === field ? { ...rule, enabled: !rule.enabled } : rule,
    );
    onChange(updated);
  };

  const handleToggleOrder = (field) => {
    if (disabled) return;
    const updated = sorting.map((rule) =>
      rule.field === field ? { ...rule, order: rule.order === 'asc' ? 'desc' : 'asc' } : rule,
    );
    onChange(updated);
  };

  const enabledCount = sorting.filter((rule) => rule.enabled).length;

  return (
    <div className={`sorting-list ${disabled ? 'disabled' : ''}`}>
      <div className="sorting-list-summary">
        <span className="summary-text">
          {enabledCount} of {sorting.length} enabled
          {disabled && <span className="disabled-badge"> (Disabled by Optimize for Space)</span>}
        </span>
        <span className="summary-hint">
          Toggle sorting rules on/off, drag to reorder, and use the arrows to switch sort direction.
        </span>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sorting.map((rule) => rule.field)} strategy={verticalListSortingStrategy}>
          {sorting.map((rule) => (
            <SortableItem
              key={rule.field}
              id={rule.field}
              sortingRule={rule}
              onToggle={handleToggle}
              onToggleOrder={handleToggleOrder}
              disabled={disabled}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}

