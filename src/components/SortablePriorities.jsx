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
import './SortablePriorities.css';

const AVAILABLE_FIELDS = [
  { field: 'name', label: 'Game Name (Alphabetical)' },
  { field: 'categories', label: 'Categories' },
  { field: 'families', label: 'Families (Themes)' },
  { field: 'bggRank', label: 'BGG Rank' },
  { field: 'minPlayers', label: 'Min Players' },
  { field: 'maxPlayers', label: 'Max Players' },
  { field: 'bestPlayerCount', label: 'Best Player Count (Community)' },
  { field: 'minPlaytime', label: 'Min Playtime' },
  { field: 'maxPlaytime', label: 'Max Playtime' },
  { field: 'age', label: 'Age (Publisher)' },
  { field: 'communityAge', label: 'Community Age' },
  { field: 'weight', label: 'Weight (Complexity)' },
  { field: 'bggRating', label: 'BGG Rating' },
];

function SortableItem({ id, priority, onToggle, onToggleOrder, disabled = false }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id, disabled: disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const fieldData = AVAILABLE_FIELDS.find(f => f.field === priority.field);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`sortable-item ${priority.enabled ? 'enabled' : 'disabled'} ${disabled ? 'item-disabled' : ''}`}
    >
      <div className="drag-handle" {...attributes} {...listeners} style={{ cursor: disabled ? 'not-allowed' : 'grab' }}>
        ⋮⋮
      </div>
      <input
        type="checkbox"
        checked={priority.enabled}
        onChange={() => onToggle(priority.field)}
        disabled={disabled}
      />
      <label>{fieldData?.label || priority.field}</label>
      <button
        type="button"
        className="sort-order-toggle"
        onClick={() => onToggleOrder(priority.field)}
        title={priority.order === 'asc' ? 'Ascending (Low to High)' : 'Descending (High to Low)'}
        disabled={disabled}
      >
        {priority.order === 'asc' ? (
          <FaArrowUp aria-hidden="true" />
        ) : (
          <FaArrowDown aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
export default function SortablePriorities({ priorities, onChange, disabled = false }) {
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 5, // Activates after moving 5 pixels (prevents accidental drags)
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250, // Activates after a 250ms hold
        tolerance: 5, // Allows 5 pixels of movement during the delay
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = priorities.findIndex((p) => p.field === active.id);
    const newIndex = priorities.findIndex((p) => p.field === over.id);

    onChange(arrayMove(priorities, oldIndex, newIndex));
  };

  const handleToggle = (field) => {
    if (disabled) return;
    const updated = priorities.map(p =>
      p.field === field ? { ...p, enabled: !p.enabled } : p
    );
    onChange(updated);
  };

  const handleToggleOrder = (field) => {
    if (disabled) return;
    const updated = priorities.map(p =>
      p.field === field ? { ...p, order: p.order === 'asc' ? 'desc' : 'asc' } : p
    );
    onChange(updated);
  };

  const enabledCount = priorities.filter(p => p.enabled).length;

  return (
    <div className={`sortable-priorities ${disabled ? 'disabled' : ''}`}>
      <div className="sortable-priorities-summary">
        <span className="summary-text">
          {enabledCount} of {priorities.length} enabled
          {disabled && <span className="disabled-badge"> (Disabled by Optimize for Space)</span>}
        </span>
        <span className="summary-hint">
          Toggle priorities on/off, drag to reorder, and use the arrows to switch sort direction.
        </span>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={priorities.map(p => p.field)}
          strategy={verticalListSortingStrategy}
        >
          {priorities.map((priority) => (
            <SortableItem
              key={priority.field}
              id={priority.field}
              priority={priority}
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

