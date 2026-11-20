import { Button } from '@primer/react'
import { PlusIcon } from '@primer/octicons-react'
import type { eventmanager } from '../lib/client'
import { RaceListPanel } from './RaceListPanel'
import { RaceDetailPane } from './RaceDetailPane'

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
    <div style={{ paddingTop: '20px' }}>
      {races.length === 0 ? (
        <div
          className="primer-box"
          style={{
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '280px',
            padding: '32px',
            gap: '8px',
          }}
        >
          <p style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--fgColor-default, #1f2328)' }}>
            No races configured yet
          </p>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--fgColor-muted, #636c76)', maxWidth: '360px' }}>
            Configure your first race track to start managing lineups and recording standings.
          </p>
          <div style={{ marginTop: '8px' }}>
            <Button
              type="button"
              variant="primary"
              leadingVisual={PlusIcon}
              onClick={() => setShowCreateRaceModal(true)}
            >
              Create Race Track
            </Button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
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
          <div style={{ flex: '2 1 500px', minWidth: 0 }}>
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
