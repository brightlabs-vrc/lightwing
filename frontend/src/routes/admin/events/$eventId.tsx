import { Link, createFileRoute, Outlet } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { requireSiteAdmin } from '../../../lib/auth-guard'
import { AdminLayout } from '../-AdminLayout'
import { useEventDetail } from '../../../hooks/useEventDetail'
import { AlertBanner } from '../../../components/AlertBanner'
import { SldsSkeletonDetail } from '../../../components/LoadingSkeleton'
import { EventScoringTablesEditor } from '../../../components/EventScoringTablesEditor'
import type { eventmanager } from '../../../lib/client'

import { EventSummaryTab } from '../../../components/EventSummaryTab'
import { EventMembersTab } from '../../../components/EventMembersTab'
import { EventRacesTab } from '../../../components/EventRacesTab'
import { DEFAULT_SCORING_TABLES } from '../../../lib/scoringDefaults'
import { toLocalISOString } from '../../../lib/datetime'
import { Heading, Text, Label, Button, TextInput, FormControl, Select, Dialog, UnderlineNav, Textarea } from '@primer/react'

export const Route = createFileRoute('/admin/events/$eventId')({
  beforeLoad: async ({ location }) => {
    await requireSiteAdmin(location)
  },
  component: AdminEventDetailPage,
})

