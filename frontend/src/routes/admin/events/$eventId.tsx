import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import {
  Button,
  Checkbox,
  Dialog,
  Flash,
  FormControl,
  Label,
  Select,
  Textarea,
  TextInput,
  UnderlineNav,
} from '@primer/react'
import {
  ArrowLeftIcon,
  DatabaseIcon,
  InfoIcon,
  LockIcon,
  PencilIcon,
  PeopleIcon,
  SyncIcon,
  TrashIcon,
  TrophyIcon,
  UnlockIcon,
} from '@primer/octicons-react'
import { requireAdminPanel } from '../../../lib/auth-guard'
import { AdminLayout } from '../-AdminLayout'
import { useEventDetail } from '../../../hooks/useEventDetail'
import { AlertBanner } from '../../../components/AlertBanner'
import { PrimerSkeletonDetail } from '../../../components/LoadingSkeleton'
import { EventScoringTablesEditor } from '../../../components/EventScoringTablesEditor'
import { EventSummaryTab } from '../../../components/EventSummaryTab'
import { EventMembersTab } from '../../../components/EventMembersTab'
import { EventRacesTab } from '../../../components/EventRacesTab'
import { DEFAULT_SCORING_TABLES } from '../../../lib/scoringDefaults'
import { toLocalISOString } from '../../../lib/datetime'
import type { ClassTier, EventStatus, EventTag } from '../../../types'

export const Route = createFileRoute('/admin/events/$eventId')({
  beforeLoad: async ({ location }) => {
    await requireAdminPanel(location)
  },
  component: AdminEventDetailPage,
})

