import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { IconButton, Label } from '@primer/react'
import { ArrowDownIcon, ArrowUpIcon, GrabberIcon } from '@primer/octicons-react'
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: race.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    border: isSelected
      ? '1px solid var(--borderColor-accent-emphasis, #0969da)'
      : '1px solid var(--borderColor-default, #d0d7de)',
    borderRadius: '6px',
    backgroundColor: isSelected ? 'var(--bgColor-accent-muted, #ddf4ff)' : 'var(--bgColor-default, #ffffff)',
    padding: '8px',
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    boxShadow: isDragging ? '0 8px 24px rgba(140, 149, 159, 0.25)' : 'none',
    zIndex: isDragging ? 1000 : 'auto',
  }

  const statusText = getRaceStatusLabel(race)
  const labelVariant = statusText === 'Live' ? 'success' : statusText === 'Done' ? 'secondary' : 'accent'

  return (
    <div ref={setNodeRef} style={style}>
      <div
        {...attributes}
        {...listeners}
        style={{
          cursor: 'grab',
          padding: '4px 6px',
          backgroundColor: 'var(--bgColor-muted, #f6f8fa)',
          border: '1px solid var(--borderColor-default, #d0d7de)',
          borderRadius: '4px',
          userSelect: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--fgColor-muted, #636c76)',
        }}
        title="Drag to reorder"
      >
        <GrabberIcon size={14} />
      </div>

      <div
        onClick={onSelect}
        style={{
          flexGrow: 1,
          cursor: 'pointer',
          minWidth: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: '13px',
              color: isSelected ? 'var(--fgColor-accent, #0969da)' : 'var(--fgColor-default, #1f2328)',
            }}
          >
            #{race.sequence}. {race.name}
          </span>
          <Label variant={labelVariant} size="small">
            {statusText}
          </Label>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '4px' }}>
        <IconButton
          type="button"
          size="small"
          aria-label="Move up"
          icon={ArrowUpIcon}
          disabled={isFirst}
          onClick={(e) => {
            e.stopPropagation()
            onMoveUp?.()
          }}
        />
        <IconButton
          type="button"
          size="small"
          aria-label="Move down"
          icon={ArrowDownIcon}
          disabled={isLast}
          onClick={(e) => {
            e.stopPropagation()
            onMoveDown?.()
          }}
        />
      </div>
    </div>
  )
}
