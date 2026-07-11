import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { requireSiteAdmin } from '../../lib/admin-guard'
import { AdminLayout } from './-AdminLayout'
import {
  listAdminEvents,
  getAdminEvent,
  updateAdminEventStatus,
  listRaceEvents,
  createRaceEvent,
  updateRaceEvent,
  deleteRaceEvent,
  listRaceResults,
  assignRaceResult,
  replaceRaceResults,
  mergeRaceResults,
  deleteRaceResult,
  addEventMember,
  removeEventMember,
} from '../../lib/admin-api'
import type { eventmanager } from '../../lib/client'

export const Route = createFileRoute('/admin/events')({
  beforeLoad: async ({ location }) => {
    await requireSiteAdmin(location)
  },
  component: AdminEventsPage,
})

const STATUS_OPTIONS: eventmanager.EventStatus[] = ['DRAFT', 'UNOFFICIAL', 'OFFICIAL', 'CONCLUDED']
const CLASS_TIER_OPTIONS = ['PRE_OP', 'OP', 'G3', 'G2', 'G1']

type ActiveTab = 'details' | 'members' | 'races'

function AdminEventsPage() {
  const { session } = useAuth()
  const [events, setEvents] = useState<eventmanager.EventDetail[]>([])
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<eventmanager.EventDetail | null>(null)
  const [activeTab, setActiveTab] = useState<ActiveTab>('details')

  // Race Management States
  const [races, setRaces] = useState<eventmanager.RaceEventDetail[]>([])
  const [selectedRaceId, setSelectedRaceId] = useState<string | null>(null)
  const [selectedRace, setSelectedRace] = useState<eventmanager.RaceEventDetail | null>(null)

  // Results Editor States
  const [results, setResults] = useState<eventmanager.RaceResultView[]>([])
  const [editedResults, setEditedResults] = useState<Record<string, { position: string; points: string }>>({})
  const [pendingDeletions, setPendingDeletions] = useState<Set<string>>(new Set())

  // Form States
  const [newMemberUserId, setNewMemberUserId] = useState('')
  const [newRaceForm, setNewRaceForm] = useState({
    name: '',
    sequence: 1,
    distanceMeters: 1200,
    trackType: 'Turf',
    location: '',
    classRestriction: 'OP' as eventmanager.ClassTier,
  })

  // Global UI States
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [loadingEventDetail, setLoadingEventDetail] = useState(false)
  const [loadingRaces, setLoadingRaces] = useState(false)
  const [loadingResults, setLoadingResults] = useState(false)
  const [savingBatch, setSavingBatch] = useState(false)
  const [eventStatusSaving, setEventStatusSaving] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [globalSuccess, setGlobalSuccess] = useState<string | null>(null)

  const authHeader = useMemo(() => {
    const token = session?.session.token
    return token ? `Bearer ${token}` : null
  }, [session?.session.token])

  // Load all events
  async function loadEvents() {
    setLoadingEvents(true)
    setGlobalError(null)
    try {
      const response = await listAdminEvents()
      setEvents(response.events)
    } catch (cause) {
      setGlobalError(cause instanceof Error ? cause.message : 'Unable to load events')
    } finally {
      setLoadingEvents(false)
    }
  }

  useEffect(() => {
    void loadEvents()
  }, [])

  // Load selected event details
  async function handleSelectEvent(eventId: string) {
    setSelectedEventId(eventId)
    setLoadingEventDetail(true)
    setGlobalError(null)
    setGlobalSuccess(null)
    setSelectedRaceId(null)
    setSelectedRace(null)
    setResults([])
    setEditedResults({})
    setPendingDeletions(new Set())
    try {
      const detail = await getAdminEvent(eventId)
      setSelectedEvent(detail)
      setRaces(detail.raceEvents as eventmanager.RaceEventDetail[])
    } catch (cause) {
      setGlobalError(cause instanceof Error ? cause.message : 'Unable to load event details')
      setSelectedEvent(null)
    } finally {
      setLoadingEventDetail(false)
    }
  }

  // Reload current event details
  async function reloadCurrentEvent() {
    if (!selectedEventId) return
    try {
      const detail = await getAdminEvent(selectedEventId)
      setSelectedEvent(detail)
      setRaces(detail.raceEvents as eventmanager.RaceEventDetail[])
    } catch (err) {
      console.error('Failed to reload current event details', err)
    }
  }

  // Update parent event lifecycle status
  async function handleUpdateEventStatus(status: eventmanager.EventStatus) {
    if (!selectedEventId || !authHeader) {
      setGlobalError('Authentication token is required.')
      return
    }
    setEventStatusSaving(true)
    setGlobalError(null)
    setGlobalSuccess(null)
    try {
      const updated = await updateAdminEventStatus(selectedEventId, status, authHeader)
      setSelectedEvent(updated)
      setEvents((current) => current.map((evt) => (evt.id === updated.id ? updated : evt)))
      setGlobalSuccess(`Successfully updated event status to ${status}.`)
    } catch (cause) {
      setGlobalError(cause instanceof Error ? cause.message : 'Unable to update status')
    } finally {
      setEventStatusSaving(false)
    }
  }

  // Add Member
  async function handleAddMember(evt: React.FormEvent) {
    evt.preventDefault()
    if (!selectedEventId || !newMemberUserId.trim() || !authHeader) {
      return
    }
    setGlobalError(null)
    setGlobalSuccess(null)
    try {
      const updated = await addEventMember(selectedEventId, newMemberUserId.trim(), authHeader)
      setSelectedEvent(updated)
      setNewMemberUserId('')
      setGlobalSuccess(`Successfully registered member "${newMemberUserId}" to the event.`)
    } catch (cause) {
      setGlobalError(cause instanceof Error ? cause.message : 'Unable to register event member')
    }
  }

  // Remove Member
  async function handleRemoveMember(userId: string) {
    if (!selectedEventId || !authHeader) return
    if (!confirm('Are you sure you want to remove this participant from the event?')) return
    setGlobalError(null)
    setGlobalSuccess(null)
    try {
      const updated = await removeEventMember(selectedEventId, userId, authHeader)
      setSelectedEvent(updated)
      setGlobalSuccess('Successfully removed participant from the event.')
    } catch (cause) {
      setGlobalError(cause instanceof Error ? cause.message : 'Unable to remove member')
    }
  }

  // Create Race Event
  async function handleCreateRace(evt: React.FormEvent) {
    evt.preventDefault()
    if (!selectedEventId || !newRaceForm.name || !authHeader) return
    setGlobalError(null)
    setGlobalSuccess(null)
    try {
      await createRaceEvent(selectedEventId, newRaceForm, authHeader)
      await reloadCurrentEvent()
      setNewRaceForm({
        name: '',
        sequence: races.length + 1,
        distanceMeters: 1200,
        trackType: 'Turf',
        location: '',
        classRestriction: 'OP',
      })
      setGlobalSuccess(`Successfully created race event "${newRaceForm.name}".`)
    } catch (cause) {
      setGlobalError(cause instanceof Error ? cause.message : 'Unable to create race event')
    }
  }

  // Start Race (Manual startsAt)
  async function handleStartRace(raceId: string) {
    if (!selectedEventId || !authHeader) return
    setGlobalError(null)
    setGlobalSuccess(null)
    try {
      const nowString = new Date().toISOString()
      const updated = await updateRaceEvent(selectedEventId, raceId, { startsAt: nowString }, authHeader)
      setRaces((current) => current.map((r) => (r.id === raceId ? updated : r)))
      if (selectedRaceId === raceId) {
        setSelectedRace(updated)
      }
      setGlobalSuccess(`Race manually started at ${new Date(nowString).toLocaleTimeString()}.`)
    } catch (cause) {
      setGlobalError(cause instanceof Error ? cause.message : 'Unable to start race')
    }
  }

  // End Race (Manual endsAt)
  async function handleEndRace(raceId: string) {
    if (!selectedEventId || !authHeader) return
    setGlobalError(null)
    setGlobalSuccess(null)
    try {
      const nowString = new Date().toISOString()
      const updated = await updateRaceEvent(selectedEventId, raceId, { endsAt: nowString }, authHeader)
      setRaces((current) => current.map((r) => (r.id === raceId ? updated : r)))
      if (selectedRaceId === raceId) {
        setSelectedRace(updated)
      }
      setGlobalSuccess(`Race manually ended at ${new Date(nowString).toLocaleTimeString()}.`)
    } catch (cause) {
      setGlobalError(cause instanceof Error ? cause.message : 'Unable to end race')
    }
  }

  // Delete Race
  async function handleDeleteRace(raceId: string) {
    if (!selectedEventId || !authHeader) return
    if (!confirm('Are you sure you want to delete this race event? All registered results for this race will be deleted.')) return
    setGlobalError(null)
    setGlobalSuccess(null)
    try {
      await deleteRaceEvent(selectedEventId, raceId, authHeader)
      if (selectedRaceId === raceId) {
        setSelectedRaceId(null)
        setSelectedRace(null)
        setResults([])
        setEditedResults({})
        setPendingDeletions(new Set())
      }
      await reloadCurrentEvent()
      setGlobalSuccess('Race event deleted successfully.')
    } catch (cause) {
      setGlobalError(cause instanceof Error ? cause.message : 'Unable to delete race')
    }
  }

  // Select Race to load results
  async function handleSelectRace(race: eventmanager.RaceEventDetail) {
    setSelectedRaceId(race.id)
    setSelectedRace(race)
    setLoadingResults(true)
    setGlobalError(null)
    setGlobalSuccess(null)
    setEditedResults({})
    setPendingDeletions(new Set())
    try {
      const response = await listRaceResults(selectedEventId!, race.id)
      setResults(response.results)

      // Initialize form input buffer with existing values
      const initialEdits: Record<string, { position: string; points: string }> = {}
      for (const res of response.results) {
        initialEdits[res.userId] = {
          position: res.position !== null ? String(res.position) : '',
          points: String(res.points),
        }
      }
      setEditedResults(initialEdits)
    } catch (cause) {
      setGlobalError(cause instanceof Error ? cause.message : 'Unable to load race results')
      setResults([])
    } finally {
      setLoadingResults(false)
    }
  }

  // Handle single result input change
  function handleResultChange(userId: string, field: 'position' | 'points', value: string) {
    setEditedResults((current) => ({
      ...current,
      [userId]: {
        ...(current[userId] ?? { position: '', points: '0' }),
        [field]: value,
      },
    }))
  }

  // Mark row as pending deletion or reset its inputs
  function togglePendingDeletion(userId: string) {
    setPendingDeletions((current) => {
      const next = new Set(current)
      if (next.has(userId)) {
        next.delete(userId)
      } else {
        next.add(userId)
      }
      return next
    })
  }

  // Undo changes to a single row
  function handleUndoRow(userId: string) {
    const saved = results.find((r) => r.userId === userId)
    setEditedResults((current) => ({
      ...current,
      [userId]: {
        position: saved && saved.position !== null ? String(saved.position) : '',
        points: saved ? String(saved.points) : '0',
      },
    }))
    setPendingDeletions((current) => {
      const next = new Set(current)
      next.delete(userId)
      return next
    })
  }

  // Derive status and states for each member in the results editor
  const derivedStates = useMemo(() => {
    if (!selectedEvent) return []

    return selectedEvent.members.map((member) => {
      const savedResult = results.find((r) => r.userId === member.userId)
      const edit = editedResults[member.userId] ?? { position: '', points: '0' }
      const isPendingDelete = pendingDeletions.has(member.userId)

      let rowState: 'unchanged' | 'new' | 'modified' | 'pending_delete' = 'unchanged'

      if (isPendingDelete) {
        rowState = 'pending_delete'
      } else if (savedResult) {
        const savedPos = savedResult.position !== null ? String(savedResult.position) : ''
        const savedPoints = String(savedResult.points)
        if (edit.position !== savedPos || edit.points !== savedPoints) {
          rowState = 'modified'
        }
      } else {
        const isDefault = edit.position === '' && (edit.points === '' || edit.points === '0')
        if (!isDefault) {
          rowState = 'new'
        }
      }

      return {
        member,
        savedResult,
        edit,
        rowState,
      }
    })
  }, [selectedEvent, results, editedResults, pendingDeletions])

  // Aggregate staged changes and deletions
  const changeSummary = useMemo(() => {
    let newCount = 0
    let modifiedCount = 0
    let deletedCount = 0

    for (const d of derivedStates) {
      if (d.rowState === 'new') newCount++
      if (d.rowState === 'modified') modifiedCount++
      if (d.rowState === 'pending_delete') deletedCount++
    }

    return {
      newCount,
      modifiedCount,
      deletedCount,
      totalCount: newCount + modifiedCount + deletedCount,
    }
  }, [derivedStates])

  // Unified Save Standings action (smart endpoint selection)
  async function handleUnifiedSave() {
    if (!selectedEventId || !selectedRaceId || !authHeader) return
    setSavingBatch(true)
    setGlobalError(null)
    setGlobalSuccess(null)

    try {
      const { newCount, modifiedCount, deletedCount, totalCount } = changeSummary

      if (totalCount === 0) {
        setGlobalError('No changes detected to save.')
        setSavingBatch(false)
        return
      }

      // Prepare payload of all non-deleted changes and additions
      const activeStagedChanges: eventmanager.RaceResultInput[] = []
      for (const d of derivedStates) {
        if (d.rowState === 'new' || d.rowState === 'modified') {
          activeStagedChanges.push({
            userId: d.member.userId,
            position: d.edit.position.trim() !== '' ? Number(d.edit.position) : null,
            points: Number(d.edit.points) || 0,
          })
        }
      }

      let nextResults = [...results]

      // Check for single-row optimizations
      if (totalCount === 1) {
        if (deletedCount === 1) {
          // Exactly 1 deletion
          const deletedUserId = Array.from(pendingDeletions)[0]
          await deleteRaceResult(selectedEventId, selectedRaceId, deletedUserId, authHeader)
          nextResults = results.filter((r) => r.userId !== deletedUserId)
          setResults(nextResults)
          setPendingDeletions(new Set())
          await reloadCurrentEvent()
          setGlobalSuccess('Successfully deleted participant result.')
        } else {
          // Exactly 1 addition or update
          const change = activeStagedChanges[0]
          const updated = await assignRaceResult(
            selectedEventId,
            selectedRaceId,
            change.userId,
            { position: change.position, points: change.points },
            authHeader,
          )
          const exists = results.some((r) => r.userId === change.userId)
          if (exists) {
            nextResults = results.map((r) => (r.userId === change.userId ? updated : r))
          } else {
            nextResults = [...results, updated]
          }
          setResults(nextResults)
          await reloadCurrentEvent()
          setGlobalSuccess('Successfully updated result in-place.')
        }
      } else {
        // Multi-row batch logic
        if (deletedCount > 0) {
          // At least 1 deletion: must do a Full Replace All to safely reconcile and remove deleted ones
          const fullReplacePayload: eventmanager.RaceResultInput[] = []

          for (const d of derivedStates) {
            if (d.rowState === 'unchanged' && d.savedResult) {
              fullReplacePayload.push({
                userId: d.member.userId,
                position: d.savedResult.position,
                points: d.savedResult.points,
              })
            } else if (d.rowState === 'new' || d.rowState === 'modified') {
              fullReplacePayload.push({
                userId: d.member.userId,
                position: d.edit.position.trim() !== '' ? Number(d.edit.position) : null,
                points: d.edit.points.trim() !== '' ? Number(d.edit.points) : 0,
              })
            }
          }

          const response = await replaceRaceResults(selectedEventId, selectedRaceId, fullReplacePayload, authHeader)
          nextResults = response.results
          setResults(nextResults)
          setPendingDeletions(new Set())
          await reloadCurrentEvent()
          setGlobalSuccess('Successfully updated standings (Full Replace applied to reconcile deletions).')
        } else {
          // No deletions, only multiple additions/updates: we can safely perform a Merge
          const response = await mergeRaceResults(selectedEventId, selectedRaceId, activeStagedChanges, authHeader)
          nextResults = response.results
          setResults(nextResults)
          await reloadCurrentEvent()
          setGlobalSuccess('Successfully merged and updated standings.')
        }
      }

      // Re-initialize input buffer using nextResults
      const nextEdits: Record<string, { position: string; points: string }> = {}
      for (const res of nextResults) {
        nextEdits[res.userId] = {
          position: res.position !== null ? String(res.position) : '',
          points: String(res.points),
        }
      }
      setEditedResults(nextEdits)
    } catch (cause) {
      setGlobalError(cause instanceof Error ? cause.message : 'Unable to save standings changes')
    } finally {
      setSavingBatch(false)
    }
  }

  // Derive ongoing / manual race statuses
  const isRaceOngoing = (race: eventmanager.RaceEventDetail) => {
    return race.startsAt !== null && race.endsAt === null
  }

  const isRaceConcluded = (race: eventmanager.RaceEventDetail) => {
    return race.endsAt !== null
  }

  const isRaceNotStarted = (race: eventmanager.RaceEventDetail) => {
    return race.startsAt === null
  }

  return (
    <AdminLayout
      title="Event & Race Operations"
      subtitle="Complete, high-fidelity operations panel. Track event lifecycles, register competitors, construct race tracks, and perform dynamic batch or in-place results entry."
    >
      <div className="slds-grid slds-wrap slds-gutters">
        {/* Left Hand: Master Event List */}
        <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-3 slds-m-bottom_medium">
          <article className="slds-card" style={{ border: '1px solid #dddbda', minHeight: '400px' }}>
            <div className="slds-card__header slds-grid slds-grid_align-spread" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <header className="slds-media slds-media_center slds-has-flexi-truncate">
                <div className="slds-media__figure" style={{ marginRight: '0.5rem' }}>
                  <span className="slds-icon_container" style={{ fontSize: '18px' }}>🏁</span>
                </div>
                <div className="slds-media__body">
                  <h2 className="slds-card__header-title">
                    <span className="slds-card__header-link slds-truncate font-semibold" style={{ fontWeight: 'bold' }}>
                      Competition Events
                    </span>
                  </h2>
                </div>
              </header>
              <button
                type="button"
                onClick={() => {
                  void loadEvents()
                }}
                className="slds-button slds-button_neutral"
                style={{ padding: '2px 10px', fontSize: '11px' }}
              >
                Refresh
              </button>
            </div>

            <div className="slds-card__body" style={{ padding: '0 1rem' }}>
              {loadingEvents ? (
                <p className="slds-text-body_small slds-p-around_medium" style={{ color: '#514f4d' }}>Loading events...</p>
              ) : events.length === 0 ? (
                <p className="slds-text-body_small slds-p-around_medium" style={{ color: '#514f4d' }}>No events found.</p>
              ) : (
                <ul className="slds-has-dividers_bottom-space" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                  {events.map((evt) => (
                    <li
                      key={evt.id}
                      className="slds-item slds-p-vertical_small"
                      style={{
                        cursor: 'pointer',
                        background: selectedEventId === evt.id ? '#f3f2f1' : 'transparent',
                        borderRadius: '4px',
                        padding: '8px',
                        transition: 'background 0.2s',
                        borderLeft: selectedEventId === evt.id ? '4px solid #0176d3' : '4px solid transparent',
                        marginBottom: '4px',
                      }}
                      onClick={() => void handleSelectEvent(evt.id)}
                    >
                      <div className="slds-grid slds-grid_align-spread" style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span className="slds-text-body_regular font-bold text-slate-900" style={{ fontWeight: 'bold' }}>{evt.name}</span>
                        <span
                          className={`slds-badge ${
                            evt.status === 'OFFICIAL'
                              ? 'slds-theme_success'
                              : evt.status === 'CONCLUDED'
                              ? 'slds-theme_inverse'
                              : 'slds-theme_light'
                          }`}
                          style={{
                            fontSize: '9px',
                            padding: '1px 6px',
                            borderRadius: '3px',
                            color: evt.status === 'OFFICIAL' ? '#fff' : evt.status === 'CONCLUDED' ? '#fff' : '#000',
                            backgroundColor: evt.status === 'OFFICIAL' ? '#2e7d32' : evt.status === 'CONCLUDED' ? '#180505' : '#e0e0e0',
                          }}
                        >
                          {evt.status}
                        </span>
                      </div>
                      <div className="slds-text-body_small text-slate-500 slds-m-top_xx-small" style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Type: {evt.scoringTypeLabel}</span>
                        <span>Tier: {evt.classRestriction ?? 'Any'}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </article>
        </div>

        {/* Right Hand: Selected Event Detail Console */}
        <div className="slds-col slds-size_1-of-1 slds-medium-size_2-of-3 slds-m-bottom_medium">
          {selectedEventId ? (
            <div className="slds-box bg-white" style={{ background: '#ffffff', borderRadius: '4px', border: '1px solid #dddbda', padding: '1.5rem' }}>
              {loadingEventDetail ? (
                <div className="slds-p-around_large slds-align_absolute-center">
                  <p className="slds-text-heading_small">Loading details for {events.find((e) => e.id === selectedEventId)?.name}...</p>
                </div>
              ) : selectedEvent ? (
                <div>
                  {/* Alert system */}
                  {globalError && (
                    <div className="slds-notify slds-notify_alert slds-theme_alert-texture slds-theme_error slds-m-bottom_medium" role="alert" style={{ borderRadius: '4px', background: '#d32f2f', color: '#fff', padding: '10px 16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span className="slds-icon_container slds-p-right_small">⚠️</span>
                      <h2>{globalError}</h2>
                    </div>
                  )}
                  {globalSuccess && (
                    <div className="slds-notify slds-notify_alert slds-theme_alert-texture slds-theme_info slds-m-bottom_medium" role="alert" style={{ borderRadius: '4px', background: '#2e7d32', color: '#fff', padding: '10px 16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span className="slds-icon_container slds-p-right_small">✓</span>
                      <h2>{globalSuccess}</h2>
                    </div>
                  )}

                  <div className="slds-grid slds-grid_align-spread slds-m-bottom_large" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #dddbda', paddingBottom: '1rem' }}>
                    <div>
                      <h2 className="slds-text-heading_medium font-bold text-slate-900" style={{ fontSize: '1.35rem', fontWeight: 'bold' }}>{selectedEvent.name}</h2>
                      <p className="slds-text-body_small text-slate-500">ID: {selectedEvent.id}</p>
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

                  {/* SLDS Tabs Secondary Context Header */}
                  <div className="slds-tabs_default slds-m-bottom_large">
                    <ul className="slds-tabs_default__nav" role="tablist" style={{ display: 'flex', borderBottom: '1px solid #dddbda', listStyle: 'none', margin: 0, padding: 0 }}>
                      <li className={`slds-tabs_default__item ${activeTab === 'details' ? 'slds-is-active' : ''}`} role="presentation" style={{ borderBottom: activeTab === 'details' ? '3px solid #0176d3' : 'none' }}>
                        <button
                          className="slds-tabs_default__link"
                          type="button"
                          onClick={() => setActiveTab('details')}
                          style={{ border: 'none', background: 'transparent', padding: '12px 16px', cursor: 'pointer', fontWeight: activeTab === 'details' ? 'bold' : 'normal', color: activeTab === 'details' ? '#0176d3' : '#180505' }}
                        >
                          Event Summary
                        </button>
                      </li>
                      <li className={`slds-tabs_default__item ${activeTab === 'members' ? 'slds-is-active' : ''}`} role="presentation" style={{ borderBottom: activeTab === 'members' ? '3px solid #0176d3' : 'none' }}>
                        <button
                          className="slds-tabs_default__link"
                          type="button"
                          onClick={() => setActiveTab('members')}
                          style={{ border: 'none', background: 'transparent', padding: '12px 16px', cursor: 'pointer', fontWeight: activeTab === 'members' ? 'bold' : 'normal', color: activeTab === 'members' ? '#0176d3' : '#180505' }}
                        >
                          Event Members ({selectedEvent.members.length})
                        </button>
                      </li>
                      <li className={`slds-tabs_default__item ${activeTab === 'races' ? 'slds-is-active' : ''}`} role="presentation" style={{ borderBottom: activeTab === 'races' ? '3px solid #0176d3' : 'none' }}>
                        <button
                          className="slds-tabs_default__link"
                          type="button"
                          onClick={() => setActiveTab('races')}
                          style={{ border: 'none', background: 'transparent', padding: '12px 16px', cursor: 'pointer', fontWeight: activeTab === 'races' ? 'bold' : 'normal', color: activeTab === 'races' ? '#0176d3' : '#180505' }}
                        >
                          Races & Tracks ({races.length})
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
                              Scoring Mode: <strong>{selectedEvent.scoringTypeLabel}</strong> ({selectedEvent.scoringType === 1 ? 'Points aggregation' : 'Ladder Rating (ELO)'})
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
                        </div>

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

                    {/* Tab 3: Races & Tracks */}
                    {activeTab === 'races' && (
                      <div className="slds-tabs_default__content slds-show slds-p-vertical_medium" style={{ paddingTop: '1.5rem' }}>
                        {/* Race creation block */}
                        <details className="slds-m-bottom_large" style={{ border: '1px solid #dddbda', borderRadius: '4px', background: '#f3f2f1' }}>
                          <summary className="font-bold text-slate-800" style={{ cursor: 'pointer', padding: '10px 16px', fontWeight: 'bold' }}>
                            🛠️ Click here to configure a New Race Event
                          </summary>
                          <div style={{ padding: '16px', borderTop: '1px solid #dddbda', background: '#ffffff' }}>
                            <form onSubmit={handleCreateRace} className="slds-grid slds-wrap slds-gutters" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                              <div className="slds-col slds-size_1-of-1 slds-medium-size_1-2" style={{ flex: '1 1 45%' }}>
                                <div className="slds-form-element">
                                  <label className="slds-form-element__label font-bold text-slate-700" style={{ fontWeight: 'bold' }}>Race Name</label>
                                  <input
                                    type="text"
                                    required
                                    placeholder="e.g. Kyoto Derby"
                                    value={newRaceForm.name}
                                    onChange={(e) => setNewRaceForm((c) => ({ ...c, name: e.target.value }))}
                                    className="slds-input"
                                    style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px' }}
                                  />
                                </div>
                              </div>
                              <div className="slds-col slds-size_1-of-1 slds-medium-size_1-4" style={{ flex: '1 1 20%' }}>
                                <div className="slds-form-element">
                                  <label className="slds-form-element__label font-bold text-slate-700" style={{ fontWeight: 'bold' }}>Seq Sequence</label>
                                  <input
                                    type="number"
                                    value={newRaceForm.sequence}
                                    onChange={(e) => setNewRaceForm((c) => ({ ...c, sequence: Number(e.target.value) || 1 }))}
                                    className="slds-input"
                                    style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px' }}
                                  />
                                </div>
                              </div>
                              <div className="slds-col slds-size_1-of-1 slds-medium-size_1-4" style={{ flex: '1 1 20%' }}>
                                <div className="slds-form-element">
                                  <label className="slds-form-element__label font-bold text-slate-700" style={{ fontWeight: 'bold' }}>Distance (Meters)</label>
                                  <input
                                    type="number"
                                    value={newRaceForm.distanceMeters}
                                    onChange={(e) => setNewRaceForm((c) => ({ ...c, distanceMeters: Number(e.target.value) || 1200 }))}
                                    className="slds-input"
                                    style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px' }}
                                  />
                                </div>
                              </div>
                              <div className="slds-col slds-size_1-of-1 slds-medium-size_1-3" style={{ flex: '1 1 30%' }}>
                                <div className="slds-form-element">
                                  <label className="slds-form-element__label font-bold text-slate-700" style={{ fontWeight: 'bold' }}>Track Type</label>
                                  <input
                                    type="text"
                                    placeholder="e.g. Turf, Dirt"
                                    value={newRaceForm.trackType}
                                    onChange={(e) => setNewRaceForm((c) => ({ ...c, trackType: e.target.value }))}
                                    className="slds-input"
                                    style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px' }}
                                  />
                                </div>
                              </div>
                              <div className="slds-col slds-size_1-of-1 slds-medium-size_1-3" style={{ flex: '1 1 30%' }}>
                                <div className="slds-form-element">
                                  <label className="slds-form-element__label font-bold text-slate-700" style={{ fontWeight: 'bold' }}>Location</label>
                                  <input
                                    type="text"
                                    required
                                    placeholder="e.g. Kyoto Racecourse"
                                    value={newRaceForm.location}
                                    onChange={(e) => setNewRaceForm((c) => ({ ...c, location: e.target.value }))}
                                    className="slds-input"
                                    style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px' }}
                                  />
                                </div>
                              </div>
                              <div className="slds-col slds-size_1-of-1 slds-medium-size_1-3" style={{ flex: '1 1 30%' }}>
                                <div className="slds-form-element">
                                  <label className="slds-form-element__label font-bold text-slate-700" style={{ fontWeight: 'bold' }}>Class Restriction</label>
                                  <select
                                    value={newRaceForm.classRestriction}
                                    onChange={(e) => setNewRaceForm((c) => ({ ...c, classRestriction: e.target.value as eventmanager.ClassTier }))}
                                    className="slds-select"
                                    style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px' }}
                                  >
                                    {CLASS_TIER_OPTIONS.map((tier) => (
                                      <option key={tier} value={tier}>{tier}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                              <div className="slds-col slds-size_1-of-1" style={{ width: '100%', marginTop: '12px' }}>
                                <button type="submit" className="slds-button slds-button_brand">
                                  Create Race Event
                                </button>
                              </div>
                            </form>
                          </div>
                        </details>

                        {/* List Races */}
                        <h3 className="slds-text-heading_small font-bold slds-m-bottom_small text-slate-900" style={{ fontWeight: 'bold' }}>Event Races</h3>
                        {races.length === 0 ? (
                          <p className="slds-text-body_small text-slate-500">No race tracks have been configured under this event yet.</p>
                        ) : (
                          <div className="slds-scrollable_x">
                            <table className="slds-table slds-table_cell-buffer slds-table_bordered" style={{ border: '1px solid #dddbda' }}>
                              <thead>
                                <tr className="slds-line-height_reset" style={{ background: '#f3f2f1' }}>
                                  <th scope="col" style={{ fontWeight: 'bold' }}><div className="slds-truncate">Seq</div></th>
                                  <th scope="col" style={{ fontWeight: 'bold' }}><div className="slds-truncate">Race Name</div></th>
                                  <th scope="col" style={{ fontWeight: 'bold' }}><div className="slds-truncate">Track & Distance</div></th>
                                  <th scope="col" style={{ fontWeight: 'bold' }}><div className="slds-truncate">Location</div></th>
                                  <th scope="col" style={{ fontWeight: 'bold' }}><div className="slds-truncate">Status / Schedule</div></th>
                                  <th scope="col" style={{ fontWeight: 'bold', width: '220px' }}><div className="slds-truncate">Manual Operations</div></th>
                                </tr>
                              </thead>
                              <tbody>
                                {races.map((race) => (
                                  <tr
                                    key={race.id}
                                    className="slds-hint-parent"
                                    style={{
                                      background: selectedRaceId === race.id ? '#e0f2fe' : 'transparent',
                                      borderLeft: selectedRaceId === race.id ? '4px solid #0284c7' : 'none',
                                    }}
                                  >
                                    <td><strong>#{race.sequence}</strong></td>
                                    <td><span className="font-bold text-slate-900" style={{ fontWeight: 'bold' }}>{race.name}</span></td>
                                    <td>{race.trackType} ({race.distanceMeters}m)</td>
                                    <td>{race.location}</td>
                                    <td>
                                      {isRaceNotStarted(race) ? (
                                        <span className="slds-badge slds-theme_light" style={{ padding: '2px 8px', borderRadius: '4px', background: '#e0e0e0', color: '#333' }}>
                                          Not Started
                                        </span>
                                      ) : isRaceOngoing(race) ? (
                                        <span className="slds-badge slds-theme_warning" style={{ padding: '2px 8px', borderRadius: '4px', background: '#ff9800', color: '#fff', animation: 'pulse 2s infinite' }}>
                                          🔴 Ongoing / Live
                                        </span>
                                      ) : (
                                        <span className="slds-badge slds-theme_success" style={{ padding: '2px 8px', borderRadius: '4px', background: '#2e7d32', color: '#fff' }}>
                                          Concluded
                                        </span>
                                      )}
                                      <div className="text-slate-500 slds-m-top_xx-small" style={{ fontSize: '10px' }}>
                                        {race.startsAt ? `Started: ${new Date(race.startsAt).toLocaleTimeString()}` : ''} <br />
                                        {race.endsAt ? `Ended: ${new Date(race.endsAt).toLocaleTimeString()}` : ''}
                                      </div>
                                    </td>
                                    <td>
                                      <div className="slds-grid slds-wrap" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {/* Start Race */}
                                        {isRaceNotStarted(race) && (
                                          <button
                                            type="button"
                                            onClick={() => void handleStartRace(race.id)}
                                            className="slds-button slds-button_success"
                                            style={{ padding: '2px 8px', fontSize: '11px', background: '#2e7d32', color: '#fff' }}
                                          >
                                            🚀 Start
                                          </button>
                                        )}
                                        {/* End Race */}
                                        {isRaceOngoing(race) && (
                                          <button
                                            type="button"
                                            onClick={() => void handleEndRace(race.id)}
                                            className="slds-button slds-button_destructive"
                                            style={{ padding: '2px 8px', fontSize: '11px', background: '#d32f2f', color: '#fff' }}
                                          >
                                            🏁 End
                                          </button>
                                        )}
                                        {/* Edit Standings/Results */}
                                        <button
                                          type="button"
                                          onClick={() => void handleSelectRace(race)}
                                          className="slds-button slds-button_brand"
                                          style={{ padding: '2px 8px', fontSize: '11px' }}
                                        >
                                          🎯 Edit Results
                                        </button>
                                        {/* Delete */}
                                        <button
                                          type="button"
                                          onClick={() => void handleDeleteRace(race.id)}
                                          className="slds-button slds-button_neutral"
                                          style={{ padding: '2px 8px', fontSize: '11px', color: '#d32f2f' }}
                                        >
                                          🗑️ Delete
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Results Editor Pane - Dynamic Standings Entry */}
                  {selectedRaceId && selectedRace && (
                    <article className="slds-card slds-m-top_large" style={{ border: '2px solid #0176d3', borderRadius: '4px', background: '#f8fafc', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                      <div className="slds-card__header slds-grid slds-grid_align-spread" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f1f5f9', padding: '12px 16px', borderBottom: '1px solid #dddbda' }}>
                        <header className="slds-media slds-media_center slds-has-flexi-truncate">
                          <div className="slds-media__figure" style={{ marginRight: '0.5rem' }}>
                            <span className="slds-icon_container" style={{ fontSize: '18px' }}>🎯</span>
                          </div>
                          <div className="slds-media__body">
                            <h2 className="slds-card__header-title">
                              <span className="slds-card__header-link slds-truncate font-bold text-slate-800" style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                                Standings Grid: {selectedRace.name}
                              </span>
                            </h2>
                            <p className="slds-text-body_small text-slate-500" style={{ fontSize: '11px' }}>
                              Assign finishes for registered event participants. Ongoing: {isRaceOngoing(selectedRace) ? 'Yes' : 'No'}
                            </p>
                          </div>
                        </header>

                        <div>
                          <button
                            type="button"
                            onClick={() => void handleUnifiedSave()}
                            disabled={savingBatch || loadingResults || changeSummary.totalCount === 0}
                            className={`slds-button ${changeSummary.totalCount > 0 ? 'slds-button_brand' : 'slds-button_neutral'}`}
                            style={{ padding: '6px 16px', fontSize: '13px', fontWeight: 'bold' }}
                          >
                            {savingBatch ? 'Saving Standings...' : `💾 Save Standings (${changeSummary.totalCount} unsaved)`}
                          </button>
                        </div>
                      </div>

                      <div className="slds-card__body" style={{ padding: '16px' }}>
                        {/* Staged Changes Indicator Banner */}
                        {changeSummary.totalCount > 0 && (
                          <div className="slds-notify slds-notify_alert slds-theme_alert-texture slds-theme_warning slds-m-bottom_medium" role="alert" style={{ borderRadius: '4px', background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <span style={{ fontSize: '16px' }}>📝</span>
                              <span style={{ fontWeight: 'bold', fontSize: '12px' }}>
                                Unsaved Standings changes: {changeSummary.newCount > 0 && `${changeSummary.newCount} new, `}{changeSummary.modifiedCount > 0 && `${changeSummary.modifiedCount} modified, `}{changeSummary.deletedCount > 0 && `${changeSummary.deletedCount} pending deletion`}. Click "Save Standings" above to submit.
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setPendingDeletions(new Set())
                                // Reset edits to current saved state
                                const nextEdits: Record<string, { position: string; points: string }> = {}
                                for (const res of results) {
                                  nextEdits[res.userId] = {
                                    position: res.position !== null ? String(res.position) : '',
                                    points: String(res.points),
                                  }
                                }
                                setEditedResults(nextEdits)
                              }}
                              className="slds-button slds-button_neutral"
                              style={{ padding: '2px 8px', fontSize: '10px' }}
                            >
                              Reset All Changes
                            </button>
                          </div>
                        )}

                        {loadingResults ? (
                          <p className="slds-text-body_medium text-slate-500">Loading race results data...</p>
                        ) : selectedEvent.members.length === 0 ? (
                          <div className="slds-align_absolute-center slds-p-around_large text-slate-500">
                            No registered event participants found. Add participants under "Event Members" tab first.
                          </div>
                        ) : (
                          <div>
                            <table className="slds-table slds-table_cell-buffer slds-table_bordered" style={{ border: '1px solid #dddbda' }}>
                              <thead>
                                <tr className="slds-line-height_reset" style={{ background: '#f3f2f1' }}>
                                  <th scope="col" style={{ fontWeight: 'bold' }}><div className="slds-truncate">Competitor Name</div></th>
                                  <th scope="col" style={{ fontWeight: 'bold' }}><div className="slds-truncate">User ID</div></th>
                                  <th scope="col" style={{ fontWeight: 'bold', width: '130px' }}><div className="slds-truncate">Position</div></th>
                                  <th scope="col" style={{ fontWeight: 'bold', width: '130px' }}><div className="slds-truncate">Points</div></th>
                                  <th scope="col" style={{ fontWeight: 'bold' }}><div className="slds-truncate">Status</div></th>
                                  <th scope="col" style={{ fontWeight: 'bold', width: '160px' }}><div className="slds-truncate">Staged Actions</div></th>
                                </tr>
                              </thead>
                              <tbody>
                                {derivedStates.map(({ member, savedResult, edit, rowState }) => {
                                  const isDeleted = rowState === 'pending_delete'
                                  const isModified = rowState === 'modified'
                                  const isNew = rowState === 'new'

                                  return (
                                    <tr
                                      key={member.userId}
                                      className="slds-hint-parent"
                                      style={{
                                        background: isDeleted ? '#fee2e2' : isModified ? '#eff6ff' : isNew ? '#f0fdf4' : 'transparent',
                                        transition: 'background 0.2s',
                                        textDecoration: isDeleted ? 'line-through' : 'none',
                                        opacity: isDeleted ? 0.6 : 1,
                                      }}
                                    >
                                      <td>
                                        <span className="font-bold text-slate-800" style={{ fontWeight: 'bold' }}>{member.name}</span>
                                      </td>
                                      <td>
                                        <code className="text-xs">{member.userId}</code>
                                      </td>
                                      <td>
                                        <div className="slds-form-element">
                                          <div className="slds-form-element__control">
                                            <input
                                              type="number"
                                              placeholder="None"
                                              disabled={isDeleted}
                                              value={edit.position}
                                              onChange={(e) => handleResultChange(member.userId, 'position', e.target.value)}
                                              className="slds-input"
                                              style={{ padding: '4px 8px', border: '1px solid #dddbda', borderRadius: '4px' }}
                                            />
                                          </div>
                                        </div>
                                      </td>
                                      <td>
                                        <div className="slds-form-element">
                                          <div className="slds-form-element__control">
                                            <input
                                              type="number"
                                              placeholder="0"
                                              disabled={isDeleted}
                                              value={edit.points}
                                              onChange={(e) => handleResultChange(member.userId, 'points', e.target.value)}
                                              className="slds-input"
                                              style={{ padding: '4px 8px', border: '1px solid #dddbda', borderRadius: '4px' }}
                                            />
                                          </div>
                                        </div>
                                      </td>
                                      <td>
                                        {isDeleted ? (
                                          <span className="slds-badge slds-theme_error" style={{ padding: '2px 8px', background: '#dc2626', color: '#fff', borderRadius: '4px' }}>
                                            Pending Deletion
                                          </span>
                                        ) : isModified ? (
                                          <span className="slds-badge slds-theme_warning" style={{ padding: '2px 8px', background: '#2563eb', color: '#fff', borderRadius: '4px' }}>
                                            Modified (Unsaved)
                                          </span>
                                        ) : isNew ? (
                                          <span className="slds-badge slds-theme_success" style={{ padding: '2px 8px', background: '#16a34a', color: '#fff', borderRadius: '4px' }}>
                                            New (Unsaved)
                                          </span>
                                        ) : savedResult ? (
                                          <span className="slds-badge slds-theme_success" style={{ padding: '2px 8px', background: '#2e7d32', color: '#fff', borderRadius: '4px' }}>
                                            Saved (Pos: {savedResult.position ?? 'n/a'}, Pts: {savedResult.points})
                                          </span>
                                        ) : (
                                          <span className="slds-badge slds-theme_light" style={{ padding: '2px 8px', background: '#e0e0e0', color: '#555', borderRadius: '4px' }}>
                                            No result recorded
                                          </span>
                                        )}
                                      </td>
                                      <td>
                                        <div className="slds-grid" style={{ display: 'flex', gap: '6px' }}>
                                          {isDeleted ? (
                                            <button
                                              type="button"
                                              onClick={() => togglePendingDeletion(member.userId)}
                                              className="slds-button slds-button_neutral"
                                              style={{ padding: '2px 8px', fontSize: '11px', flexGrow: 1 }}
                                            >
                                              ↩️ Undo Delete
                                            </button>
                                          ) : isModified || isNew ? (
                                            <>
                                              <button
                                                type="button"
                                                onClick={() => handleUndoRow(member.userId)}
                                                className="slds-button slds-button_neutral"
                                                style={{ padding: '2px 8px', fontSize: '11px', flexGrow: 1 }}
                                              >
                                                ↩️ Reset Row
                                              </button>
                                              {savedResult && (
                                                <button
                                                  type="button"
                                                  onClick={() => togglePendingDeletion(member.userId)}
                                                  className="slds-button slds-button_destructive"
                                                  style={{ padding: '2px 8px', fontSize: '11px', background: '#dc2626', color: '#fff' }}
                                                >
                                                  🗑️ Remove
                                                </button>
                                              )}
                                            </>
                                          ) : savedResult ? (
                                            <button
                                              type="button"
                                              onClick={() => togglePendingDeletion(member.userId)}
                                              className="slds-button slds-button_destructive"
                                              style={{ padding: '2px 8px', fontSize: '11px', background: '#dc2626', color: '#fff', flexGrow: 1 }}
                                            >
                                              🗑️ Remove
                                            </button>
                                          ) : (
                                            <span style={{ fontSize: '11px', color: '#888', fontStyle: 'italic', padding: '2px 8px' }}>
                                              No changes
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>

                            <div className="slds-m-top_medium slds-box" style={{ background: '#f8fafc', border: '1px solid #dddbda', borderRadius: '4px', padding: '12px' }}>
                              <h4 className="font-bold text-slate-800" style={{ fontWeight: 'bold' }}>💡 Explanation of Standings update actions</h4>
                              <ul style={{ paddingLeft: '1.25rem', marginTop: '4px' }}>
                                <li className="text-slate-600" style={{ fontSize: '12px' }}><strong>Staging Changes</strong> - Edits to the standings are compiled locally. Highlighting shows which rows have modified values or are pending deletion.</li>
                                <li className="text-slate-600" style={{ fontSize: '12px' }}><strong>Smart Save Standings</strong> - The system analyzes your edits and executes the safest, most performant update automatically:
                                  <ul style={{ paddingLeft: '1.25rem', marginTop: '2px', listStyleType: 'circle' }}>
                                    <li style={{ fontSize: '11px' }}>Exactly 1 change: Updates single row in-place.</li>
                                    <li style={{ fontSize: '11px' }}>Exactly 1 delete: Removes single result in-place.</li>
                                    <li style={{ fontSize: '11px' }}>Multiple changes w/o deletions: Blends/merges the bulk updates safely.</li>
                                    <li style={{ fontSize: '11px' }}>Multiple changes containing deletions: Replaces standings to reconcile deleted results.</li>
                                  </ul>
                                </li>
                              </ul>
                            </div>
                          </div>
                        )}
                      </div>
                    </article>
                  )}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="slds-box slds-align_absolute-center bg-white" style={{ background: '#ffffff', borderRadius: '4px', border: '1px solid #dddbda', minHeight: '400px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <div className="slds-text-align_center">
                <span style={{ fontSize: '48px' }}>🏁</span>
                <p className="slds-text-heading_medium font-bold text-slate-700 slds-m-top_medium" style={{ fontWeight: 'bold' }}>
                  No Event Selected
                </p>
                <p className="slds-text-body_regular text-slate-500 slds-m-top_xx-small">
                  Select an event from the list on the left to manage races, members, and results.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
