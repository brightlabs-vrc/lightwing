import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { eventmanager } from '../lib/client'
import { getRaceStatusLabel } from '../lib/raceStatus'

export interface SortableRaceItemProps {
  race: eventmanager.RaceEventDetail
  onMoveUp?: () => void
  onMoveDown?: () => void
  isFirst: boolean
  isLast: boolean
  isSelected: boolean
  onSelect: () => void
}

export function SortableRaceItem({
  race,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  isSelected,
  onSelect,
}: SortableRaceItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: race.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    border: '1px solid #dddbda',
    borderRadius: '4px',
    background: isSelected ? '#0176d3' : '#ffffff',
    padding: '8px',
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    boxShadow: isDragging ? '0 5px 15px rgba(0,0,0,0.15)' : 'none',
    zIndex: isDragging ? 1000 : 'auto',
  }

  const statusText = getRaceStatusLabel(race)

  return (
    <div ref={setNodeRef} style={style}>
      {/* Left side: Drag handle. Only the drag handle should initiate drag behavior */}
      <div
        {...attributes}
        {...listeners}
        style={{
          cursor: 'grab',
          padding: '4px 8px',
          background: '#f1f5f9',
          border: '1px solid #cbd5e1',
          borderRadius: '4px',
          userSelect: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        title="Drag to reorder"
      >
        <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#64748b' }}>☰</span>
      </div>

      {/* Center: main body. Clicking anywhere else selects the race */}
      <div
        onClick={onSelect}
        style={{
          flexGrow: 1,
          cursor: 'pointer',
          minWidth: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '13px', color: isSelected ? '#ffffff' : '#1e293b' }}>
            #{race.sequence}. {race.name}
          </span>
          <span
            className="slds-badge"
            style={{
              padding: '1px 6px',
              fontSize: '10px',
              backgroundColor: statusText === 'Live' ? '#2e7d32' : statusText === 'Done' ? '#475569' : '#0284c7',
              color: '#ffffff',
            }}
          >
            {statusText}
          </span>
        </div>
      </div>

      {/* Right side: fallback controls */}
      <div style={{ display: 'flex', gap: '4px' }}>
        <button
          type="button"
          disabled={isFirst}
          onClick={(e) => {
            e.stopPropagation()
            if (onMoveUp) onMoveUp()
          }}
          className="slds-button slds-button_neutral"
          style={{
            padding: '2px 6px',
            fontSize: '11px',
            height: '24px',
            lineHeight: '20px',
            borderRadius: '3px',
            color: isSelected ? '#1e293b' : undefined,
          }}
          title="Move up"
        >
          &uarr;
        </button>
        <button
          type="button"
          disabled={isLast}
          onClick={(e) => {
            e.stopPropagation()
            if (onMoveDown) onMoveDown()
          }}
          className="slds-button slds-button_neutral"
          style={{
            padding: '2px 6px',
            fontSize: '11px',
            height: '24px',
            lineHeight: '20px',
            borderRadius: '3px',
            color: isSelected ? '#1e293b' : undefined,
          }}
          title="Move down"
        >
          &darr;
        </button>
      </div>
    </div>
  )
}
