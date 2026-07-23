import { Link, createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { requireSiteAdmin } from '../../../lib/auth-guard'
import { AdminLayout } from '../-AdminLayout'
import { useEventDetail } from '../../../hooks/useEventDetail'
import { isRaceNotStarted, isRaceOngoing, isRaceConcluded } from '../../../lib/raceStatus'
import { AlertBanner } from '../../../components/AlertBanner'
import { LoadingBox } from '../../../components/LoadingBox'
import { StandingsEditor } from '../../../components/StandingsEditor'
import { GradePointsPreview } from '../../../components/GradePointsPreview'
import { EventScoringTablesEditor } from '../../../components/EventScoringTablesEditor'
import type { eventmanager } from '../../../lib/client'

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
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface SortableRaceItemProps {
  race: eventmanager.RaceEventDetail
  onMoveUp?: () => void
  onMoveDown?: () => void
  isFirst: boolean
  isLast: boolean
  isSelected: boolean
  onSelect: () => void
}

function SortableRaceItem({
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
    border: '1px solid #dddbda',
    borderRadius: '4px',
    background: isSelected ? '#0176d3' : '#ffffff',
    padding: '8px',
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    boxShadow: isDragging ? '0 5px 15px rgba(0,0,0,0.15)' : 'none',
    zIndex: isDragging ? 1000 : 'auto',
  }

  let statusText = 'Ready'
  if (race.startsAt && !race.endsAt) {
    statusText = 'Live'
  } else if (race.endsAt) {
    statusText = 'Done'
  }

  return (
    <div ref={setNodeRef} style={style}>
      {/* Left side: Drag handle. Only the drag handle should initiate drag behavior */}
      <div
        {...attributes}
        {...listeners}
        style={{
          cursor: 'grab',
          padding: '4px 8px',
          background: '#f1f5f9',
          border: '1px solid #cbd5e1',
          borderRadius: '4px',
          userSelect: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        title="Drag to reorder"
      >
        <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#64748b' }}>☰</span>
      </div>

      {/* Center: main body. Clicking anywhere else selects the race */}
      <div
        onClick={onSelect}
        style={{
          flexGrow: 1,
          cursor: 'pointer',
          minWidth: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '13px', color: isSelected ? '#ffffff' : '#1e293b' }}>
            #{race.sequence}. {race.name}
          </span>
          <span
            className="slds-badge"
            style={{
              padding: '1px 6px',
              fontSize: '10px',
              backgroundColor: statusText === 'Live' ? '#2e7d32' : statusText === 'Done' ? '#475569' : '#0284c7',
              color: '#ffffff',
            }}
          >
            {statusText}
          </span>
        </div>
      </div>

      {/* Right side: fallback controls */}
      <div style={{ display: 'flex', gap: '4px' }}>
        <button
          type="button"
          disabled={isFirst}
          onClick={(e) => {
            e.stopPropagation()
            if (onMoveUp) onMoveUp()
          }}
          className="slds-button slds-button_neutral"
          style={{
            padding: '2px 6px',
            fontSize: '11px',
            height: '24px',
            lineHeight: '20px',
            borderRadius: '3px',
            color: isSelected ? '#1e293b' : undefined,
          }}
          title="Move up"
        >
          &uarr;
        </button>
        <button
          type="button"
          disabled={isLast}
          onClick={(e) => {
            e.stopPropagation()
            if (onMoveDown) onMoveDown()
          }}
          className="slds-button slds-button_neutral"
          style={{
            padding: '2px 6px',
            fontSize: '11px',
            height: '24px',
            lineHeight: '20px',
            borderRadius: '3px',
            color: isSelected ? '#1e293b' : undefined,
          }}
          title="Move down"
        >
          &darr;
        </button>
      </div>
    </div>
  )
}

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
    setSelectedRace,
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

  const [isReordering, setIsReordering] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const hasStartedOrConcludedRaces = races.some((r) => r.startsAt !== null || r.endsAt !== null)

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

  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editClassRestriction, setEditClassRestriction] = useState<eventmanager.ClassTier | null>(null)
  const [editGranularParticipation, setEditGranularParticipation] = useState(false)
  const [editSignupsLocked, setEditSignupsLocked] = useState(false)
  const [editScoringRulesMode, setEditScoringRulesMode] = useState<'STANDARD' | 'CUSTOM'>('STANDARD')
  const [editCustomScoringTables, setEditCustomScoringTables] = useState<Record<string, Record<number, number>>>({
    OP:   { 1: 12, 2: 10, 3: 8, 4: 7, 5: 6, 6: 5, 7: 4, 8: 3, 9: 2, 10: 1 },
    GIII: { 1: 15, 2: 12, 3: 10, 4: 8, 5: 6, 6: 5, 7: 4, 8: 3, 9: 2, 10: 1 },
    GII:  { 1: 19, 2: 15, 3: 12, 4: 9, 5: 8, 6: 6, 7: 5, 8: 3, 9: 2, 10: 1 },
    GI:   { 1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1 },
  })
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  // Set edit values when modal is toggled or event loads
  useEffect(() => {
    if (selectedEvent) {
      setEditName(selectedEvent.name)
      setEditDescription(selectedEvent.description ?? '')
      setEditClassRestriction(selectedEvent.classRestriction)
      setEditGranularParticipation(selectedEvent.granularParticipation)
      setEditSignupsLocked(selectedEvent.signupsLocked)
      setEditScoringRulesMode((selectedEvent.scoringRulesMode as 'STANDARD' | 'CUSTOM') || 'STANDARD')
      if (selectedEvent.customScoringTables) {
        setEditCustomScoringTables(selectedEvent.customScoringTables)
      } else {
        setEditCustomScoringTables({
          OP:   { 1: 12, 2: 10, 3: 8, 4: 7, 5: 6, 6: 5, 7: 4, 8: 3, 9: 2, 10: 1 },
          GIII: { 1: 15, 2: 12, 3: 10, 4: 8, 5: 6, 6: 5, 7: 4, 8: 3, 9: 2, 10: 1 },
          GII:  { 1: 19, 2: 15, 3: 12, 4: 9, 5: 8, 6: 6, 7: 5, 8: 3, 9: 2, 10: 1 },
          GI:   { 1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1 },
        })
      }
    }
  }, [showEditEventModal, selectedEvent])

  const performSaveEventDetails = async () => {
    await handleUpdateEventDetails({
      name: editName,
      description: editDescription || null,
      classRestriction: editClassRestriction || null,
      granularParticipation: editGranularParticipation,
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

  const onCreateRaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await handleCreateRace(e)
    setShowCreateRaceModal(false)
  }

  return (
    <AdminLayout
      title="Event & Race Operations"
      subtitle="Manage event lifecycle, register competitors, construct race tracks, and perform dynamic batch or in-place results entry."
      actions={
        <Link
          to="/admin/events"
          className="slds-button slds-button_neutral"
          style={{ padding: '4px 12px', fontSize: '12px' }}
        >
          &larr; Back to Events
        </Link>
      }
    >
      {globalError && (
        <AlertBanner variant="error">{globalError}</AlertBanner>
      )}
      {globalSuccess && (
        <AlertBanner variant="success">{globalSuccess}</AlertBanner>
      )}

      {/* Event Onboarding Guidance Banners */}
      {!loadingEventDetail && selectedEvent && (
        <div className="slds-m-bottom_medium">
          {selectedEvent.status === 'DRAFT' && (
            <AlertBanner variant="warning">
              <div style={{ textAlign: 'left' }}>
                <strong>Event Status: DRAFT (Setup Mode)</strong>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#7c2d12' }}>
                  This event is in private preparation. <strong>Next steps:</strong> Register participants under the "Event Members" tab, create race tracks under the "Races & Tracks" tab, and set Lifecycle Status to <strong>UNOFFICIAL</strong> to publish it.
                </p>
              </div>
            </AlertBanner>
          )}
          {selectedEvent.status === 'UNOFFICIAL' && (
            <AlertBanner variant="warning">
              <div style={{ textAlign: 'left' }}>
                <strong>Event Status: UNOFFICIAL (Live / Staging)</strong>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#7c2d12' }}>
                  This event is visible to participants. <strong>Next steps:</strong> Start and end configured races from the "Races & Tracks" tab, record standings, and set status to <strong>OFFICIAL</strong> (admins only) or <strong>CONCLUDED</strong> to finalize.
                </p>
              </div>
            </AlertBanner>
          )}
          {selectedEvent.status === 'OFFICIAL' && (
            <AlertBanner variant="success">
              <div style={{ textAlign: 'left' }}>
                <strong>Event Status: OFFICIAL (Validated)</strong>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#ffffff' }}>
                  Results and overall points have been approved by Site Administrators. Real-time scores and standings are finalized.
                </p>
              </div>
            </AlertBanner>
          )}
          {selectedEvent.status === 'CONCLUDED' && (
            <AlertBanner variant="warning">
              <div style={{ textAlign: 'left' }}>
                <strong>Event Status: CONCLUDED (Locked)</strong>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#7c2d12' }}>
                  This competition has finished. Historical standings are locked and archived.
                </p>
              </div>
            </AlertBanner>
          )}
        </div>
      )}

      {loadingEventDetail ? (
        <LoadingBox message={`Loading details for ${selectedEvent?.name ?? eventId}...`} />
      ) : selectedEvent ? (
        <div className="slds-box bg-white" style={{ background: '#ffffff', borderRadius: '4px', border: '1px solid #dddbda', padding: '1.5rem' }}>
          <div className="slds-grid slds-grid_align-spread slds-m-bottom_large" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #dddbda', paddingBottom: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <h2 className="slds-text-heading_medium font-bold text-slate-900" style={{ fontSize: '1.35rem', fontWeight: 'bold', margin: 0 }}>{selectedEvent.name}</h2>
                <button
                  type="button"
                  onClick={() => setShowEditEventModal(true)}
                  className="slds-button slds-button_neutral"
                  style={{ padding: '2px 8px', fontSize: '11px' }}
                >
                  Edit Details
                </button>
                {selectedEvent.scoringType === 1 && (
                  <button
                    type="button"
                    onClick={() => void handleRecomputeEventPoints()}
                    className="slds-button slds-button_neutral"
                    style={{ padding: '2px 8px', fontSize: '11px' }}
                  >
                    Recompute Points
                  </button>
                )}
              </div>
              <p className="slds-text-body_small text-slate-500">ID: {selectedEvent.id}</p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              {/* Signups Lock Controller */}
              <div className="slds-form-element" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label className="slds-form-element__label font-bold text-slate-700" style={{ fontWeight: 'bold', margin: 0 }}>Signups:</label>
                <button
                  type="button"
                  disabled={signupsLockedSaving}
                  onClick={() => void handleSetSignupsLocked(!selectedEvent.signupsLocked)}
                  className={`slds-button ${selectedEvent.signupsLocked ? 'slds-button_destructive' : 'slds-button_brand'}`}
                  style={{
                    padding: '4px 12px',
                    fontSize: '12px',
                    height: '32px',
                    borderRadius: '4px',
                    backgroundColor: selectedEvent.signupsLocked ? '#c23934' : '#0176d3',
                    color: '#ffffff',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {selectedEvent.signupsLocked ? 'Signups Locked' : 'Signups Open'}
                </button>
              </div>

              {/* Status controller */}
              <div className="slds-form-element" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label className="slds-form-element__label font-bold text-slate-700" style={{ fontWeight: 'bold', margin: 0 }}>Lifecycle Status:</label>
                <div className="slds-form-element__control">
                  <select
                    disabled={eventStatusSaving}
                    value={selectedEvent.status}
                    onChange={(e) => void handleUpdateEventStatus(e.target.value as eventmanager.EventStatus)}
                    className="slds-select"
                    style={{ minWidth: '130px', padding: '4px 28px 4px 12px', border: '1px solid #dddbda', borderRadius: '4px' }}
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* SLDS Tabs Secondary Context Header */}
          <div className="slds-tabs_default slds-m-bottom_large">
            <ul className="slds-tabs_default__nav" role="tablist" style={{ display: 'flex', borderBottom: '1px solid #dddbda', listStyle: 'none', margin: 0, padding: 0 }}>
              <li className={`slds-tabs_default__item ${activeTab === 'details' ? 'slds-is-active' : ''}`} role="presentation" style={{ borderBottom: activeTab === 'details' ? '3px solid #0176d3' : 'none' }}>
                <button
                  className="slds-tabs_default__link"
                  type="button"
                  onClick={() => {
                    setActiveTab('details')
                  }}
                  style={{ border: 'none', background: 'transparent', padding: '12px 16px', cursor: 'pointer', fontWeight: activeTab === 'details' ? 'bold' : 'normal', color: activeTab === 'details' ? '#0176d3' : '#180505' }}
                >
                  Event Summary
                </button>
              </li>
              <li className={`slds-tabs_default__item ${activeTab === 'members' ? 'slds-is-active' : ''}`} role="presentation" style={{ borderBottom: activeTab === 'members' ? '3px solid #0176d3' : 'none' }}>
                <button
                  className="slds-tabs_default__link"
                  type="button"
                  onClick={() => {
                    setActiveTab('members')
                  }}
                  style={{ border: 'none', background: 'transparent', padding: '12px 16px', cursor: 'pointer', fontWeight: activeTab === 'members' ? 'bold' : 'normal', color: activeTab === 'members' ? '#0176d3' : '#180505' }}
                >
                  Event Members ({selectedEvent.members.length})
                </button>
              </li>
              <li className={`slds-tabs_default__item ${activeTab === 'races' ? 'slds-is-active' : ''}`} role="presentation" style={{ borderBottom: activeTab === 'races' ? '3px solid #0176d3' : 'none' }}>
                <button
                  className="slds-tabs_default__link"
                  type="button"
                  onClick={() => {
                    setActiveTab('races')
                  }}
                  style={{ border: 'none', background: 'transparent', padding: '12px 16px', cursor: 'pointer', fontWeight: activeTab === 'races' ? 'bold' : 'normal', color: activeTab === 'races' ? '#0176d3' : '#180505' }}
                >
                  Races & Tracks ({races.length})
                </button>
              </li>
              <li className={`slds-tabs_default__item ${activeTab === 'datasets' ? 'slds-is-active' : ''}`} role="presentation" style={{ borderBottom: activeTab === 'datasets' ? '3px solid #0176d3' : 'none' }}>
                <button
                  className="slds-tabs_default__link"
                  type="button"
                  onClick={() => {
                    setActiveTab('datasets')
                  }}
                  style={{ border: 'none', background: 'transparent', padding: '12px 16px', cursor: 'pointer', fontWeight: activeTab === 'datasets' ? 'bold' : 'normal', color: activeTab === 'datasets' ? '#0176d3' : '#180505' }}
                >
                  Datasets
                </button>
              </li>
            </ul>

            {/* Tab 1: Summary Info */}
            {activeTab === 'details' && (
              <div className="slds-tabs_default__content slds-show slds-p-vertical_medium" style={{ paddingTop: '1.5rem' }}>
                <div className="slds-grid slds-wrap slds-gutters">
                  <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-m-bottom_medium">
                    <p className="slds-text-title_caps text-slate-500 font-bold" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold' }}>Description</p>
                    <p className="slds-text-body_regular text-slate-800 slds-m-top_xx-small">
                      {selectedEvent.description ?? 'No description registered.'}
                    </p>
                  </div>
                  <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-m-bottom_medium">
                    <p className="slds-text-title_caps text-slate-500 font-bold" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold' }}>Scoring Configuration</p>
                    <p className="slds-text-body_regular text-slate-800 slds-m-top_xx-small">
                      Scoring Mode: <strong>{selectedEvent.scoringTypeLabel}</strong> ({selectedEvent.scoringType === 1 ? 'Points aggregation' : 'Ladder Rating (ELO)'}) <br />
                      {selectedEvent.scoringType === 1 && (
                        <>
                          Rules Source: <strong>{selectedEvent.scoringRulesMode || 'STANDARD'}</strong>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-m-bottom_medium">
                    <p className="slds-text-title_caps text-slate-500 font-bold" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold' }}>Owner Parameters</p>
                    <p className="slds-text-body_regular text-slate-800 slds-m-top_xx-small">
                      Ownership Type: {selectedEvent.ownerType} <br />
                      ID: {selectedEvent.organizationId ?? selectedEvent.ownerUserId}
                    </p>
                  </div>
                  <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-m-bottom_medium">
                    <p className="slds-text-title_caps text-slate-500 font-bold" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold' }}>Class restriction</p>
                    <p className="slds-text-body_regular text-slate-800 slds-m-top_xx-small">
                      Tier Restriction: <strong>{selectedEvent.classRestriction ?? 'PRE_OP (Any tier eligibility)'}</strong>
                    </p>
                  </div>
                  <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-m-bottom_medium">
                    <p className="slds-text-title_caps text-slate-500 font-bold" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold' }}>Participation Model</p>
                    <p className="slds-text-body_regular text-slate-800 slds-m-top_xx-small">
                      Granular Per-Race Participation: <strong>{selectedEvent.granularParticipation ? 'Enabled (Per-Race registration required)' : 'Disabled (Event-wide registration)'}</strong>
                    </p>
                  </div>
                  <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-m-bottom_medium">
                    <p className="slds-text-title_caps text-slate-500 font-bold" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold' }}>Signups Status</p>
                    <p className="slds-text-body_regular text-slate-800 slds-m-top_xx-small">
                      Signups Lock: <strong>{selectedEvent.signupsLocked ? 'Locked (Self-service signups disabled)' : 'Open (Self-service signups enabled)'}</strong>
                    </p>
                  </div>
                </div>

                {selectedEvent.scoringType === 1 && (
                  <div className="slds-m-bottom_large" style={{ marginTop: '1.5rem' }}>
                    <h3 className="slds-text-heading_small font-bold slds-m-bottom_small text-slate-900" style={{ fontWeight: 'bold', fontSize: '14px', borderBottom: '1px solid #f3f2f1', paddingBottom: '4px' }}>
                      Event Points Scoring Configuration Tables
                    </h3>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      {['OP', 'GIII', 'GII', 'GI'].map((grade) => {
                        const DEFAULT_TABLES: Record<string, Record<number, number>> = {
                          OP:   { 1: 12, 2: 10, 3: 8, 4: 7, 5: 6, 6: 5, 7: 4, 8: 3, 9: 2, 10: 1 },
                          GIII: { 1: 15, 2: 12, 3: 10, 4: 8, 5: 6, 6: 5, 7: 4, 8: 3, 9: 2, 10: 1 },
                          GII:  { 1: 19, 2: 15, 3: 12, 4: 9, 5: 8, 6: 6, 7: 5, 8: 3, 9: 2, 10: 1 },
                          GI:   { 1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1 },
                        };
                        const table = (selectedEvent.scoringRulesMode === 'CUSTOM' && selectedEvent.customScoringTables)
                          ? (selectedEvent.customScoringTables[grade] || DEFAULT_TABLES[grade])
                          : DEFAULT_TABLES[grade];
                        return <GradePointsPreview key={grade} grade={grade} table={table} />;
                      })}
                    </div>
                  </div>
                )}

                {/* Standings overview aggregates block */}
                <div className="slds-m-top_large">
                  <h3 className="slds-text-heading_small font-bold slds-m-bottom_small text-slate-900" style={{ fontWeight: 'bold', borderBottom: '1px solid #f3f2f1', paddingBottom: '4px' }}>
                    Current Event Overall Leaderboard
                  </h3>
                  {selectedEvent.scoringType === 1 ? (
                    selectedEvent.pointsOverview && selectedEvent.pointsOverview.length > 0 ? (
                      <table className="slds-table slds-table_cell-buffer slds-table_bordered" style={{ border: '1px solid #dddbda' }}>
                        <thead>
                          <tr className="slds-line-height_reset" style={{ background: '#f3f2f1' }}>
                            <th scope="col" style={{ fontWeight: 'bold' }}><div className="slds-truncate">Rank</div></th>
                            <th scope="col" style={{ fontWeight: 'bold' }}><div className="slds-truncate">Name</div></th>
                            <th scope="col" style={{ fontWeight: 'bold' }}><div className="slds-truncate">User ID</div></th>
                            <th scope="col" style={{ fontWeight: 'bold' }}><div className="slds-truncate">Total Points</div></th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedEvent.pointsOverview.map((item, idx) => (
                            <tr key={item.userId} className="slds-hint-parent">
                              <td><strong>{idx + 1}</strong></td>
                              <td><span className="font-semibold text-blue-600">{item.name}</span></td>
                              <td><code className="text-xs">{item.userId}</code></td>
                              <td><strong>{item.points} pts</strong></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="slds-text-body_small text-slate-500">No participants score standings loaded.</p>
                    )
                  ) : (
                    selectedEvent.ladderOverview && selectedEvent.ladderOverview.length > 0 ? (
                      <table className="slds-table slds-table_cell-buffer slds-table_bordered" style={{ border: '1px solid #dddbda' }}>
                        <thead>
                          <tr className="slds-line-height_reset" style={{ background: '#f3f2f1' }}>
                            <th scope="col" style={{ fontWeight: 'bold' }}><div className="slds-truncate">Rank</div></th>
                            <th scope="col" style={{ fontWeight: 'bold' }}><div className="slds-truncate">Name</div></th>
                            <th scope="col" style={{ fontWeight: 'bold' }}><div className="slds-truncate">Rating (ELO)</div></th>
                            <th scope="col" style={{ fontWeight: 'bold' }}><div className="slds-truncate">Wins / Losses</div></th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedEvent.ladderOverview.map((item) => (
                            <tr key={item.userId} className="slds-hint-parent">
                              <td><strong>{item.rank}</strong></td>
                              <td><span className="font-semibold text-blue-600">{item.name}</span></td>
                              <td><strong>{item.elo}</strong></td>
                              <td>{item.wins}W - {item.losses}L</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="slds-text-body_small text-slate-500">No ladder match results computed yet.</p>
                    )
                  )}
                </div>
              </div>
            )}

            {/* Tab 2: Registered Members */}
            {activeTab === 'members' && (
              <div className="slds-tabs_default__content slds-show slds-p-vertical_medium" style={{ paddingTop: '1.5rem' }}>
                {/* Add Member Quick Form */}
                <div className="slds-box slds-m-bottom_large" style={{ background: '#f3f2f1', border: '1px solid #dddbda' }}>
                  <form onSubmit={handleAddMember} className="slds-grid slds-wrap slds-grid_vertical-align-center" style={{ display: 'flex', alignItems: 'flex-end', gap: '12px' }}>
                    <div className="slds-form-element" style={{ flexGrow: 1, minWidth: '240px' }}>
                      <label className="slds-form-element__label font-bold text-slate-700" style={{ fontWeight: 'bold' }} htmlFor="new-member-input">
                        Register Competitor (Enter User ID)
                      </label>
                      <div className="slds-form-element__control">
                        <input
                          id="new-member-input"
                          type="text"
                          placeholder="e.g. user_abc123"
                          value={newMemberUserId}
                          onChange={(e) => setNewMemberUserId(e.target.value)}
                          className="slds-input"
                          style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px', background: '#fff' }}
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="slds-button slds-button_brand"
                      style={{ padding: '6px 16px', height: '36px' }}
                    >
                      Register Member
                    </button>
                  </form>
                  <p className="slds-text-body_small text-slate-500 slds-m-top_x-small" style={{ fontSize: '11px', margin: '4px 0 0 0' }}>
                    💡 For mock testing, you can input "mock-user-1", "mock-user-2", "mock-user-3" or other valid IDs.
                  </p>
                </div>

                {/* List Members */}
                <h3 className="slds-text-heading_small font-bold slds-m-bottom_small text-slate-900" style={{ fontWeight: 'bold' }}>Registered Participants</h3>
                {selectedEvent.members.length === 0 ? (
                  <p className="slds-text-body_small text-slate-500">No participants are currently registered for this competition.</p>
                ) : (
                  <table className="slds-table slds-table_cell-buffer slds-table_bordered" style={{ border: '1px solid #dddbda' }}>
                    <thead>
                      <tr className="slds-line-height_reset" style={{ background: '#f3f2f1' }}>
                        <th scope="col" style={{ fontWeight: 'bold' }}><div className="slds-truncate">Competitor Name</div></th>
                        <th scope="col" style={{ fontWeight: 'bold' }}><div className="slds-truncate">User ID</div></th>
                        <th scope="col" style={{ fontWeight: 'bold' }}><div className="slds-truncate">Skill Tier</div></th>
                        <th scope="col" style={{ fontWeight: 'bold', width: '80px' }}><div className="slds-truncate">Actions</div></th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedEvent.members.map((member) => (
                        <tr key={member.userId} className="slds-hint-parent">
                          <td><span className="font-semibold text-slate-800">{member.name}</span></td>
                          <td><code className="text-xs">{member.userId}</code></td>
                          <td>
                            <span className="slds-badge slds-theme_light" style={{ padding: '1px 6px', fontSize: '10px' }}>
                              {member.classTier ?? 'PRE_OP'}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              onClick={() => void handleRemoveMember(member.userId)}
                              className="slds-button slds-button_destructive"
                              style={{ padding: '1px 8px', fontSize: '11px', background: '#d32f2f', color: '#fff' }}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Tab 3: Unified Races & Tracks Experience */}
            {activeTab === 'races' && (
              <div className="slds-tabs_default__content slds-show slds-p-vertical_medium" style={{ paddingTop: '1.5rem' }}>
                {races.length === 0 ? (
                  <div className="slds-align_absolute-center slds-p-around_large text-slate-500" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
                    <p className="slds-text-heading_small font-bold text-slate-700" style={{ fontWeight: 'bold' }}>No Races Configured</p>
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
                    {/* Left Sidebar: Race Selector + Overview Button */}
                    <div style={{ flex: '1 1 300px', maxWidth: '360px', background: '#f8fafc', border: '1px solid #dddbda', borderRadius: '4px', padding: '16px' }}>
                      {/* Overview Link */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRaceId(null)
                          setSelectedRace(null)
                        }}
                        className="slds-button"
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '10px 12px',
                          marginBottom: '16px',
                          background: selectedRaceId === null ? '#0176d3' : '#ffffff',
                          color: selectedRaceId === null ? '#ffffff' : '#0176d3',
                          fontWeight: 'bold',
                          border: '1px solid #0176d3',
                          borderRadius: '4px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        }}
                      >
                        All Races Overview
                      </button>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 className="slds-text-heading_small font-bold text-slate-900" style={{ fontWeight: 'bold', margin: 0 }}>
                          Configure / Manage Tracks
                        </h3>
                        <button
                          type="button"
                          onClick={() => setIsReordering(!isReordering)}
                          className={`slds-button ${isReordering ? 'slds-button_brand' : 'slds-button_neutral'}`}
                          style={{ padding: '2px 10px', fontSize: '11px', height: '28px' }}
                        >
                          {isReordering ? 'Done' : 'Reorder'}
                        </button>
                      </div>

                      {isReordering ? (
                        <div style={{ marginBottom: '16px' }}>
                          <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px', lineHeight: '1.4', fontStyle: 'italic' }}>
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
                        <>
                          {/* Group: Ongoing */}
                          {ongoingRaces.length > 0 && (
                            <div className="slds-m-bottom_medium">
                              <h4 className="slds-text-title_caps text-slate-500 font-bold slds-m-bottom_xx-small" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.0625em' }}>
                                Ongoing ({ongoingRaces.length})
                              </h4>
                              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                {ongoingRaces.map((race) => (
                                  <li key={race.id} className="slds-m-bottom_xx-small">
                                    <button
                                      type="button"
                                      onClick={() => void handleSelectRace(race, false)}
                                      className="slds-button slds-button_neutral"
                                      style={{
                                        width: '100%',
                                        textAlign: 'left',
                                        padding: '8px 12px',
                                        background: selectedRaceId === race.id ? '#0176d3' : '#ffffff',
                                        color: selectedRaceId === race.id ? '#ffffff' : '#0176d3',
                                        fontWeight: selectedRaceId === race.id ? 'bold' : 'normal',
                                        border: selectedRaceId === race.id ? '1px solid #0176d3' : '1px solid #dddbda',
                                        borderRadius: '4px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                      }}
                                    >
                                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        #{race.sequence}. {race.name}
                                      </span>
                                      <span style={{ fontSize: '10px', opacity: 0.85 }}>Live</span>
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Group: Concluded */}
                          {concludedRaces.length > 0 && (
                            <div className="slds-m-bottom_medium">
                              <h4 className="slds-text-title_caps text-slate-500 font-bold slds-m-bottom_xx-small" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.0625em' }}>
                                Concluded ({concludedRaces.length})
                              </h4>
                              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                {concludedRaces.map((race) => (
                                  <li key={race.id} className="slds-m-bottom_xx-small">
                                    <button
                                      type="button"
                                      onClick={() => void handleSelectRace(race, false)}
                                      className="slds-button slds-button_neutral"
                                      style={{
                                        width: '100%',
                                        textAlign: 'left',
                                        padding: '8px 12px',
                                        background: selectedRaceId === race.id ? '#0176d3' : '#ffffff',
                                        color: selectedRaceId === race.id ? '#ffffff' : '#0176d3',
                                        fontWeight: selectedRaceId === race.id ? 'bold' : 'normal',
                                        border: selectedRaceId === race.id ? '1px solid #0176d3' : '1px solid #dddbda',
                                        borderRadius: '4px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                      }}
                                    >
                                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        #{race.sequence}. {race.name}
                                      </span>
                                      <span style={{ fontSize: '10px', opacity: 0.85 }}>Done</span>
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Group: Not Started */}
                          {notStartedRaces.length > 0 && (
                            <div>
                              <h4 className="slds-text-title_caps text-slate-500 font-bold slds-m-bottom_xx-small" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.0625em' }}>
                                Not Started ({notStartedRaces.length})
                              </h4>
                              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                {notStartedRaces.map((race) => (
                                  <li key={race.id} className="slds-m-bottom_xx-small">
                                    <button
                                      type="button"
                                      onClick={() => void handleSelectRace(race, false)}
                                      className="slds-button slds-button_neutral"
                                      style={{
                                        width: '100%',
                                        textAlign: 'left',
                                        padding: '8px 12px',
                                        background: selectedRaceId === race.id ? '#0176d3' : '#ffffff',
                                        color: selectedRaceId === race.id ? '#ffffff' : '#0176d3',
                                        fontWeight: selectedRaceId === race.id ? 'bold' : 'normal',
                                        border: selectedRaceId === race.id ? '1px solid #0176d3' : '1px solid #dddbda',
                                        borderRadius: '4px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                      }}
                                    >
                                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        #{race.sequence}. {race.name}
                                      </span>
                                      <span style={{ fontSize: '10px', opacity: 0.85 }}>Ready</span>
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Right Pane: Focused Race details / StandingsEditor OR clean placeholder state */}
                    <div style={{ flex: '2 1 500px', minWidth: '0' }}>
                      {selectedRaceId === null || !selectedRace ? (
                        /* Case A: Show elegant, clean placeholder state box */
                        <div className="slds-box slds-align_absolute-center bg-white" style={{ background: '#ffffff', borderRadius: '4px', border: '1px solid #dddbda', minHeight: '400px', display: 'flex', justifyContent: 'center', alignItems: 'center', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                          <div style={{ padding: '2rem' }}>
                            <p className="slds-text-heading_medium font-bold text-slate-700" style={{ fontWeight: 'bold', fontSize: '1.25rem' }}>
                              No Race Track Selected
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
                      ) : (
                        /* Case B: Specific Race is selected — render management controls, lineup and StandingsEditor */
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
                                      setSelectedRace(null)
                                    }}
                                    className="slds-button slds-button_neutral"
                                    style={{ padding: '4px 12px', fontSize: '12px' }}
                                  >
                                    Back to Overview
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
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 4: Datasets (Disabled Placeholder) */}
            {activeTab === 'datasets' && (
              <div className="slds-tabs_default__content slds-show slds-p-vertical_medium" style={{ paddingTop: '1.5rem' }}>
                <div className="slds-align_absolute-center slds-p-around_large text-slate-500" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
                  <p className="slds-text-heading_small font-bold text-slate-700" style={{ fontWeight: 'bold' }}>Importing records is coming soon</p>
                  <p className="slds-text-body_regular text-slate-500 slds-m-top_xx-small">
                    Dataset import formats are still being finalized.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="slds-box slds-align_absolute-center bg-white" style={{ background: '#ffffff', borderRadius: '4px', border: '1px solid #dddbda', minHeight: '400px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div className="slds-text-align_center">
            <p className="slds-text-heading_medium font-bold text-slate-700 slds-m-top_medium" style={{ fontWeight: 'bold' }}>
              Event Not Found
            </p>
            <p className="slds-text-body_regular text-slate-500 slds-m-top_xx-small">
              The requested event could not be loaded. It may have been deleted.
            </p>
            <Link
              to="/admin/events"
              className="slds-button slds-button_brand slds-m-top_medium"
              style={{ padding: '6px 16px' }}
            >
              &larr; Back to Events
            </Link>
          </div>
        </div>
      )}

      {/* RACE CREATION DIALOG MODAL */}
      {showCreateRaceModal && (
        <div className="slds-scope">
          <section role="dialog" tabIndex={-1} aria-modal="true" className="slds-modal slds-fade-in-open" style={{ zIndex: 9001 }}>
            <div className="slds-modal__container" style={{ maxWidth: '40rem', width: '90%' }}>
              <header className="slds-modal__header">
                <button
                  className="slds-button slds-button_icon slds-modal__close"
                  title="Close"
                  onClick={() => setShowCreateRaceModal(false)}
                  style={{
                    position: 'absolute',
                    top: '1rem',
                    right: '1.5rem',
                    background: 'transparent',
                    border: 'none',
                    fontSize: '1.25rem',
                    cursor: 'pointer',
                    color: '#747474',
                  }}
                >
                  ✕
                </button>
                <h2 className="slds-modal__title slds-hyphenate font-bold text-slate-900" style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                  Configure New Race Track
                </h2>
              </header>

              <form onSubmit={onCreateRaceSubmit}>
                <div className="slds-modal__content slds-p-around_medium" style={{ background: '#fff' }}>
                  <div className="slds-form slds-form_stacked">
                    {/* Helper text explaining the auto-append behavior */}
                    <p className="slds-m-bottom_medium" style={{ fontSize: '13px', color: '#57606a', fontStyle: 'italic' }}>
                      New races are added to the end of the event schedule. You can reorder them later from the race list.
                    </p>

                    {/* Race Name */}
                    <div className="slds-form-element slds-m-bottom_medium">
                      <label className="slds-form-element__label font-bold text-slate-700" style={{ fontWeight: 'bold' }} htmlFor="race-name">
                        Race Name <span className="text-red-500">*</span>
                      </label>
                      <div className="slds-form-element__control">
                        <input
                          id="race-name"
                          type="text"
                          required
                          placeholder="e.g. Kyoto Derby"
                          value={newRaceForm.name}
                          onChange={(e) => setNewRaceForm((c) => ({ ...c, name: e.target.value }))}
                          className="slds-input"
                          style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px', width: '100%' }}
                        />
                      </div>
                    </div>

                    <div className="slds-grid slds-gutters slds-wrap" style={{ display: 'flex', gap: '16px', marginBottom: '1rem' }}>
                      <div className="slds-col slds-size_1-of-1" style={{ flex: 1 }}>
                        <div className="slds-form-element">
                          <label className="slds-form-element__label font-bold text-slate-700" style={{ fontWeight: 'bold' }} htmlFor="race-distance">
                            Distance (Meters)
                          </label>
                          <div className="slds-form-element__control">
                            <input
                              id="race-distance"
                              type="number"
                              value={newRaceForm.distanceMeters}
                              onChange={(e) => setNewRaceForm((c) => ({ ...c, distanceMeters: Number(e.target.value) || 1200 }))}
                              className="slds-input"
                              style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px', width: '100%' }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="slds-grid slds-gutters slds-wrap" style={{ display: 'flex', gap: '16px', marginBottom: '1rem' }}>
                      <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-4" style={{ flex: 1 }}>
                        <div className="slds-form-element">
                          <label className="slds-form-element__label font-bold text-slate-700" style={{ fontWeight: 'bold' }} htmlFor="race-track">
                            Track Type
                          </label>
                          <div className="slds-form-element__control">
                            <input
                              id="race-track"
                              type="text"
                              placeholder="e.g. Turf, Dirt"
                              value={newRaceForm.trackType}
                              onChange={(e) => setNewRaceForm((c) => ({ ...c, trackType: e.target.value }))}
                              className="slds-input"
                              style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px', width: '100%' }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-4" style={{ flex: 1 }}>
                        <div className="slds-form-element">
                          <label className="slds-form-element__label font-bold text-slate-700" style={{ fontWeight: 'bold' }} htmlFor="race-loc">
                            Location <span className="text-red-500">*</span>
                          </label>
                          <div className="slds-form-element__control">
                            <input
                              id="race-loc"
                              type="text"
                              required
                              placeholder="e.g. Kyoto Racecourse"
                              value={newRaceForm.location}
                              onChange={(e) => setNewRaceForm((c) => ({ ...c, location: e.target.value }))}
                              className="slds-input"
                              style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px', width: '100%' }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-4" style={{ flex: 1 }}>
                        <div className="slds-form-element">
                          <label className="slds-form-element__label font-bold text-slate-700" style={{ fontWeight: 'bold' }} htmlFor="race-restriction">
                            Class Restriction
                          </label>
                          <div className="slds-form-element__control">
                            <select
                              id="race-restriction"
                              value={newRaceForm.classRestriction}
                              onChange={(e) => setNewRaceForm((c) => ({ ...c, classRestriction: e.target.value as eventmanager.ClassTier }))}
                              className="slds-select"
                              style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px', width: '100%' }}
                            >
                              {CLASS_TIER_OPTIONS.map((tier) => (
                                <option key={tier} value={tier}>{tier}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      {selectedEvent && selectedEvent.scoringType === 1 && (
                        <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-4" style={{ flex: 1 }}>
                          <div className="slds-form-element">
                            <label className="slds-form-element__label font-bold text-slate-700" style={{ fontWeight: 'bold' }} htmlFor="race-grade">
                              Race Grade
                            </label>
                            <div className="slds-form-element__control">
                              <select
                                id="race-grade"
                                value={newRaceForm.grade || ''}
                                onChange={(e) => setNewRaceForm((c) => ({ ...c, grade: e.target.value }))}
                                className="slds-select"
                                style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px', width: '100%' }}
                              >
                                <option value="">-- Choose Grade --</option>
                                <option value="OP">OP</option>
                                <option value="GIII">GIII</option>
                                <option value="GII">GII</option>
                                <option value="GI">GI</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <footer className="slds-modal__footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setShowCreateRaceModal(false)}
                    className="slds-button slds-button_neutral"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="slds-button slds-button_brand"
                  >
                    Create Race Track
                  </button>
                </footer>
              </form>
            </div>
          </section>
          <div className="slds-backdrop slds-backdrop_open" style={{ zIndex: 9000 }} />
        </div>
      )}

      {/* EDIT EVENT DETAILS DIALOG MODAL */}
      {showEditEventModal && (
        <div className="slds-scope">
          <section role="dialog" tabIndex={-1} aria-modal="true" className="slds-modal slds-fade-in-open" style={{ zIndex: 9001 }}>
            <div className="slds-modal__container" style={{ maxWidth: '40rem', width: '90%' }}>
              <header className="slds-modal__header">
                <button
                  className="slds-button slds-button_icon slds-modal__close"
                  title="Close"
                  onClick={() => setShowEditEventModal(false)}
                  style={{
                    position: 'absolute',
                    top: '1rem',
                    right: '1.5rem',
                    background: 'transparent',
                    border: 'none',
                    fontSize: '1.25rem',
                    cursor: 'pointer',
                    color: '#747474',
                  }}
                >
                  ✕
                </button>
                <h2 className="slds-modal__title slds-hyphenate font-bold text-slate-900" style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                  Edit Event Details
                </h2>
              </header>

              <form onSubmit={onEditEventSubmit}>
                <div className="slds-modal__content slds-p-around_medium" style={{ background: '#fff', maxHeight: '70vh', overflowY: 'auto' }}>
                  <div className="slds-form slds-form_stacked">
                    {/* Event Name */}
                    <div className="slds-form-element slds-m-bottom_medium">
                      <label className="slds-form-element__label font-bold text-slate-700" style={{ fontWeight: 'bold' }} htmlFor="edit-event-name">
                        Event Name <span className="text-red-500">*</span>
                      </label>
                      <div className="slds-form-element__control">
                        <input
                          id="edit-event-name"
                          type="text"
                          required
                          placeholder="e.g. Winter Derby Championship"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="slds-input"
                          style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px', width: '100%' }}
                        />
                      </div>
                    </div>

                    {/* Description */}
                    <div className="slds-form-element slds-m-bottom_medium">
                      <label className="slds-form-element__label font-bold text-slate-700" style={{ fontWeight: 'bold' }} htmlFor="edit-event-desc">
                        Description
                      </label>
                      <div className="slds-form-element__control">
                        <textarea
                          id="edit-event-desc"
                          placeholder="Brief description..."
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className="slds-textarea"
                          style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px', width: '100%', minHeight: '80px' }}
                        />
                      </div>
                    </div>

                    {selectedEvent && selectedEvent.scoringType === 1 && (
                      <div className="slds-form-element slds-m-bottom_medium" style={{ borderTop: '1px solid #dddbda', paddingTop: '1rem' }}>
                        <label className="slds-form-element__label font-bold text-slate-700" style={{ fontWeight: 'bold' }} htmlFor="edit-scoring-rules-mode">
                          Points Scoring Rules Source
                        </label>
                        <div className="slds-form-element__control">
                          <select
                            id="edit-scoring-rules-mode"
                            value={editScoringRulesMode}
                            onChange={(e) => setEditScoringRulesMode(e.target.value as 'STANDARD' | 'CUSTOM')}
                            className="slds-select"
                            style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px', width: '100%' }}
                          >
                            <option value="STANDARD">Standard Default Tables</option>
                            <option value="CUSTOM">Custom Event Tables (Configure below)</option>
                          </select>
                        </div>

                        {editScoringRulesMode === 'CUSTOM' && (
                          <div className="slds-m-top_medium">
                            <EventScoringTablesEditor
                              value={editCustomScoringTables}
                              onChange={setEditCustomScoringTables}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    <div className="slds-grid slds-gutters slds-wrap" style={{ display: 'flex', gap: '16px', marginBottom: '1rem', borderTop: '1px solid #dddbda', paddingTop: '1rem' }}>
                      <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2" style={{ flex: 1 }}>
                        <div className="slds-form-element">
                          <label className="slds-form-element__label font-bold text-slate-700" style={{ fontWeight: 'bold' }} htmlFor="edit-class-tier">
                            Class Tier Eligibility
                          </label>
                          <div className="slds-form-element__control">
                            <select
                              id="edit-class-tier"
                              value={editClassRestriction || ''}
                              onChange={(e) => setEditClassRestriction(e.target.value ? e.target.value as eventmanager.ClassTier : null)}
                              className="slds-select"
                              style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px', width: '100%' }}
                            >
                              <option value="">Any Tier Eligibility (None)</option>
                              <option value="PRE_OP">PRE_OP</option>
                              <option value="OP">OP</option>
                              <option value="G3">G3</option>
                              <option value="G2">G2</option>
                              <option value="G1">G1</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', justifyContent: 'center' }}>
                        <div className="slds-form-element">
                          <div className="slds-form-element__control">
                            <div className="slds-checkbox">
                              <input
                                type="checkbox"
                                id="edit-granular-participation"
                                checked={editGranularParticipation}
                                onChange={(e) => setEditGranularParticipation(e.target.checked)}
                                style={{ marginRight: '8px' }}
                              />
                              <label className="slds-checkbox__label font-bold text-slate-700" style={{ fontWeight: 'bold' }} htmlFor="edit-granular-participation">
                                <span className="slds-checkbox_faux"></span>
                                <span className="slds-form-element__label">Enable Granular Participation</span>
                              </label>
                            </div>
                          </div>
                        </div>

                        <div className="slds-form-element">
                          <div className="slds-form-element__control">
                            <div className="slds-checkbox">
                              <input
                                type="checkbox"
                                id="edit-signups-locked"
                                checked={editSignupsLocked}
                                onChange={(e) => setEditSignupsLocked(e.target.checked)}
                                style={{ marginRight: '8px' }}
                              />
                              <label className="slds-checkbox__label font-bold text-slate-700" style={{ fontWeight: 'bold' }} htmlFor="edit-signups-locked">
                                <span className="slds-checkbox_faux"></span>
                                <span className="slds-form-element__label">Lock Event Signups</span>
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <footer className="slds-modal__footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setShowEditEventModal(false)}
                    className="slds-button slds-button_neutral"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="slds-button slds-button_brand"
                  >
                    Save Changes
                  </button>
                </footer>
              </form>
            </div>
          </section>
          <div className="slds-backdrop slds-backdrop_open" style={{ zIndex: 9000 }} />
        </div>
      )}

      {/* CONFIRM RECOMPUTE WARNING DIALOG MODAL */}
      {showConfirmModal && (
        <div className="slds-scope">
          <section role="dialog" tabIndex={-1} aria-modal="true" className="slds-modal slds-fade-in-open" style={{ zIndex: 10001 }}>
            <div className="slds-modal__container" style={{ maxWidth: '30rem', width: '90%' }}>
              <header className="slds-modal__header slds-theme_warning slds-theme_alert-texture" style={{ backgroundColor: '#f57c00', color: '#fff' }}>
                <button
                  className="slds-button slds-button_icon slds-modal__close"
                  title="Close"
                  onClick={() => setShowConfirmModal(false)}
                  style={{
                    position: 'absolute',
                    top: '1rem',
                    right: '1.5rem',
                    background: 'transparent',
                    border: 'none',
                    fontSize: '1.25rem',
                    cursor: 'pointer',
                    color: '#fff',
                  }}
                >
                  ✕
                </button>
                <h2 className="slds-modal__title slds-hyphenate font-bold text-white" style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff' }}>
                  Recalculate Points Warning
                </h2>
              </header>

              <div className="slds-modal__content slds-p-around_medium" style={{ background: '#fff' }}>
                <p style={{ fontSize: '14px', lineHeight: '1.5', color: '#1e293b' }}>
                  Changing the event's scoring tables will trigger an <strong>automatic background recomputation</strong> of points for all existing race results associated with this event.
                </p>
                <p className="slds-m-top_small" style={{ fontSize: '13px', lineHeight: '1.5', color: '#e11d48', fontWeight: 'bold' }}>
                  ⚠️ This can invalidate previously computed points on recorded standings.
                </p>
                <p className="slds-m-top_small" style={{ fontSize: '14px', lineHeight: '1.5', color: '#1e293b' }}>
                  Are you absolutely sure you want to proceed and save these changes?
                </p>
              </div>

              <footer className="slds-modal__footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="slds-button slds-button_neutral"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setShowConfirmModal(false)
                    await performSaveEventDetails()
                  }}
                  className="slds-button slds-button_brand"
                  style={{ backgroundColor: '#0176d3', color: '#fff' }}
                >
                  Confirm & Save
                </button>
              </footer>
            </div>
          </section>
          <div className="slds-backdrop slds-backdrop_open" style={{ zIndex: 10000 }} />
        </div>
      )}
    </AdminLayout>
  )
}
