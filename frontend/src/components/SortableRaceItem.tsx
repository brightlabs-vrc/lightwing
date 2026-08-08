import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { eventmanager } from '../lib/client'
import { getRaceStatusLabel } from '../lib/raceStatus'
import { Label, Button, IconButton } from '@primer/react'
import { ChevronUpIcon, ChevronDownIcon } from '@primer/octicons-react'

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
    border: '1px solid var(--color-border-default)',
    borderRadius: '6px',
    background: isSelected ? 'var(--color-accent-emphasis)' : 'var(--color-canvas-default)',
    padding: '8px',
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    boxShadow: isDragging ? 'var(--color-shadow-large)' : 'none',
    zIndex: isDragging ? 1000 : 'auto',
  }

  const statusText = getRaceStatusLabel(race)

  return (
    <div ref={setNodeRef} style={style}>
      {/* Left side: Drag handle */}
      <div
        {...attributes}
        {...listeners}
        style={{
          cursor: 'grab',
          padding: '4px 8px',
          backgroundColor: 'var(--color-canvas-subtle)',
          border: '1px solid var(--color-border-default)',
          borderRadius: '6px',
          userSelect: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        title="Drag to reorder"
      >
        <span style={{ fontWeight: 'bold', fontSize: '14px', color: 'var(--color-fg-muted)' }}>☰</span>
      </div>

      {/* Center: main body */}
      <div
        onClick={onSelect}
        style={{
          flexGrow: 1,
          cursor: 'pointer',
          minWidth: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontWeight: 'bold',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: '13px',
            color: isSelected ? '#ffffff' : 'var(--color-fg-default)'
          }}>
            #{race.sequence}. {race.name}
          </span>
          <Label variant={statusText === 'Live' ? 'success' : statusText === 'Done' ? 'default' : 'accent'}>
            {statusText}
          </Label>
        </div>
      </div>

      {/* Right side: fallback controls */}
      <div style={{ display: 'flex', gap: '4px' }}>
        <IconButton
          icon={ChevronUpIcon}
          aria-label="Move up"
          disabled={isFirst}
          onClick={(e) => {
            e.stopPropagation()
            if (onMoveUp) onMoveUp()
          }}
          size="small"
        />
        <IconButton
          icon={ChevronDownIcon}
          aria-label="Move down"
          disabled={isLast}
          onClick={(e) => {
            e.stopPropagation()
            if (onMoveDown) onMoveDown()
          }}
          size="small"
        />
      </div>
    </div>
  )
}
