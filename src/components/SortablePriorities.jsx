import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
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

function SortableItem({ id, priority, onToggle, onToggleOrder }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const fieldData = AVAILABLE_FIELDS.find(f => f.field === priority.field);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`sortable-item ${priority.enabled ? 'enabled' : 'disabled'}`}
    >
      <div className="drag-handle" {...attributes} {...listeners}>
        ⋮⋮
      </div>
      <input
        type="checkbox"
        checked={priority.enabled}
        onChange={() => onToggle(priority.field)}
      />
      <label>{fieldData?.label || priority.field}</label>
      <button
        type="button"
        className="sort-order-toggle"
        onClick={() => onToggleOrder(priority.field)}
        title={priority.order === 'asc' ? 'Ascending (Low to High)' : 'Descending (High to Low)'}
      >
        {priority.order === 'asc' ? '↑' : '↓'}
      </button>
    </div>
  );
}

export default function SortablePriorities({ priorities, onChange }) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      const oldIndex = priorities.findIndex((p) => p.field === active.id);
      const newIndex = priorities.findIndex((p) => p.field === over.id);

      onChange(arrayMove(priorities, oldIndex, newIndex));
    }
  };

  const handleToggle = (field) => {
    const updated = priorities.map(p =>
      p.field === field ? { ...p, enabled: !p.enabled } : p
    );
    onChange(updated);
  };

  const handleToggleOrder = (field) => {
    const updated = priorities.map(p =>
      p.field === field ? { ...p, order: p.order === 'asc' ? 'desc' : 'asc' } : p
    );
    onChange(updated);
  };

  return (
    <div className="sortable-priorities">
      <h3>Sorting Priorities (Drag to Reorder)</h3>
      <p className="hint">
        Games are packed to minimize cubes. When multiple games fit, the highest priority enabled field is used for selection.
        Use ↑ for ascending (low to high) or ↓ for descending (high to low).
      </p>
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
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}