function AdminEventDetailPage() {
  const { eventId } = Route.useParams()
  const {
    STATUS_OPTIONS,
    CLASS_TIER_OPTIONS,
    selectedEvent,
    activeTab,
    setActiveTab,
    races,
    selectedRaceId,
    setSelectedRaceId,
    selectedRace,
    newMemberUserId,
    setNewMemberUserId,
    newRaceMemberUserId,
    setNewRaceMemberUserId,
    newRaceForm,
    setNewRaceForm,
    loadingEventDetail,
    eventStatusSaving,
    signupsLockedSaving,
    globalError,
    globalSuccess,
    derivedStates,
    changeSummary,
    loadingResults,
    savingBatch,
    ongoingRaces,
    concludedRaces,
    notStartedRaces,
    results,
    handleUpdateEventStatus,
    handleSetSignupsLocked,
    handleUpdateEventDetails,
    handleRecomputeEventPoints,
    handleAddMember,
    handleRemoveMember,
    handleAddRaceMember,
    handleRemoveRaceMember,
    handleCreateRace,
    handleStartRace,
    handleEndRace,
    handleUpdateRace,
    handleDeleteRace,
    handleSelectRace,
    handleResultChange,
    togglePendingDeletion,
    handleUndoRow,
    resetStandingsDraft,
    handleInferFinishTimes,
    handleCancelStandingsEdit,
    handleUnifiedSave,
    handleReorderRaces,
  } = useEventDetail(eventId)

  const [showCreateRaceModal, setShowCreateRaceModal] = useState(false)
  const [showEditEventModal, setShowEditEventModal] = useState(false)
  const [showEditRaceModal, setShowEditRaceModal] = useState(false)

  const hasStartedOrConcludedRaces = races.some((r) => r.startsAt !== null || r.endsAt !== null)

  // Race Edit Form States
  const [raceEditName, setRaceEditName] = useState('')
  const [raceEditLocation, setRaceEditLocation] = useState('')
  const [raceEditDistance, setRaceEditDistance] = useState(1200)
  const [raceEditTrackType, setRaceEditTrackType] = useState('Turf')
  const [raceEditClassRestriction, setRaceEditClassRestriction] = useState<eventmanager.ClassTier | null>(null)
  const [raceEditGrade, setRaceEditGrade] = useState<string | null>(null)
  const [raceEditParticipantLimit, setRaceEditParticipantLimit] = useState<string>('')
  const [showRaceGradeConfirm, setShowRaceGradeConfirm] = useState(false)
  const [raceEditError, setRaceEditError] = useState<string | null>(null)

  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editClassRestriction, setEditClassRestriction] = useState<eventmanager.ClassTier | null>(null)
  const [editGranularParticipation, setEditGranularParticipation] = useState(false)
  const [editSignupsLocked, setEditSignupsLocked] = useState(false)
  const [editScheduledAt, setEditScheduledAt] = useState<string>('')
  const [editParticipantLimit, setEditParticipantLimit] = useState<string>('')
  const [editMaxConcurrentRaceParticipations, setEditMaxConcurrentRaceParticipations] = useState<string>('')
  const [editScoringRulesMode, setEditScoringRulesMode] = useState<'STANDARD' | 'CUSTOM'>('STANDARD')
  const [editCustomScoringTables, setEditCustomScoringTables] = useState<Record<string, Record<number, number>>>(DEFAULT_SCORING_TABLES)
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  const [createRaceError, setCreateRaceError] = useState<string | null>(null)
  const [editEventError, setEditEventError] = useState<string | null>(null)

  // Set race edit values when modal is toggled or race selection changes
  useEffect(() => {
    if (selectedRace) {
      setRaceEditName(selectedRace.name)
      setRaceEditLocation(selectedRace.location)
      setRaceEditDistance(selectedRace.distanceMeters)
      setRaceEditTrackType(selectedRace.trackType)
      setRaceEditClassRestriction(selectedRace.classRestriction)
      setRaceEditGrade(selectedRace.grade)
      setRaceEditParticipantLimit(selectedRace.participantLimit !== null ? String(selectedRace.participantLimit) : '')
      setRaceEditError(null)
    }
  }, [showEditRaceModal, selectedRace])

  // Set edit values when modal is toggled or event loads
  useEffect(() => {
    if (selectedEvent) {
      setEditName(selectedEvent.name)
      setEditDescription(selectedEvent.description ?? '')
      setEditClassRestriction(selectedEvent.classRestriction)
      setEditGranularParticipation(selectedEvent.granularParticipation)
      setEditSignupsLocked(selectedEvent.signupsLocked)
      setEditScheduledAt(selectedEvent.scheduledAt ? toLocalISOString(selectedEvent.scheduledAt) : '')
      setEditParticipantLimit(selectedEvent.participantLimit !== null ? String(selectedEvent.participantLimit) : '')
      setEditMaxConcurrentRaceParticipations(selectedEvent.maxConcurrentRaceParticipations !== null ? String(selectedEvent.maxConcurrentRaceParticipations) : '')
      setEditScoringRulesMode((selectedEvent.scoringRulesMode as 'STANDARD' | 'CUSTOM') || 'STANDARD')
      if (selectedEvent.customScoringTables) {
        setEditCustomScoringTables(selectedEvent.customScoringTables)
      } else {
        setEditCustomScoringTables(DEFAULT_SCORING_TABLES)
      }
    }
  }, [showEditEventModal, selectedEvent])

  const performSaveEventDetails = async () => {
    const limitNum = editParticipantLimit.trim() ? Number(editParticipantLimit) : null
    const maxConcurrentNum = editMaxConcurrentRaceParticipations.trim() ? Number(editMaxConcurrentRaceParticipations) : null

    if (!editGranularParticipation && limitNum !== null && (isNaN(limitNum) || !Number.isSafeInteger(limitNum) || limitNum <= 0)) {
      window.alert('Participant limit must be a positive whole number.')
      return
    }

    if (editGranularParticipation && maxConcurrentNum !== null && (isNaN(maxConcurrentNum) || !Number.isSafeInteger(maxConcurrentNum) || maxConcurrentNum <= 0)) {
      window.alert('Max races per participant must be a positive whole number.')
      return
    }

    try {
      await handleUpdateEventDetails({
        name: editName,
        description: editDescription || null,
        classRestriction: editClassRestriction || null,
        scheduledAt: editScheduledAt ? new Date(editScheduledAt).toISOString() : null,
        participantLimit: editGranularParticipation ? null : limitNum,
        maxConcurrentRaceParticipations: editGranularParticipation ? maxConcurrentNum : null,
        scoringRulesMode: editScoringRulesMode,
        customScoringTables: editScoringRulesMode === 'CUSTOM' ? editCustomScoringTables : null,
      })
      if (selectedEvent && editSignupsLocked !== selectedEvent.signupsLocked) {
        await handleSetSignupsLocked(editSignupsLocked)
      }
      setShowEditEventModal(false)
    } catch (err: any) {
      setEditEventError(err.message || 'Failed to update event.')
    }
  }

  const onEditEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (selectedEvent && selectedEvent.scoringType === 1 && editScoringRulesMode === 'CUSTOM') {
      const grades = ['OP', 'GIII', 'GII', 'GI']
      for (const grade of grades) {
        const table = editCustomScoringTables[grade]
        if (!table) {
          window.alert(`Custom table for grade ${grade} is missing.`)
          return
        }
        for (let pos = 1; pos <= 10; pos++) {
          const val = table[pos]
          if (val === undefined || val === null || String(val).trim() === '') {
            window.alert(`Custom table for grade ${grade} is missing value for position #${pos}.`)
            return
          }
          const num = Number(val)
          if (!Number.isInteger(num) || num < 0) {
            window.alert(`Custom table for grade ${grade}, position #${pos} must be a valid non-negative integer.`)
            return
          }
        }
      }
    }

    const scoringRulesChanged = selectedEvent && selectedEvent.scoringType === 1 && (
      selectedEvent.scoringRulesMode !== editScoringRulesMode ||
      (editScoringRulesMode === 'CUSTOM' && JSON.stringify(selectedEvent.customScoringTables) !== JSON.stringify(editCustomScoringTables))
    )

    if (scoringRulesChanged) {
      setShowConfirmModal(true)
    } else {
      await performSaveEventDetails()
    }
  }

  const performSaveRaceDetails = async () => {
    if (!selectedRace) return
    const limitNum = raceEditParticipantLimit.trim() ? Number(raceEditParticipantLimit) : null
    if (limitNum !== null && (isNaN(limitNum) || !Number.isSafeInteger(limitNum) || limitNum <= 0)) {
      setRaceEditError('Race participant limit must be a positive whole number.')
      return
    }

    try {
      await handleUpdateRace(selectedRace.id, {
        name: raceEditName.trim(),
        location: raceEditLocation.trim(),
        distanceMeters: raceEditDistance,
        trackType: raceEditTrackType.trim(),
        classRestriction: raceEditClassRestriction,
        grade: raceEditGrade,
        participantLimit: limitNum,
      })
      setShowEditRaceModal(false)
    } catch (err: any) {
      setRaceEditError(err.message || 'Failed to update race.')
    }
  }

  const onEditRaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setRaceEditError(null)

    const trimmedName = raceEditName.trim()
    const trimmedLocation = raceEditLocation.trim()
    const trimmedTrackType = raceEditTrackType.trim()

    if (!trimmedName) {
      setRaceEditError('Race name is required and cannot be empty.')
      return
    }
    if (!trimmedLocation) {
      setRaceEditError('Location is required and cannot be empty.')
      return
    }
    if (!trimmedTrackType) {
      setRaceEditError('Track Type is required and cannot be empty.')
      return
    }
    if (!Number.isInteger(raceEditDistance) || raceEditDistance <= 0) {
      setRaceEditError('Distance must be a valid integer greater than 0.')
      return
    }

    const hasResults = results && results.length > 0
    const gradeChanged = selectedRace && selectedRace.grade !== raceEditGrade
    const isPointsBased = selectedEvent && selectedEvent.scoringType === 1

    if (isPointsBased && hasResults && gradeChanged) {
      setShowRaceGradeConfirm(true)
    } else {
      await performSaveRaceDetails()
    }
  }

  const onCreateRaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateRaceError(null)
    try {
      await handleCreateRace(e)
      setShowCreateRaceModal(false)
    } catch (err: any) {
      setCreateRaceError(err.message || 'Failed to create race.')
    }
  }

  return (
    <AdminLayout>
      {globalError && (
        <AlertBanner variant="error">{globalError}</AlertBanner>
      )}
      {globalSuccess && (
        <AlertBanner variant="success">{globalSuccess}</AlertBanner>
      )}

      {/* Event Onboarding Guidance Banners */}
      {!loadingEventDetail && selectedEvent && (
        <div style={{ marginBottom: '1.5rem' }}>
          {selectedEvent.status === 'DRAFT' && (
            <AlertBanner variant="warning">
              <div style={{ textAlign: 'left' }}>
                <strong>Event Status: DRAFT (Setup Mode)</strong>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px' }}>
                  This event is in private preparation. <strong>Next steps:</strong> Register participants under the "Event Members" tab, create race tracks under the "Races & Tracks" tab, and set Lifecycle Status to <strong>UNOFFICIAL</strong> to publish it.
                </p>
              </div>
            </AlertBanner>
          )}
          {selectedEvent.status === 'UNOFFICIAL' && (
            <AlertBanner variant="warning">
              <div style={{ textAlign: 'left' }}>
                <strong>Event Status: UNOFFICIAL (Live / Staging)</strong>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px' }}>
                  This event is visible to participants. <strong>Next steps:</strong> Start and end configured races from the "Races & Tracks" tab, record standings, and set status to <strong>OFFICIAL</strong> (admins only) or <strong>CONCLUDED</strong> to finalize.
                </p>
              </div>
            </AlertBanner>
          )}
          {selectedEvent.status === 'OFFICIAL' && (
            <AlertBanner variant="success">
              <div style={{ textAlign: 'left' }}>
                <strong>Event Status: OFFICIAL (Validated)</strong>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px' }}>
                  Results and overall points have been approved by Site Administrators. Real-time scores and standings are finalized.
                </p>
              </div>
            </AlertBanner>
          )}
          {selectedEvent.status === 'CONCLUDED' && (
            <AlertBanner variant="warning">
              <div style={{ textAlign: 'left' }}>
                <strong>Event Status: CONCLUDED (Locked)</strong>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px' }}>
                  This competition has finished. Historical standings are locked and archived.
                </p>
              </div>
            </AlertBanner>
          )}
        </div>
      )}

      {loadingEventDetail ? (
        <SldsSkeletonDetail />
      ) : selectedEvent ? (
        <>
          <div style={{ marginBottom: '1rem' }}>
            <Button as={Link as any} to="/admin/events">
              &larr; Back to Events
            </Button>
          </div>
          <div style={{
          border: '1px solid var(--color-border-default)',
          borderRadius: '6px',
          padding: '1.5rem',
          boxShadow: 'var(--color-shadow-small)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            borderBottom: '1px solid var(--color-border-default)',
            paddingBottom: '1rem',
            marginBottom: '1.5rem'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <Heading as="h2" style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>{selectedEvent.name}</Heading>
                <Button size="small" onClick={() => setShowEditEventModal(true)}>
                  Edit Details
                </Button>
                {selectedEvent.scoringType === 1 && (
                  <Button size="small" onClick={() => void handleRecomputeEventPoints()}>
                    Recompute Points
                  </Button>
                )}
              </div>
              <p style={{ fontSize: '12px', color: 'var(--color-fg-muted)', margin: '4px 0 0 0' }}>ID: {selectedEvent.id}</p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
              {/* Signups Lock Controller */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 'bold', fontSize: '14px' }}>Signups:</span>
                <Button
                  disabled={signupsLockedSaving}
                  onClick={() => void handleSetSignupsLocked(!selectedEvent.signupsLocked)}
                  variant={selectedEvent.signupsLocked ? 'danger' : 'primary'}
                >
                  {selectedEvent.signupsLocked ? 'Signups Locked' : 'Signups Open'}
                </Button>
              </div>

              {/* Status controller */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 'bold', fontSize: '14px' }}>Lifecycle Status:</span>
                <Select
                  disabled={eventStatusSaving}
                  value={selectedEvent.status}
                  onChange={(e) => void handleUpdateEventStatus(e.target.value as eventmanager.EventStatus)}
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </div>

          {/* Underline Tabs */}
          <div>
            <UnderlineNav aria-label="Event Operations Navigation">
              <UnderlineNav.Item onClick={() => setActiveTab('details')} aria-current={activeTab === 'details' ? 'page' : undefined}>
                Event Summary
              </UnderlineNav.Item>
              <UnderlineNav.Item onClick={() => setActiveTab('members')} aria-current={activeTab === 'members' ? 'page' : undefined}>
                Event Members ({selectedEvent.members.length})
              </UnderlineNav.Item>
              <UnderlineNav.Item onClick={() => setActiveTab('races')} aria-current={activeTab === 'races' ? 'page' : undefined}>
                Races & Tracks ({races.length})
              </UnderlineNav.Item>
              <UnderlineNav.Item onClick={() => setActiveTab('datasets')} aria-current={activeTab === 'datasets' ? 'page' : undefined}>
                Datasets
              </UnderlineNav.Item>
            </UnderlineNav>

            {/* Tab 1: Summary Info */}
            {activeTab === 'details' && (
              <EventSummaryTab selectedEvent={selectedEvent} />
            )}

            {/* Tab 2: Registered Members */}
            {activeTab === 'members' && (
              <EventMembersTab
                selectedEvent={selectedEvent}
                newMemberUserId={newMemberUserId}
                setNewMemberUserId={setNewMemberUserId}
                handleAddMember={handleAddMember}
                handleRemoveMember={handleRemoveMember}
              />
            )}

            {/* Tab 3: Unified Races & Tracks Experience */}
            {activeTab === 'races' && (
              <EventRacesTab
                races={races}
                selectedRaceId={selectedRaceId}
                setSelectedRaceId={setSelectedRaceId}
                selectedRace={selectedRace}
                ongoingRaces={ongoingRaces}
                concludedRaces={concludedRaces}
                notStartedRaces={notStartedRaces}
                handleSelectRace={handleSelectRace}
                handleReorderRaces={handleReorderRaces}
                hasStartedOrConcludedRaces={hasStartedOrConcludedRaces}
                setShowCreateRaceModal={setShowCreateRaceModal}
                selectedEvent={selectedEvent}
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
            )}

            {/* Tab 4: Datasets (Disabled Placeholder) */}
            {activeTab === 'datasets' && (
              <div style={{
                textAlign: 'center',
                padding: '3rem',
                color: 'var(--color-fg-muted)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '300px'
              }}>
                <Heading as="h4" style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 8px 0' }}>Importing records is coming soon</Heading>
                <Text style={{ fontSize: '14px' }}>
                  Dataset import formats are still being finalized.
                </Text>
              </div>
            )}
          </div>
        </div>
        </>
      ) : (
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          backgroundColor: 'var(--color-canvas-default)',
          border: '1px solid var(--color-border-default)',
          borderRadius: '6px',
          minHeight: '400px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <div>
            <Heading as="h2" style={{ fontSize: '20px', fontWeight: 'bold' }}>
              Event Not Found
            </Heading>
            <Text style={{ fontSize: '14px', color: 'var(--color-fg-muted)', display: 'block', margin: '8px 0 1.5rem 0' }}>
              The requested event could not be loaded. It may have been deleted.
            </Text>
            <Button as={Link as any} to="/admin/events" variant="primary">
              &larr; Back to Events
            </Button>
          </div>
        </div>
      )}
      {showCreateRaceModal && (
        <Dialog
          onClose={() => setShowCreateRaceModal(false)}
          title="Configure New Race Track"
        >
          <form onSubmit={onCreateRaceSubmit}>
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {createRaceError && (
                <AlertBanner variant="error">{createRaceError}</AlertBanner>
              )}

              <p style={{ fontSize: '13px', color: 'var(--color-fg-muted)', fontStyle: 'italic', margin: 0 }}>
                New races are added to the end of the event schedule. You can reorder them later from the race list.
              </p>

              <FormControl required>
                <FormControl.Label style={{ fontWeight: 'bold' }}>Race Name</FormControl.Label>
                <TextInput
                  type="text"
                  required
                  placeholder="e.g. Kyoto Derby"
                  value={newRaceForm.name}
                  onChange={(e) => setNewRaceForm((c) => ({ ...c, name: e.target.value }))}
                  width="100%"
                />
              </FormControl>

              <FormControl>
                <FormControl.Label style={{ fontWeight: 'bold' }}>Distance (Meters)</FormControl.Label>
                <TextInput
                  type="number"
                  value={newRaceForm.distanceMeters}
                  onChange={(e) => setNewRaceForm((c) => ({ ...c, distanceMeters: Number(e.target.value) || 1200 }))}
                  width="100%"
                />
              </FormControl>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem' }}>
                <FormControl>
                  <FormControl.Label style={{ fontWeight: 'bold' }}>Track Type</FormControl.Label>
                  <TextInput
                    type="text"
                    placeholder="e.g. Turf, Dirt"
                    value={newRaceForm.trackType}
                    onChange={(e) => setNewRaceForm((c) => ({ ...c, trackType: e.target.value }))}
                    width="100%"
                  />
                </FormControl>

                <FormControl required>
                  <FormControl.Label style={{ fontWeight: 'bold' }}>Location</FormControl.Label>
                  <TextInput
                    type="text"
                    required
                    placeholder="e.g. Kyoto Racecourse"
                    value={newRaceForm.location}
                    onChange={(e) => setNewRaceForm((c) => ({ ...c, location: e.target.value }))}
                    width="100%"
                  />
                </FormControl>

                <FormControl>
                  <FormControl.Label style={{ fontWeight: 'bold' }}>Class Restriction</FormControl.Label>
                  <Select
                    value={newRaceForm.classRestriction || ''}
                    onChange={(e) => setNewRaceForm((c) => ({ ...c, classRestriction: e.target.value ? e.target.value as eventmanager.ClassTier : null }))}
                    width="100%"
                  >
                    <option value="">Any Tier Eligibility (None)</option>
                    {CLASS_TIER_OPTIONS.map((tier) => (
                      <option key={tier} value={tier}>{tier}</option>
                    ))}
                  </Select>
                </FormControl>

                {selectedEvent && selectedEvent.scoringType === 1 && (
                  <FormControl>
                    <FormControl.Label style={{ fontWeight: 'bold' }}>Race Grade</FormControl.Label>
                    <Select
                      value={newRaceForm.grade || ''}
                      onChange={(e) => setNewRaceForm((c) => ({ ...c, grade: e.target.value }))}
                      width="100%"
                    >
                      <option value="">-- Choose Grade --</option>
                      <option value="OP">OP</option>
                      <option value="GIII">GIII</option>
                      <option value="GII">GII</option>
                      <option value="GI">GI</option>
                    </Select>
                  </FormControl>
                )}
              </div>

              {selectedEvent && selectedEvent.granularParticipation && (
                <FormControl>
                  <FormControl.Label style={{ fontWeight: 'bold' }}>Race participant limit</FormControl.Label>
                  <TextInput
                    type="number"
                    min="1"
                    placeholder="e.g. 10"
                    value={newRaceForm.participantLimit !== null ? String(newRaceForm.participantLimit) : ''}
                    onChange={(e) => {
                      const val = e.target.value
                      setNewRaceForm((c) => ({ ...c, participantLimit: val ? Number(val) : null }))
                    }}
                    width="100%"
                  />
                  <FormControl.Caption>
                    Maximum participants for this race. Leave blank for unlimited.
                  </FormControl.Caption>
                </FormControl>
              )}
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              padding: '1rem 1.5rem',
              borderTop: '1px solid var(--color-border-default)',
              backgroundColor: 'var(--color-canvas-subtle)',
            }}>
              <Button type="button" onClick={() => setShowCreateRaceModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Create Race Track
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* EDIT EVENT DETAILS DIALOG MODAL */}
      {showEditEventModal && (
        <Dialog
          onClose={() => setShowEditEventModal(false)}
          title="Edit Event Details"
        >
          <form onSubmit={onEditEventSubmit}>
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '70vh', overflowY: 'auto' }}>
              {editEventError && (
                <AlertBanner variant="error">{editEventError}</AlertBanner>
              )}

              <FormControl required>
                <FormControl.Label style={{ fontWeight: 'bold' }}>Event Name</FormControl.Label>
                <TextInput
                  type="text"
                  required
                  placeholder="e.g. Winter Derby Championship"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  width="100%"
                />
              </FormControl>

              <FormControl>
                <FormControl.Label style={{ fontWeight: 'bold' }}>Description</FormControl.Label>
                <Textarea
                  placeholder="Brief description..."
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  style={{ width: '100%' }}
                  rows={3}
                />
              </FormControl>

              {selectedEvent && selectedEvent.scoringType === 1 && (
                <div style={{ borderTop: '1px solid var(--color-border-default)', paddingTop: '1rem' }}>
                  <FormControl>
                    <FormControl.Label style={{ fontWeight: 'bold' }}>Points Scoring Rules Source</FormControl.Label>
                    <Select
                      value={editScoringRulesMode}
                      onChange={(e) => setEditScoringRulesMode(e.target.value as 'STANDARD' | 'CUSTOM')}
                      width="100%"
                    >
                      <option value="STANDARD">Standard Default Tables</option>
                      <option value="CUSTOM">Custom Event Tables (Configure below)</option>
                    </Select>
                  </FormControl>

                  {editScoringRulesMode === 'CUSTOM' && (
                    <div style={{ marginTop: '1rem' }}>
                      <EventScoringTablesEditor
                        value={editCustomScoringTables}
                        onChange={setEditCustomScoringTables}
                      />
                    </div>
                  )}
                </div>
              )}

              <FormControl>
                <FormControl.Label style={{ fontWeight: 'bold' }}>
                  Scheduled Date / Time ({Intl.DateTimeFormat().resolvedOptions().timeZone})
                </FormControl.Label>
                <TextInput
                  type="datetime-local"
                  value={editScheduledAt}
                  onChange={(e) => setEditScheduledAt(e.target.value)}
                  width="100%"
                />
              </FormControl>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', borderTop: '1px solid var(--color-border-default)', paddingTop: '1rem' }}>
                <FormControl>
                  <FormControl.Label style={{ fontWeight: 'bold' }}>Class Tier Eligibility</FormControl.Label>
                  <Select
                    value={editClassRestriction || ''}
                    onChange={(e) => setEditClassRestriction(e.target.value ? e.target.value as eventmanager.ClassTier : null)}
                    width="100%"
                  >
                    <option value="">Any Tier Eligibility (None)</option>
                    <option value="G3">G3</option>
                    <option value="G2">G2</option>
                    <option value="G1">G1</option>
                  </Select>
                </FormControl>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center' }}>
                  <div>
                    <span style={{ fontWeight: 'bold', fontSize: '13px', display: 'block', marginBottom: '4px' }}>Participation Model</span>
                    <Label variant="default">
                      {editGranularParticipation ? 'Granular (Per-Race)' : 'Regular (Event-wide)'}
                    </Label>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      id="edit-signups-locked"
                      checked={editSignupsLocked}
                      onChange={(e) => setEditSignupsLocked(e.target.checked)}
                    />
                    <label htmlFor="edit-signups-locked" style={{ fontWeight: 'bold', fontSize: '13px' }}>
                      Lock Event Signups
                    </label>
                  </div>
                </div>
              </div>

              {!editGranularParticipation ? (
                <FormControl>
                  <FormControl.Label style={{ fontWeight: 'bold' }}>Participant limit</FormControl.Label>
                  <TextInput
                    type="number"
                    min="1"
                    placeholder="e.g. 20"
                    value={editParticipantLimit}
                    onChange={(e) => setEditParticipantLimit(e.target.value)}
                    width="100%"
                  />
                  <FormControl.Caption>
                    Maximum participants for the whole event. Leave blank for unlimited.
                  </FormControl.Caption>
                </FormControl>
              ) : (
                <FormControl>
                  <FormControl.Label style={{ fontWeight: 'bold' }}>Max races per participant</FormControl.Label>
                  <TextInput
                    type="number"
                    min="1"
                    placeholder="e.g. 3"
                    value={editMaxConcurrentRaceParticipations}
                    onChange={(e) => setEditMaxConcurrentRaceParticipations(e.target.value)}
                    width="100%"
                  />
                  <FormControl.Caption>
                    Maximum races one participant may join in this event. Leave blank for unlimited.
                  </FormControl.Caption>
                </FormControl>
              )}
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              padding: '1rem 1.5rem',
              borderTop: '1px solid var(--color-border-default)',
              backgroundColor: 'var(--color-canvas-subtle)',
            }}>
              <Button type="button" onClick={() => setShowEditEventModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Save Changes
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* CONFIRM RECOMPUTE WARNING DIALOG MODAL */}
      {showConfirmModal && (
        <Dialog
          onClose={() => setShowConfirmModal(false)}
          title="Recalculate Points Warning"
        >
          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ fontSize: '14px', lineHeight: '1.5', margin: 0 }}>
              Changing the event's scoring tables will trigger an <strong>automatic background recomputation</strong> of points for all existing race results associated with this event.
            </p>
            <p style={{ fontSize: '13px', lineHeight: '1.5', color: 'var(--color-danger-fg)', fontWeight: 'bold', margin: 0 }}>
              ⚠️ This can invalidate previously computed points on recorded standings.
            </p>
            <p style={{ fontSize: '14px', lineHeight: '1.5', margin: 0 }}>
              Are you absolutely sure you want to proceed and save these changes?
            </p>
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--color-border-default)',
            backgroundColor: 'var(--color-canvas-subtle)',
          }}>
            <Button type="button" onClick={() => setShowConfirmModal(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={async () => {
                setShowConfirmModal(false)
                await performSaveEventDetails()
              }}
            >
              Confirm & Save
            </Button>
          </div>
        </Dialog>
      )}

      {/* EDIT RACE DIALOG MODAL */}
      {showEditRaceModal && selectedRace && (
        <Dialog
          onClose={() => setShowEditRaceModal(false)}
          title="Edit Race Details"
        >
          <form onSubmit={onEditRaceSubmit}>
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {raceEditError && (
                <AlertBanner variant="error">{raceEditError}</AlertBanner>
              )}

              <FormControl required>
                <FormControl.Label style={{ fontWeight: 'bold' }}>Race Name</FormControl.Label>
                <TextInput
                  type="text"
                  required
                  placeholder="e.g. Kyoto Derby"
                  value={raceEditName}
                  onChange={(e) => setRaceEditName(e.target.value)}
                  width="100%"
                />
              </FormControl>

              <FormControl required>
                <FormControl.Label style={{ fontWeight: 'bold' }}>Distance (Meters)</FormControl.Label>
                <TextInput
                  type="number"
                  required
                  value={raceEditDistance}
                  onChange={(e) => setRaceEditDistance(Number(e.target.value) || 0)}
                  width="100%"
                />
              </FormControl>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem' }}>
                <FormControl required>
                  <FormControl.Label style={{ fontWeight: 'bold' }}>Track Type</FormControl.Label>
                  <TextInput
                    type="text"
                    required
                    placeholder="e.g. Turf, Dirt"
                    value={raceEditTrackType}
                    onChange={(e) => setRaceEditTrackType(e.target.value)}
                    width="100%"
                  />
                </FormControl>

                <FormControl required>
                  <FormControl.Label style={{ fontWeight: 'bold' }}>Location</FormControl.Label>
                  <TextInput
                    type="text"
                    required
                    placeholder="e.g. Kyoto Racecourse"
                    value={raceEditLocation}
                    onChange={(e) => setRaceEditLocation(e.target.value)}
                    width="100%"
                  />
                </FormControl>

                <FormControl>
                  <FormControl.Label style={{ fontWeight: 'bold' }}>Class Restriction</FormControl.Label>
                  <Select
                    value={raceEditClassRestriction || ''}
                    onChange={(e) => setRaceEditClassRestriction(e.target.value ? e.target.value as eventmanager.ClassTier : null)}
                    width="100%"
                  >
                    <option value="">Any Tier (None)</option>
                    {CLASS_TIER_OPTIONS.map((tier) => (
                      <option key={tier} value={tier}>{tier}</option>
                    ))}
                  </Select>
                </FormControl>

                {selectedEvent && selectedEvent.scoringType === 1 && (
                  <FormControl>
                    <FormControl.Label style={{ fontWeight: 'bold' }}>Race Grade</FormControl.Label>
                    <Select
                      value={raceEditGrade || ''}
                      onChange={(e) => setRaceEditGrade(e.target.value || null)}
                      width="100%"
                    >
                      <option value="">-- Choose Grade --</option>
                      <option value="OP">OP</option>
                      <option value="GIII">GIII</option>
                      <option value="GII">GII</option>
                      <option value="GI">GI</option>
                    </Select>
                  </FormControl>
                )}
              </div>

              {selectedEvent && selectedEvent.granularParticipation && (
                <FormControl>
                  <FormControl.Label style={{ fontWeight: 'bold' }}>Race participant limit</FormControl.Label>
                  <TextInput
                    type="number"
                    min="1"
                    placeholder="e.g. 10"
                    value={raceEditParticipantLimit}
                    onChange={(e) => setRaceEditParticipantLimit(e.target.value)}
                    width="100%"
                  />
                  <FormControl.Caption>
                    Maximum participants for this race. Leave blank for unlimited.
                  </FormControl.Caption>
                </FormControl>
              )}
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              padding: '1rem 1.5rem',
              borderTop: '1px solid var(--color-border-default)',
              backgroundColor: 'var(--color-canvas-subtle)',
            }}>
              <Button type="button" onClick={() => setShowEditRaceModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Save Changes
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* CONFIRM RACE GRADE CHANGE RECOMPUTE WARNING DIALOG MODAL */}
      {showRaceGradeConfirm && (
        <Dialog
          onClose={() => setShowRaceGradeConfirm(false)}
          title="Recalculate Race Points Warning"
        >
          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ fontSize: '14px', lineHeight: '1.5', margin: 0 }}>
              Changing this race's grade will trigger an <strong>automatic recomputation of points</strong> for all recorded results in this specific race.
            </p>
            <p style={{ fontSize: '13px', lineHeight: '1.5', color: 'var(--color-danger-fg)', fontWeight: 'bold', margin: 0 }}>
              ⚠️ Existing results will be recalculated immediately based on the new grade's scoring table.
            </p>
            <p style={{ fontSize: '14px', lineHeight: '1.5', margin: 0 }}>
              Are you sure you want to proceed and update the race grade?
            </p>
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--color-border-default)',
            backgroundColor: 'var(--color-canvas-subtle)',
          }}>
            <Button type="button" onClick={() => setShowRaceGradeConfirm(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={async () => {
                setShowRaceGradeConfirm(false)
                await performSaveRaceDetails()
              }}
            >
              Confirm & Save
            </Button>
          </div>
        </Dialog>
      )}
    </AdminLayout>
  )
}
