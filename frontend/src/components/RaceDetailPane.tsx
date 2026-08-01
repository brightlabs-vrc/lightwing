import type { eventmanager } from '../lib/client'
import { AlertBanner } from './AlertBanner'
import { StandingsEditor } from './StandingsEditor'
import {
  isRaceOngoing,
  isRaceNotStarted,
} from '../lib/raceStatus'

interface RaceDetailPaneProps {
  selectedEvent: eventmanager.EventDetail
  selectedRace: eventmanager.RaceEventDetail | null
  selectedRaceId: string | null
  setSelectedRaceId: (id: string | null) => void
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
  setShowCreateRaceModal: (show: boolean) => void
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

export function RaceDetailPane({
  selectedEvent,
  selectedRace,
  selectedRaceId,
  setSelectedRaceId,
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
  setShowCreateRaceModal,
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
}: RaceDetailPaneProps) {
  if (selectedRaceId === null || !selectedRace) {
    /* Elegant placeholder state box */
    return (
      <div className="slds-box slds-align_absolute-center bg-white" style={{ background: '#ffffff', borderRadius: '4px', border: '1px solid #dddbda', minHeight: '400px', display: 'flex', justifyContent: 'center', alignItems: 'center', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <div style={{ padding: '2rem' }}>
          <p className="slds-text-heading_medium font-bold text-slate-700" style={{ fontWeight: 'bold', fontSize: '1.25rem' }}>
            No race selected
          </p>
          <p className="slds-text-body_regular text-slate-500 slds-m-top_small" style={{ fontSize: '14px', maxWidth: '360px', margin: '8px auto 0 auto', lineHeight: '1.5' }}>
            Select a race track from the left panel to begin managing competitors, recording standings, and starting or concluding races.
          </p>
          <button
            type="button"
            onClick={() => setShowCreateRaceModal(true)}
            className="slds-button slds-button_brand slds-m-top_large"
            style={{ padding: '6px 16px' }}
          >
            Create Race Track
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Race Details Header Card */}
      <div className="slds-box slds-m-bottom_medium bg-white" style={{ background: '#ffffff', border: '1px solid #dddbda', borderRadius: '4px', padding: '16px' }}>
        <div className="slds-grid slds-grid_align-spread slds-grid_vertical-align-center" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 className="slds-text-heading_small font-bold text-slate-900" style={{ fontWeight: 'bold', margin: 0 }}>
              #{selectedRace.sequence}. {selectedRace.name}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '4px' }}>
              <p className="text-slate-500 text-xs" style={{ margin: 0 }}>
                Type: <strong>{selectedRace.trackType} ({selectedRace.distanceMeters}m)</strong> | Location: <strong>{selectedRace.location}</strong>
              </p>
              <span className="slds-badge slds-theme_light" style={{ padding: '2px 8px', fontSize: '11px', textTransform: 'none' }}>
                Class Restriction: <strong>{selectedRace.classRestriction ?? 'Any tier'}</strong>
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div className="slds-form-element" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label className="slds-form-element__label font-bold text-slate-700" style={{ fontWeight: 'bold', margin: 0, fontSize: '12px' }} htmlFor="race-class-restriction-select">
                Class Restriction:
              </label>
              <div className="slds-form-element__control">
                <select
                  id="race-class-restriction-select"
                  value={selectedRace.classRestriction || ''}
                  onChange={(e) => void handleUpdateRace(selectedRace.id, { classRestriction: e.target.value ? e.target.value as eventmanager.ClassTier : null })}
                  className="slds-select"
                  style={{ minWidth: '130px', padding: '4px 24px 4px 12px', border: '1px solid #dddbda', borderRadius: '4px', fontSize: '12px', height: '30px' }}
                >
                  <option value="">Any Tier (None)</option>
                  {CLASS_TIER_OPTIONS.map((tier) => (
                    <option key={tier} value={tier}>
                      {tier}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedEvent.scoringType === 1 && (
              <div className="slds-form-element" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label className="slds-form-element__label font-bold text-slate-700" style={{ fontWeight: 'bold', margin: 0, fontSize: '12px' }} htmlFor="race-grade-select">
                  Grade:
                </label>
                <div className="slds-form-element__control">
                  <select
                    id="race-grade-select"
                    value={selectedRace.grade || ''}
                    onChange={(e) => void handleUpdateRace(selectedRace.id, { grade: e.target.value || null })}
                    className="slds-select"
                    style={{ minWidth: '100px', padding: '4px 24px 4px 12px', border: '1px solid #dddbda', borderRadius: '4px', fontSize: '12px', height: '30px' }}
                  >
                    <option value="">-- None --</option>
                    <option value="OP">OP</option>
                    <option value="GIII">GIII</option>
                    <option value="GII">GII</option>
                    <option value="GI">GI</option>
                  </select>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setShowEditRaceModal(true)}
                className="slds-button slds-button_neutral"
                style={{ padding: '4px 12px', fontSize: '12px' }}
              >
                Edit Race
              </button>
              {isRaceNotStarted(selectedRace) && (
                <button
                  type="button"
                  onClick={() => void handleStartRace(selectedRace.id)}
                  className="slds-button slds-button_success"
                  style={{ padding: '4px 12px', fontSize: '12px', background: '#2e7d32', color: '#fff' }}
                >
                  Start Race
                </button>
              )}
              {isRaceOngoing(selectedRace) && (
                <button
                  type="button"
                  onClick={() => void handleEndRace(selectedRace.id)}
                  className="slds-button slds-button_destructive"
                  style={{ padding: '4px 12px', fontSize: '12px', background: '#d32f2f', color: '#fff' }}
                >
                  End Race
                </button>
              )}
              <button
                type="button"
                onClick={() => void handleDeleteRace(selectedRace.id)}
                className="slds-button slds-button_neutral"
                style={{ padding: '4px 12px', fontSize: '12px', color: '#d32f2f' }}
              >
                Delete Race
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedRaceId(null)
                }}
                className="slds-button slds-button_neutral"
                style={{ padding: '4px 12px', fontSize: '12px' }}
              >
                Clear Selection
              </button>
            </div>
          </div>
        </div>

        <div className="text-slate-500 slds-m-top_small" style={{ fontSize: '11px', borderTop: '1px solid #f3f2f1', paddingTop: '8px' }}>
          {selectedRace.startsAt ? `Started: ${new Date(selectedRace.startsAt).toLocaleString()}` : 'Race is currently not started'} <br />
          {selectedRace.endsAt ? `Ended: ${new Date(selectedRace.endsAt).toLocaleString()}` : ''}
          {selectedRace.grade && (
            <span style={{ float: 'right' }}>
              Scoring Table: <strong>{selectedRace.grade}</strong> | Source: <strong>{selectedEvent.scoringRulesMode === 'CUSTOM' ? 'Event Custom Rules' : 'Event Standard Rules'}</strong>
            </span>
          )}
        </div>
      </div>

      {/* Warning Banner if points-based event but race has no grade */}
      {selectedEvent.scoringType === 1 && !selectedRace.grade && (
        <div className="slds-m-bottom_medium">
          <AlertBanner variant="error">
            <div style={{ textAlign: 'left' }}>
              <strong>Missing Race Grade Configuration</strong>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#7f1d1d' }}>
                This event is points-based, but this race has no grade configured. Points for its results will resolve to <strong>0</strong> until a grade is configured.
              </p>
            </div>
          </AlertBanner>
        </div>
      )}

      {/* Granular Participant lineup box */}
      {selectedEvent.granularParticipation && (
        <div className="slds-box slds-m-bottom_medium" style={{ background: '#ffffff', border: '1px solid #dddbda', borderRadius: '4px', padding: '1rem' }}>
          <h3 className="slds-text-heading_small font-bold text-slate-900 slds-m-bottom_small" style={{ fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Competitor Lineup</span>
            <span className="slds-badge slds-theme_light" style={{ padding: '2px 8px', fontSize: '10px' }}>
              {(selectedRace.members ?? []).length} Registered
            </span>
          </h3>

          <div className="slds-box slds-m-bottom_small" style={{ background: '#f3f2f1', border: '1px solid #dddbda', padding: '8px 12px' }}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleAddRaceMember(selectedRace.id, newRaceMemberUserId);
              }}
              className="slds-grid slds-wrap"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <div style={{ flexGrow: 1, minWidth: '180px' }}>
                <select
                  value={newRaceMemberUserId}
                  onChange={(e) => setNewRaceMemberUserId(e.target.value)}
                  className="slds-select"
                  style={{ padding: '4px 8px', border: '1px solid #dddbda', borderRadius: '4px', background: '#fff', fontSize: '12px' }}
                >
                  <option value="">-- Add Competitor from Event Members --</option>
                  {selectedEvent.members
                    .filter((em) => !(selectedRace.members ?? []).some((rm) => rm.userId === em.userId))
                    .map((em) => (
                      <option key={em.userId} value={em.userId}>
                        {em.name} ({em.classTier ?? 'PRE_OP'})
                      </option>
                    ))}
                </select>
              </div>
              <button
                type="submit"
                className="slds-button slds-button_brand"
                style={{ padding: '4px 12px', height: '30px', fontSize: '12px' }}
                disabled={!newRaceMemberUserId}
              >
                Add
              </button>
            </form>
          </div>

          {(selectedRace.members?.length ?? 0) === 0 ? (
            <p className="slds-text-body_small text-slate-500" style={{ fontSize: '11px', margin: 0 }}>No competitors registered specifically for this race yet.</p>
          ) : (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {(selectedRace.members ?? []).map((m) => (
                <span
                  key={m.userId}
                  className="slds-badge slds-theme_light"
                  style={{
                    padding: '2px 8px',
                    fontSize: '11px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    border: '1px solid #dddbda',
                    background: '#f8fafc',
                  }}
                >
                  <strong>{m.name}</strong>
                  <button
                    type="button"
                    onClick={() => void handleRemoveRaceMember(selectedRace.id, m.userId)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#d32f2f',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      padding: 0,
                    }}
                    title="Remove competitor"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Dynamic Standings editor grid */}
      <StandingsEditor
        raceName={selectedRace.name}
        isRaceOngoing={isRaceOngoing(selectedRace)}
        isRaceNotStarted={isRaceNotStarted(selectedRace)}
        loadingResults={loadingResults}
        memberCount={selectedEvent.granularParticipation ? (selectedRace.members?.length ?? 0) : selectedEvent.members.length}
        rows={derivedStates}
        changeSummary={changeSummary}
        savingBatch={savingBatch}
        onInferTimes={handleInferFinishTimes}
        onCancel={handleCancelStandingsEdit}
        onSave={handleUnifiedSave}
        onResetAll={resetStandingsDraft}
        onResultChange={handleResultChange}
        onTogglePendingDeletion={togglePendingDeletion}
        onUndoRow={handleUndoRow}
        noTopMargin={true}
        scoringType={selectedEvent.scoringType}
        scoringRulesMode={selectedEvent.scoringRulesMode}
        customScoringTables={selectedEvent.customScoringTables}
        raceGrade={selectedRace.grade}
      />
    </div>
  )
}
