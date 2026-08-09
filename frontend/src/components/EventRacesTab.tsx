import type { eventmanager } from '../lib/client'
import { RaceListPanel } from './RaceListPanel'
import { RaceDetailPane } from './RaceDetailPane'
import { Heading, Text, Button } from '@primer/react'

interface EventRacesTabProps {
  races: eventmanager.RaceEventDetail[]
  selectedRaceId: string | null
  setSelectedRaceId: (id: string | null) => void
  selectedRace: eventmanager.RaceEventDetail | null
  ongoingRaces: eventmanager.RaceEventDetail[]
  concludedRaces: eventmanager.RaceEventDetail[]
  notStartedRaces: eventmanager.RaceEventDetail[]
  handleSelectRace: (race: eventmanager.RaceEventDetail, switchTab?: boolean) => void
  handleReorderRaces: (orderedRaceIds: string[]) => Promise<void>
  hasStartedOrConcludedRaces: boolean
  setShowCreateRaceModal: (show: boolean) => void
  selectedEvent: eventmanager.EventDetail
  newRaceMemberUserId: string
  setNewRaceMemberUserId: (id: string) => void
  CLASS_TIER_OPTIONS: string[]
  handleUpdateRace: (raceId: string, params: any) => Promise<void>
  handleStartRace: (raceId: string) => Promise<void>
  handleEndRace: (raceId: string) => Promise<void>
  handleDeleteRace: (raceId: string) => Promise<void>
  handleAddRaceMember: (raceId: string, userId: string) => Promise<void>
  handleRemoveRaceMember: (raceId: string, userId: string) => Promise<void>
  setShowEditRaceModal: (show: boolean) => void
  loadingResults: boolean
  derivedStates: any[]
  changeSummary: any
  savingBatch: boolean
  handleInferFinishTimes: () => void
  handleCancelStandingsEdit: () => void
  handleUnifiedSave: () => Promise<void>
  resetStandingsDraft: () => void
  handleResultChange: (userId: string, field: any, value: string) => void
  togglePendingDeletion: (userId: string) => void
  handleUndoRow: (userId: string) => void
}

export function EventRacesTab({
  races,
  selectedRaceId,
  setSelectedRaceId,
  selectedRace,
  ongoingRaces,
  concludedRaces,
  notStartedRaces,
  handleSelectRace,
  handleReorderRaces,
  hasStartedOrConcludedRaces,
  setShowCreateRaceModal,
  selectedEvent,
  newRaceMemberUserId,
  setNewRaceMemberUserId,
  CLASS_TIER_OPTIONS,
  handleUpdateRace,
  handleStartRace,
  handleEndRace,
  handleDeleteRace,
  handleAddRaceMember,
  handleRemoveRaceMember,
  setShowEditRaceModal,
  loadingResults,
  derivedStates,
  changeSummary,
  savingBatch,
  handleInferFinishTimes,
  handleCancelStandingsEdit,
  handleUnifiedSave,
  resetStandingsDraft,
  handleResultChange,
  togglePendingDeletion,
  handleUndoRow,
}: EventRacesTabProps) {
  return (
    <div style={{ paddingTop: '1.5rem' }}>
      {races.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          color: 'var(--color-fg-muted)',
          border: '1px dashed #d0d7de',
          borderRadius: '6px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '300px'
        }}>
          <Heading as="h3" style={{ fontSize: '18px', marginBottom: '8px' }}>No races yet</Heading>
          <Text style={{ fontSize: '14px', color: 'var(--color-fg-muted)', display: 'block', marginBottom: '1.5rem' }}>
            Configure your first race track using the wizard.
          </Text>
          <Button variant="primary" onClick={() => setShowCreateRaceModal(true)}>
            Create Race Track
          </Button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <RaceListPanel
            races={races}
            selectedRaceId={selectedRaceId}
            ongoingRaces={ongoingRaces}
            concludedRaces={concludedRaces}
            notStartedRaces={notStartedRaces}
            handleSelectRace={handleSelectRace}
            handleReorderRaces={handleReorderRaces}
            hasStartedOrConcludedRaces={hasStartedOrConcludedRaces}
            setShowCreateRaceModal={setShowCreateRaceModal}
          />
          <div style={{ flex: '2 1 500px', minWidth: '0' }}>
            <RaceDetailPane
              selectedEvent={selectedEvent}
              selectedRace={selectedRace}
              selectedRaceId={selectedRaceId}
              setSelectedRaceId={setSelectedRaceId}
              newRaceMemberUserId={newRaceMemberUserId}
              setNewRaceMemberUserId={setNewRaceMemberUserId}
              CLASS_TIER_OPTIONS={CLASS_TIER_OPTIONS}
              handleUpdateRace={handleUpdateRace}
              handleStartRace={handleStartRace}
              handleEndRace={handleEndRace}
              handleDeleteRace={handleDeleteRace}
              handleAddRaceMember={handleAddRaceMember}
              handleRemoveRaceMember={handleRemoveRaceMember}
              setShowEditRaceModal={setShowEditRaceModal}
              setShowCreateRaceModal={setShowCreateRaceModal}
              loadingResults={loadingResults}
              derivedStates={derivedStates}
              changeSummary={changeSummary}
              savingBatch={savingBatch}
              handleInferFinishTimes={handleInferFinishTimes}
              handleCancelStandingsEdit={handleCancelStandingsEdit}
              handleUnifiedSave={handleUnifiedSave}
              resetStandingsDraft={resetStandingsDraft}
              handleResultChange={handleResultChange}
              togglePendingDeletion={togglePendingDeletion}
              handleUndoRow={handleUndoRow}
            />
          </div>
        </div>
      )}
    </div>
  )
}
