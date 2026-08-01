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
    <div className="slds-tabs_default__content slds-show slds-p-vertical_medium" style={{ paddingTop: '1.5rem' }}>
      {races.length === 0 ? (
        <div className="slds-align_absolute-center slds-p-around_large text-slate-500" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
          <p className="slds-text-heading_small font-bold text-slate-700" style={{ fontWeight: 'bold' }}>No races yet</p>
          <p className="slds-text-body_regular text-slate-500 slds-m-top_xx-small">
            Configure your first race track using the wizard.
          </p>
          <button
            type="button"
            onClick={() => setShowCreateRaceModal(true)}
            className="slds-button slds-button_brand slds-m-top_medium"
          >
            Create Race Track
          </button>
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
