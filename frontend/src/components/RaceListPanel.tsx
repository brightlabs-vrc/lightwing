import { useState } from 'react'
import type { eventmanager } from '../lib/client'
import { SortableRaceItem } from './SortableRaceItem'
import { RaceListButton } from './RaceListButton'
import { getRaceStatusLabel } from '../lib/raceStatus'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'

interface RaceListPanelProps {
  races: eventmanager.RaceEventDetail[]
  selectedRaceId: string | null
  ongoingRaces: eventmanager.RaceEventDetail[]
  concludedRaces: eventmanager.RaceEventDetail[]
  notStartedRaces: eventmanager.RaceEventDetail[]
  handleSelectRace: (race: eventmanager.RaceEventDetail, switchTab?: boolean) => void
  handleReorderRaces: (orderedRaceIds: string[]) => Promise<void>
  hasStartedOrConcludedRaces: boolean
  setShowCreateRaceModal: (show: boolean) => void
}

export function RaceListPanel({
  races,
  selectedRaceId,
  ongoingRaces,
  concludedRaces,
  notStartedRaces,
  handleSelectRace,
  handleReorderRaces,
  hasStartedOrConcludedRaces,
  setShowCreateRaceModal,
}: RaceListPanelProps) {
  const [isReordering, setIsReordering] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return

    if (active.id !== over.id) {
      const oldIndex = races.findIndex((r) => r.id === active.id)
      const newIndex = races.findIndex((r) => r.id === over.id)
      const nextOrder = arrayMove(races, oldIndex, newIndex)
      const nextOrderedIds = nextOrder.map((r) => r.id)

      if (hasStartedOrConcludedRaces) {
        if (!window.confirm("Reordering races after activity has started can change the published event schedule. Continue?")) {
          return
        }
      }

      void handleReorderRaces(nextOrderedIds)
    }
  }

  const handleMoveUp = (index: number) => {
    if (index <= 0) return
    const nextOrder = [...races]
    const temp = nextOrder[index]
    nextOrder[index] = nextOrder[index - 1]
    nextOrder[index - 1] = temp
    const nextOrderedIds = nextOrder.map((r) => r.id)

    if (hasStartedOrConcludedRaces) {
      if (!window.confirm("Reordering races after activity has started can change the published event schedule. Continue?")) {
        return
      }
    }

    void handleReorderRaces(nextOrderedIds)
  }

  const handleMoveDown = (index: number) => {
    if (index >= races.length - 1) return
    const nextOrder = [...races]
    const temp = nextOrder[index]
    nextOrder[index] = nextOrder[index + 1]
    nextOrder[index + 1] = temp
    const nextOrderedIds = nextOrder.map((r) => r.id)

    if (hasStartedOrConcludedRaces) {
      if (!window.confirm("Reordering races after activity has started can change the published event schedule. Continue?")) {
        return
      }
    }

    void handleReorderRaces(nextOrderedIds)
  }

  return (
    <div
      className="primer-box"
      style={{
        flex: '1 1 280px',
        maxWidth: '340px',
        padding: '14px',
        backgroundColor: 'var(--bgColor-muted, #f6f8fa)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '8px' }}>
        <h3 style={{ fontWeight: 600, fontSize: '14px', margin: 0, color: 'var(--fgColor-default, #1f2328)' }}>
          Race Tracks ({races.length})
        </h3>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            onClick={() => setIsReordering(!isReordering)}
            style={{
              padding: '3px 10px',
              fontSize: '12px',
              fontWeight: 500,
              borderRadius: '6px',
              cursor: 'pointer',
              border: '1px solid var(--borderColor-default, #d0d7de)',
              backgroundColor: isReordering ? 'var(--bgColor-accent-emphasis, #0969da)' : 'var(--bgColor-default, #ffffff)',
              color: isReordering ? '#ffffff' : 'var(--fgColor-default, #1f2328)',
            }}
          >
            {isReordering ? 'Done' : 'Reorder'}
          </button>
          <button
            type="button"
            onClick={() => setShowCreateRaceModal(true)}
            style={{
              padding: '3px 10px',
              fontSize: '12px',
              fontWeight: 500,
              borderRadius: '6px',
              cursor: 'pointer',
              border: '1px solid var(--borderColor-default, #d0d7de)',
              backgroundColor: 'var(--bgColor-default, #ffffff)',
              color: 'var(--fgColor-default, #1f2328)',
            }}
          >
            + Add
          </button>
        </div>
      </div>

      {isReordering ? (
        <div>
          <p style={{ fontSize: '12px', color: 'var(--fgColor-muted, #636c76)', marginBottom: '10px', lineHeight: 1.4 }}>
            Drag items or use arrows to reorder. Changes are saved automatically.
          </p>
          {(() => {
            const DndContextAny = DndContext as any
            const SortableContextAny = SortableContext as any
            return (
              <DndContextAny
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContextAny
                  items={races.map((r) => r.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {races.map((race, index) => (
                    <SortableRaceItem
                      key={race.id}
                      race={race}
                      isFirst={index === 0}
                      isLast={index === races.length - 1}
                      isSelected={selectedRaceId === race.id}
                      onSelect={() => void handleSelectRace(race, false)}
                      onMoveUp={() => handleMoveUp(index)}
                      onMoveDown={() => handleMoveDown(index)}
                    />
                  ))}
                </SortableContextAny>
              </DndContextAny>
            )
          })()}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {ongoingRaces.length > 0 && (
            <div>
              <h4 style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em', color: 'var(--fgColor-muted, #636c76)', margin: '0 0 6px 0' }}>
                Ongoing ({ongoingRaces.length})
              </h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {ongoingRaces.map((race) => (
                  <li key={race.id}>
                    <RaceListButton
                      race={race}
                      isSelected={selectedRaceId === race.id}
                      label={getRaceStatusLabel(race)}
                      onSelect={() => void handleSelectRace(race, false)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {concludedRaces.length > 0 && (
            <div>
              <h4 style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em', color: 'var(--fgColor-muted, #636c76)', margin: '0 0 6px 0' }}>
                Concluded ({concludedRaces.length})
              </h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {concludedRaces.map((race) => (
                  <li key={race.id}>
                    <RaceListButton
                      race={race}
                      isSelected={selectedRaceId === race.id}
                      label={getRaceStatusLabel(race)}
                      onSelect={() => void handleSelectRace(race, false)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {notStartedRaces.length > 0 && (
            <div>
              <h4 style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em', color: 'var(--fgColor-muted, #636c76)', margin: '0 0 6px 0' }}>
                Not Started ({notStartedRaces.length})
              </h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {notStartedRaces.map((race) => (
                  <li key={race.id}>
                    <RaceListButton
                      race={race}
                      isSelected={selectedRaceId === race.id}
                      label={getRaceStatusLabel(race)}
                      onSelect={() => void handleSelectRace(race, false)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
