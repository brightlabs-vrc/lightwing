import { useState } from 'react'
import type { eventmanager } from '../lib/client'
import { SortableRaceItem } from './SortableRaceItem'
import { RaceListButton } from './RaceListButton'
import { getRaceStatusLabel } from '../lib/raceStatus'
import { Heading, Text, Button } from '@primer/react'
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
    <div style={{
      flex: '1 1 300px',
      maxWidth: '360px',
      backgroundColor: 'var(--color-canvas-subtle)',
      border: '1px solid var(--color-border-default)',
      borderRadius: '6px',
      padding: '16px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <Heading as="h3" style={{ fontSize: '14px', margin: 0, fontWeight: 'bold' }}>
          Configure / Manage Tracks
        </Heading>
        <Button
          size="small"
          onClick={() => setIsReordering(!isReordering)}
          variant={isReordering ? 'primary' : 'default'}
        >
          {isReordering ? 'Done' : 'Reorder'}
        </Button>
      </div>

      {isReordering ? (
        <div style={{ marginBottom: '16px' }}>
          <p style={{ fontSize: '12px', color: '#57606a', marginBottom: '12px', lineHeight: '1.4', fontStyle: 'italic' }}>
            Drag items or use the arrows to reorder. Changes are saved automatically.
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Group: Ongoing */}
          {ongoingRaces.length > 0 && (
            <div>
              <h4 style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.0625em', color: '#57606a', margin: '0 0 8px 0' }}>
                Ongoing ({ongoingRaces.length})
              </h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
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

          {/* Group: Concluded */}
          {concludedRaces.length > 0 && (
            <div>
              <h4 style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.0625em', color: '#57606a', margin: '0 0 8px 0' }}>
                Concluded ({concludedRaces.length})
              </h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
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

          {/* Group: Not Started */}
          {notStartedRaces.length > 0 && (
            <div>
              <h4 style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.0625em', color: '#57606a', margin: '0 0 8px 0' }}>
                Not Started ({notStartedRaces.length})
              </h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
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