function AdminEventDetailPage() {
  const { eventId } = Route.useParams()
  const {
    STATUS_OPTIONS,
    TAG_OPTIONS,
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
    handleDeleteEvent,
    handleRestoreEvent,
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
  const [raceEditClassRestriction, setRaceEditClassRestriction] = useState<ClassTier | null>(null)
  const [raceEditGrade, setRaceEditGrade] = useState<string | null>(null)
  const [raceEditParticipantLimit, setRaceEditParticipantLimit] = useState<string>('')
  const [showRaceGradeConfirm, setShowRaceGradeConfirm] = useState(false)
  const [raceEditError, setRaceEditError] = useState<string | null>(null)

  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editClassRestriction, setEditClassRestriction] = useState<ClassTier | null>(null)
  const [editGranularParticipation, setEditGranularParticipation] = useState(false)
  const [editSignupsLocked, setEditSignupsLocked] = useState(false)
  const [editScheduledAt, setEditScheduledAt] = useState<string>('')
  const [editParticipantLimit, setEditParticipantLimit] = useState<string>('')
  const [editMaxConcurrentRaceParticipations, setEditMaxConcurrentRaceParticipations] = useState<string>('')
  const [editScoringRulesMode, setEditScoringRulesMode] = useState<'STANDARD' | 'CUSTOM'>('STANDARD')
  const [editCustomScoringTables, setEditCustomScoringTables] = useState<Record<string, Record<number, number>>>(DEFAULT_SCORING_TABLES)
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  useEffect(() => {
    if (selectedRace) {
      setRaceEditName(selectedRace.name)
      setRaceEditLocation(selectedRace.location)
      setRaceEditDistance(selectedRace.distanceMeters)
      setRaceEditTrackType(selectedRace.trackType)
      setRaceEditClassRestriction(selectedRace.classRestriction as ClassTier | null)
      setRaceEditGrade(selectedRace.grade)
      setRaceEditParticipantLimit(selectedRace.participantLimit !== null ? String(selectedRace.participantLimit) : '')
      setRaceEditError(null)
    }
  }, [showEditRaceModal, selectedRace])

  useEffect(() => {
    if (selectedEvent) {
      setEditName(selectedEvent.name)
      setEditDescription(selectedEvent.description ?? '')
      setEditClassRestriction(selectedEvent.classRestriction as ClassTier | null)
      setEditGranularParticipation(selectedEvent.granularParticipation)
      setEditSignupsLocked(selectedEvent.signupsLocked)
      setEditScheduledAt(selectedEvent.scheduledAt ? toLocalISOString(selectedEvent.scheduledAt) : '')
      setEditParticipantLimit(selectedEvent.participantLimit !== null ? String(selectedEvent.participantLimit) : '')
      setEditMaxConcurrentRaceParticipations(
        selectedEvent.maxConcurrentRaceParticipations !== null ? String(selectedEvent.maxConcurrentRaceParticipations) : '',
      )
      setEditScoringRulesMode((selectedEvent.scoringRulesMode as 'STANDARD' | 'CUSTOM') || 'STANDARD')
      if (selectedEvent.customScoringTables) {
        setEditCustomScoringTables(selectedEvent.customScoringTables as Record<string, Record<number, number>>)
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

    const scoringRulesChanged =
      selectedEvent &&
      selectedEvent.scoringType === 1 &&
      (selectedEvent.scoringRulesMode !== editScoringRulesMode ||
        (editScoringRulesMode === 'CUSTOM' &&
          JSON.stringify(selectedEvent.customScoringTables) !== JSON.stringify(editCustomScoringTables)))

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
  }

  const onEditRaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setRaceEditError(null)

    if (!raceEditName.trim()) {
      setRaceEditError('Race name is required and cannot be empty.')
      return
    }
    if (!raceEditLocation.trim()) {
      setRaceEditError('Location is required and cannot be empty.')
      return
    }
    if (!raceEditTrackType.trim()) {
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
    await handleCreateRace(e)
    setShowCreateRaceModal(false)
  }

  return (
    <AdminLayout
      title={selectedEvent ? selectedEvent.name : 'Event & Race Operations'}
      subtitle={selectedEvent ? `Event ID: ${selectedEvent.id}` : 'Manage event lifecycle, competitors, race tracks, and standings.'}
      breadcrumbs={[
        { label: 'Admin', to: '/admin' },
        { label: 'Events', to: '/admin/events' },
        { label: selectedEvent ? selectedEvent.name : eventId },
      ]}
      actions={
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Link to="/admin/events" style={{ textDecoration: 'none' }}>
            <Button leadingVisual={ArrowLeftIcon}>Back to Events</Button>
          </Link>
          {selectedEvent && (
            <>
              <Button type="button" leadingVisual={PencilIcon} onClick={() => setShowEditEventModal(true)}>
                Edit Details
              </Button>
              {selectedEvent.scoringType === 1 && (
                <Button type="button" leadingVisual={SyncIcon} onClick={() => void handleRecomputeEventPoints()}>
                  Recompute Points
                </Button>
              )}
              {selectedEvent.status !== 'PENDING_DELETION' && (
                <Button
                  type="button"
                  variant="danger"
                  leadingVisual={TrashIcon}
                  onClick={() => {
                    if (window.confirm('Move this event to the Pending Deletion queue? It will be deleted in 7 days.')) {
                      void handleDeleteEvent(false)
                    }
                  }}
                >
                  Delete Event
                </Button>
              )}
            </>
          )}
        </div>
      }
    >
      {globalError && <AlertBanner variant="error">{globalError}</AlertBanner>}
      {globalSuccess && <AlertBanner variant="success">{globalSuccess}</AlertBanner>}

      {/* Event Status Guidance Banners */}
      {!loadingEventDetail && selectedEvent && (
        <>
          {selectedEvent.status === 'DRAFT' && (
            <AlertBanner variant="warning">
              <strong>DRAFT (Setup Mode):</strong> Register participants, configure race tracks, and set Lifecycle Status to <strong>PENDING</strong> to publish.
            </AlertBanner>
          )}
          {selectedEvent.status === 'PENDING' && (
            <AlertBanner variant="info">
              <strong>PENDING (Published / Scheduled):</strong> Open for signups. Set status to <strong>ONGOING</strong> when races begin, or <strong>CONCLUDED</strong> when finished.
            </AlertBanner>
          )}
          {selectedEvent.status === 'ONGOING' && (
            <AlertBanner variant="success">
              <strong>ONGOING (Live Competition):</strong> Record standings under &quot;Races &amp; Tracks&quot; and set status to <strong>CONCLUDED</strong> when finished.
            </AlertBanner>
          )}
          {selectedEvent.status === 'CONCLUDED' && (
            <AlertBanner variant="warning">
              <strong>CONCLUDED (Locked):</strong> Competition finished. Historical standings are finalized.
            </AlertBanner>
          )}
          {selectedEvent.status === 'PENDING_DELETION' && (
            <AlertBanner
              variant="error"
              action={
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button size="small" variant="primary" onClick={() => void handleRestoreEvent()}>
                    Restore Event
                  </Button>
                  <Button
                    size="small"
                    variant="danger"
                    onClick={() => {
                      if (window.confirm('Permanently delete this event? This cannot be undone.')) {
                        void handleDeleteEvent(true)
                      }
                    }}
                  >
                    Delete Permanently
                  </Button>
                </div>
              }
            >
              <strong>PENDING DELETION:</strong> This event is soft-deleted and queued for permanent purge in 7 days.
            </AlertBanner>
          )}
        </>
      )}

      {loadingEventDetail ? (
        <PrimerSkeletonDetail />
      ) : selectedEvent ? (
        <div className="primer-box" style={{ padding: '16px 20px' }}>
          {/* Inline Controls Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              paddingBottom: '14px',
              marginBottom: '8px',
              borderBottom: '1px solid var(--borderColor-muted, #d8dee4)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <Label variant={selectedEvent.tag === 'OFFICIAL' ? 'sponsors' : 'secondary'}>
                {selectedEvent.tag || 'OFFICIAL'}
              </Label>
              <Label variant={selectedEvent.signupsLocked ? 'danger' : 'success'}>
                {selectedEvent.signupsLocked ? 'Signups Locked' : 'Signups Open'}
              </Label>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <Button
                type="button"
                size="small"
                variant={selectedEvent.signupsLocked ? 'danger' : 'default'}
                leadingVisual={selectedEvent.signupsLocked ? LockIcon : UnlockIcon}
                disabled={signupsLockedSaving}
                onClick={() => void handleSetSignupsLocked(!selectedEvent.signupsLocked)}
              >
                {selectedEvent.signupsLocked ? 'Unlock Signups' : 'Lock Signups'}
              </Button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--fgColor-muted, #636c76)' }}>Tag:</label>
                <Select
                  size="small"
                  disabled={eventStatusSaving}
                  value={selectedEvent.tag || 'OFFICIAL'}
                  onChange={(e) => void handleUpdateEventStatus({ tag: e.target.value as EventTag })}
                >
                  {TAG_OPTIONS.map((tag) => (
                    <Select.Option key={tag} value={tag}>
                      {tag}
                    </Select.Option>
                  ))}
                </Select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--fgColor-muted, #636c76)' }}>Status:</label>
                <Select
                  size="small"
                  disabled={eventStatusSaving}
                  value={selectedEvent.status}
                  onChange={(e) => void handleUpdateEventStatus({ status: e.target.value as EventStatus })}
                >
                  {STATUS_OPTIONS.map((status) => (
                    <Select.Option key={status} value={status}>
                      {status}
                    </Select.Option>
                  ))}
                </Select>
              </div>
            </div>
          </div>

          {/* Primer UnderlineNav Tabs */}
          <UnderlineNav aria-label="Event Management Sections">
            <UnderlineNav.Item
              icon={InfoIcon}
              aria-current={activeTab === 'details' ? 'page' : undefined}
              onSelect={(e) => {
                e.preventDefault()
                setActiveTab('details')
              }}
            >
              Event Summary
            </UnderlineNav.Item>
            <UnderlineNav.Item
              icon={PeopleIcon}
              counter={selectedEvent.members.length}
              aria-current={activeTab === 'members' ? 'page' : undefined}
              onSelect={(e) => {
                e.preventDefault()
                setActiveTab('members')
              }}
            >
              Event Members
            </UnderlineNav.Item>
            <UnderlineNav.Item
              icon={TrophyIcon}
              counter={races.length}
              aria-current={activeTab === 'races' ? 'page' : undefined}
              onSelect={(e) => {
                e.preventDefault()
                setActiveTab('races')
              }}
            >
              Races &amp; Tracks
            </UnderlineNav.Item>
            <UnderlineNav.Item
              icon={DatabaseIcon}
              aria-current={activeTab === 'datasets' ? 'page' : undefined}
              onSelect={(e) => {
                e.preventDefault()
                setActiveTab('datasets')
              }}
            >
              Datasets
            </UnderlineNav.Item>
          </UnderlineNav>

          {activeTab === 'details' && <EventSummaryTab selectedEvent={selectedEvent} />}

          {activeTab === 'members' && (
            <EventMembersTab
              selectedEvent={selectedEvent}
              newMemberUserId={newMemberUserId}
              setNewMemberUserId={setNewMemberUserId}
              handleAddMember={handleAddMember}
              handleRemoveMember={handleRemoveMember}
            />
          )}

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

          {activeTab === 'datasets' && (
            <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--fgColor-muted, #636c76)' }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: '15px', color: 'var(--fgColor-default, #1f2328)' }}>
                Importing records is coming soon
              </p>
              <p style={{ margin: '6px 0 0 0', fontSize: '13px' }}>
                Dataset import formats are still being finalized.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="primer-box" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: '16px' }}>Event Not Found</p>
          <p style={{ margin: '6px 0 16px 0', fontSize: '13px', color: 'var(--fgColor-muted, #636c76)' }}>
            The requested event could not be loaded. It may have been deleted.
          </p>
          <Link to="/admin/events" style={{ textDecoration: 'none' }}>
            <Button variant="primary" leadingVisual={ArrowLeftIcon}>Back to Events</Button>
          </Link>
        </div>
      )}

      {/* CREATE RACE DIALOG */}
      {showCreateRaceModal && (
        <Dialog title="Configure New Race Track" onClose={() => setShowCreateRaceModal(false)} width="large">
          <form onSubmit={onCreateRaceSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--fgColor-muted, #636c76)' }}>
              New races are added to the end of the event schedule. You can reorder them later from the race list.
            </p>

            <FormControl required>
              <FormControl.Label>Race Name</FormControl.Label>
              <TextInput
                block
                required
                placeholder="e.g. Kyoto Derby"
                value={newRaceForm.name}
                onChange={(e) => setNewRaceForm((c) => ({ ...c, name: e.target.value }))}
              />
            </FormControl>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
              <FormControl>
                <FormControl.Label>Distance (Meters)</FormControl.Label>
                <TextInput
                  block
                  type="number"
                  value={String(newRaceForm.distanceMeters)}
                  onChange={(e) => setNewRaceForm((c) => ({ ...c, distanceMeters: Number(e.target.value) || 1200 }))}
                />
              </FormControl>

              <FormControl>
                <FormControl.Label>Track Type</FormControl.Label>
                <TextInput
                  block
                  placeholder="e.g. Turf, Dirt"
                  value={newRaceForm.trackType}
                  onChange={(e) => setNewRaceForm((c) => ({ ...c, trackType: e.target.value }))}
                />
              </FormControl>

              <FormControl required>
                <FormControl.Label>Location</FormControl.Label>
                <TextInput
                  block
                  required
                  placeholder="e.g. Kyoto Racecourse"
                  value={newRaceForm.location}
                  onChange={(e) => setNewRaceForm((c) => ({ ...c, location: e.target.value }))}
                />
              </FormControl>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              <FormControl>
                <FormControl.Label>Class Restriction</FormControl.Label>
                <Select
                  block
                  value={newRaceForm.classRestriction || ''}
                  onChange={(e) =>
                    setNewRaceForm((c) => ({
                      ...c,
                      classRestriction: e.target.value ? (e.target.value as ClassTier) : null,
                    }))
                  }
                >
                  <Select.Option value="">Any Tier Eligibility (None)</Select.Option>
                  {CLASS_TIER_OPTIONS.map((tier) => (
                    <Select.Option key={tier} value={tier}>
                      {tier}
                    </Select.Option>
                  ))}
                </Select>
              </FormControl>

              {selectedEvent && selectedEvent.scoringType === 1 && (
                <FormControl>
                  <FormControl.Label>Race Grade</FormControl.Label>
                  <Select
                    block
                    value={newRaceForm.grade || ''}
                    onChange={(e) => setNewRaceForm((c) => ({ ...c, grade: e.target.value }))}
                  >
                    <Select.Option value="">-- Choose Grade --</Select.Option>
                    <Select.Option value="OP">OP</Select.Option>
                    <Select.Option value="GIII">GIII</Select.Option>
                    <Select.Option value="GII">GII</Select.Option>
                    <Select.Option value="GI">GI</Select.Option>
                  </Select>
                </FormControl>
              )}
            </div>

            {selectedEvent && selectedEvent.granularParticipation && (
              <FormControl>
                <FormControl.Label>Race Participant Limit</FormControl.Label>
                <TextInput
                  block
                  type="number"
                  min={1}
                  placeholder="Leave blank for unlimited"
                  value={newRaceForm.participantLimit !== null ? String(newRaceForm.participantLimit) : ''}
                  onChange={(e) => {
                    const val = e.target.value
                    setNewRaceForm((c) => ({ ...c, participantLimit: val ? Number(val) : null }))
                  }}
                />
              </FormControl>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '8px', borderTop: '1px solid var(--borderColor-muted, #d8dee4)' }}>
              <Button type="button" onClick={() => setShowCreateRaceModal(false)}>Cancel</Button>
              <Button type="submit" variant="primary">Create Race Track</Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* EDIT EVENT DETAILS DIALOG */}
      {showEditEventModal && (
        <Dialog title="Edit Event Details" onClose={() => setShowEditEventModal(false)} width="large">
          <form onSubmit={onEditEventSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <FormControl required>
              <FormControl.Label>Event Name</FormControl.Label>
              <TextInput block required value={editName} onChange={(e) => setEditName(e.target.value)} />
            </FormControl>

            <FormControl>
              <FormControl.Label>Description</FormControl.Label>
              <Textarea block rows={3} value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
            </FormControl>

            {selectedEvent && selectedEvent.scoringType === 1 && (
              <div style={{ borderTop: '1px solid var(--borderColor-muted, #d8dee4)', paddingTop: '12px' }}>
                <FormControl>
                  <FormControl.Label>Points Scoring Rules Source</FormControl.Label>
                  <Select
                    block
                    value={editScoringRulesMode}
                    onChange={(e) => setEditScoringRulesMode(e.target.value as 'STANDARD' | 'CUSTOM')}
                  >
                    <Select.Option value="STANDARD">Standard Default Tables</Select.Option>
                    <Select.Option value="CUSTOM">Custom Event Tables</Select.Option>
                  </Select>
                </FormControl>

                {editScoringRulesMode === 'CUSTOM' && (
                  <EventScoringTablesEditor value={editCustomScoringTables} onChange={setEditCustomScoringTables} />
                )}
              </div>
            )}

            <FormControl>
              <FormControl.Label>
                Scheduled Date / Time ({Intl.DateTimeFormat().resolvedOptions().timeZone})
              </FormControl.Label>
              <TextInput block type="datetime-local" value={editScheduledAt} onChange={(e) => setEditScheduledAt(e.target.value)} />
            </FormControl>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'center' }}>
              <FormControl>
                <FormControl.Label>Class Tier Eligibility</FormControl.Label>
                <Select
                  block
                  value={editClassRestriction || ''}
                  onChange={(e) => setEditClassRestriction(e.target.value ? (e.target.value as ClassTier) : null)}
                >
                  <Select.Option value="">Any Tier Eligibility (None)</Select.Option>
                  <Select.Option value="G3">G3</Select.Option>
                  <Select.Option value="G2">G2</Select.Option>
                  <Select.Option value="G1">G1</Select.Option>
                </Select>
              </FormControl>

              <FormControl>
                <Checkbox
                  checked={editSignupsLocked}
                  onChange={(e) => setEditSignupsLocked(e.target.checked)}
                />
                <FormControl.Label>Lock Event Signups</FormControl.Label>
              </FormControl>
            </div>

            {!editGranularParticipation ? (
              <FormControl>
                <FormControl.Label>Participant Limit</FormControl.Label>
                <TextInput
                  block
                  type="number"
                  min={1}
                  placeholder="Leave blank for unlimited"
                  value={editParticipantLimit}
                  onChange={(e) => setEditParticipantLimit(e.target.value)}
                />
              </FormControl>
            ) : (
              <FormControl>
                <FormControl.Label>Max Races Per Participant</FormControl.Label>
                <TextInput
                  block
                  type="number"
                  min={1}
                  placeholder="Leave blank for unlimited"
                  value={editMaxConcurrentRaceParticipations}
                  onChange={(e) => setEditMaxConcurrentRaceParticipations(e.target.value)}
                />
              </FormControl>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '8px', borderTop: '1px solid var(--borderColor-muted, #d8dee4)' }}>
              <Button type="button" onClick={() => setShowEditEventModal(false)}>Cancel</Button>
              <Button type="submit" variant="primary">Save Changes</Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* CONFIRM RECOMPUTE WARNING DIALOG */}
      {showConfirmModal && (
        <Dialog title="Recalculate Points Warning" onClose={() => setShowConfirmModal(false)} width="medium">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <Flash variant="warning" style={{ fontSize: '13px' }}>
              Changing the event&apos;s scoring tables will trigger an automatic recomputation of points for all existing race results.
            </Flash>
            <p style={{ margin: 0, fontSize: '13px' }}>Are you sure you want to proceed and save these changes?</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '8px', borderTop: '1px solid var(--borderColor-muted, #d8dee4)' }}>
              <Button type="button" onClick={() => setShowConfirmModal(false)}>Cancel</Button>
              <Button
                type="button"
                variant="primary"
                onClick={async () => {
                  setShowConfirmModal(false)
                  await performSaveEventDetails()
                }}
              >
                Confirm &amp; Save
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* EDIT RACE DIALOG */}
      {showEditRaceModal && selectedRace && (
        <Dialog title="Edit Race Details" onClose={() => setShowEditRaceModal(false)} width="large">
          <form onSubmit={onEditRaceSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {raceEditError && <AlertBanner variant="error">{raceEditError}</AlertBanner>}

            <FormControl required>
              <FormControl.Label>Race Name</FormControl.Label>
              <TextInput block required value={raceEditName} onChange={(e) => setRaceEditName(e.target.value)} />
            </FormControl>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
              <FormControl required>
                <FormControl.Label>Distance (Meters)</FormControl.Label>
                <TextInput
                  block
                  required
                  type="number"
                  value={String(raceEditDistance)}
                  onChange={(e) => setRaceEditDistance(Number(e.target.value) || 0)}
                />
              </FormControl>

              <FormControl required>
                <FormControl.Label>Track Type</FormControl.Label>
                <TextInput block required value={raceEditTrackType} onChange={(e) => setRaceEditTrackType(e.target.value)} />
              </FormControl>

              <FormControl required>
                <FormControl.Label>Location</FormControl.Label>
                <TextInput block required value={raceEditLocation} onChange={(e) => setRaceEditLocation(e.target.value)} />
              </FormControl>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              <FormControl>
                <FormControl.Label>Class Restriction</FormControl.Label>
                <Select
                  block
                  value={raceEditClassRestriction || ''}
                  onChange={(e) => setRaceEditClassRestriction(e.target.value ? (e.target.value as ClassTier) : null)}
                >
                  <Select.Option value="">Any Tier Eligibility (None)</Select.Option>
                  {CLASS_TIER_OPTIONS.map((tier) => (
                    <Select.Option key={tier} value={tier}>
                      {tier}
                    </Select.Option>
                  ))}
                </Select>
              </FormControl>

              {selectedEvent && selectedEvent.scoringType === 1 && (
                <FormControl>
                  <FormControl.Label>Race Grade</FormControl.Label>
                  <Select block value={raceEditGrade || ''} onChange={(e) => setRaceEditGrade(e.target.value || null)}>
                    <Select.Option value="">-- Choose Grade --</Select.Option>
                    <Select.Option value="OP">OP</Select.Option>
                    <Select.Option value="GIII">GIII</Select.Option>
                    <Select.Option value="GII">GII</Select.Option>
                    <Select.Option value="GI">GI</Select.Option>
                  </Select>
                </FormControl>
              )}
            </div>

            {selectedEvent && selectedEvent.granularParticipation && (
              <FormControl>
                <FormControl.Label>Race Participant Limit</FormControl.Label>
                <TextInput
                  block
                  type="number"
                  min={1}
                  placeholder="Leave blank for unlimited"
                  value={raceEditParticipantLimit}
                  onChange={(e) => setRaceEditParticipantLimit(e.target.value)}
                />
              </FormControl>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '8px', borderTop: '1px solid var(--borderColor-muted, #d8dee4)' }}>
              <Button type="button" onClick={() => setShowEditRaceModal(false)}>Cancel</Button>
              <Button type="submit" variant="primary">Save Changes</Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* CONFIRM RACE GRADE CHANGE DIALOG */}
      {showRaceGradeConfirm && (
        <Dialog title="Recalculate Race Points Warning" onClose={() => setShowRaceGradeConfirm(false)} width="medium">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <Flash variant="warning" style={{ fontSize: '13px' }}>
              Changing this race&apos;s grade will immediately recalculate points for all recorded results in this race.
            </Flash>
            <p style={{ margin: 0, fontSize: '13px' }}>Are you sure you want to update the race grade?</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '8px', borderTop: '1px solid var(--borderColor-muted, #d8dee4)' }}>
              <Button type="button" onClick={() => setShowRaceGradeConfirm(false)}>Cancel</Button>
              <Button
                type="button"
                variant="primary"
                onClick={async () => {
                  setShowRaceGradeConfirm(false)
                  await performSaveRaceDetails()
                }}
              >
                Confirm &amp; Save
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </AdminLayout>
  )
}
