import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from './useAuth'
import {
  getAdminEvent,
  updateAdminEventStatus,
  updateAdminEvent,
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
  addRaceEventMember,
  removeRaceEventMember,
  setEventSignupsLocked,
  recomputeEventPoints,
} from '../lib/admin-api'
import type { eventmanager } from '../lib/client'
import {
  deriveRows,
  editsFromResults,
  EMPTY_EDIT,
  inferFinishTimes,
  summarizeChanges,
  type ChangeSummary,
  type DerivedRow,
  type EditedResult,
} from '../lib/standings'
import {
  isRaceOngoing,
  isRaceConcluded,
  isRaceNotStarted,
} from '../lib/raceStatus'

const STATUS_OPTIONS: eventmanager.EventStatus[] = ['DRAFT', 'UNOFFICIAL', 'OFFICIAL', 'CONCLUDED']
const CLASS_TIER_OPTIONS = ['PRE_OP', 'OP', 'G3', 'G2', 'G1']

export type ActiveTab = 'details' | 'members' | 'races' | 'datasets'

export interface NewRaceForm {
  name: string
  sequence: number
  distanceMeters: number
  trackType: string
  location: string
  classRestriction: eventmanager.ClassTier
  grade?: string
}

export function useEventDetail(eventId: string) {
  const { session } = useAuth()
  const [selectedEvent, setSelectedEvent] = useState<eventmanager.EventDetail | null>(null)
  const [activeTab, setActiveTab] = useState<ActiveTab>('details')

  // Race Management States
  const [races, setRaces] = useState<eventmanager.RaceEventDetail[]>([])
  const [selectedRaceId, setSelectedRaceId] = useState<string | null>(null)
  const [selectedRace, setSelectedRace] = useState<eventmanager.RaceEventDetail | null>(null)

  // Results Editor States
  const [results, setResults] = useState<eventmanager.RaceResultView[]>([])
  const [editedResults, setEditedResults] = useState<Record<string, EditedResult>>({})
  const [pendingDeletions, setPendingDeletions] = useState<Set<string>>(new Set())

  // Form States
  const [newMemberUserId, setNewMemberUserId] = useState('')
  const [newRaceMemberUserId, setNewRaceMemberUserId] = useState('')
  const [newRaceForm, setNewRaceForm] = useState<NewRaceForm>({
    name: '',
    sequence: 1,
    distanceMeters: 1200,
    trackType: 'Turf',
    location: '',
    classRestriction: 'OP',
    grade: 'OP',
  })

  // Global UI States
  const [loadingEventDetail, setLoadingEventDetail] = useState(true)
  const [loadingRaces, setLoadingRaces] = useState(false)
  const [loadingResults, setLoadingResults] = useState(false)
  const [savingBatch, setSavingBatch] = useState(false)
  const [eventStatusSaving, setEventStatusSaving] = useState(false)
  const [signupsLockedSaving, setSignupsLockedSaving] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [globalSuccess, setGlobalSuccess] = useState<string | null>(null)

  const authHeader = useMemo(() => {
    const token = session?.session.token
    return token ? `Bearer ${token}` : null
  }, [session?.session.token])

  // Load selected event details
  const loadEvent = useCallback(async () => {
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
  }, [eventId])

  useEffect(() => {
    void loadEvent()
  }, [loadEvent])

  // Reload current event details
  const reloadCurrentEvent = useCallback(async () => {
    try {
      const detail = await getAdminEvent(eventId)
      setSelectedEvent(detail)
      setRaces(detail.raceEvents as eventmanager.RaceEventDetail[])
    } catch (err) {
      console.error('Failed to reload current event details', err)
    }
  }, [eventId])

  // Update parent event lifecycle status
  const handleUpdateEventStatus = useCallback(
    async (status: eventmanager.EventStatus) => {
      if (!authHeader) {
        setGlobalError('Authentication token is required.')
        return
      }
      setEventStatusSaving(true)
      setGlobalError(null)
      setGlobalSuccess(null)
      try {
        const updated = await updateAdminEventStatus(eventId, status, authHeader)
        setSelectedEvent(updated)
        setGlobalSuccess(`Successfully updated event status to ${status}.`)
      } catch (cause) {
        setGlobalError(cause instanceof Error ? cause.message : 'Unable to update status')
      } finally {
        setEventStatusSaving(false)
      }
    },
    [authHeader, eventId],
  )

  const handleSetSignupsLocked = useCallback(
    async (locked: boolean) => {
      if (!authHeader) {
        setGlobalError('Authentication token is required.')
        return
      }
      setSignupsLockedSaving(true)
      setGlobalError(null)
      setGlobalSuccess(null)
      try {
        const updated = await setEventSignupsLocked(eventId, locked, authHeader)
        setSelectedEvent(updated)
        setGlobalSuccess(`Successfully ${locked ? 'locked' : 'unlocked'} event signups.`)
      } catch (cause) {
        setGlobalError(cause instanceof Error ? cause.message : 'Unable to update signups lock state')
      } finally {
        setSignupsLockedSaving(false)
      }
    },
    [authHeader, eventId],
  )

  const handleUpdateEventDetails = useCallback(
    async (params: {
      name: string
      description: string | null
      classRestriction: eventmanager.ClassTier | null
      granularParticipation: boolean
      scoringRulesMode?: string | null
      customScoringTables?: any | null
    }) => {
      if (!authHeader) return
      setGlobalError(null)
      setGlobalSuccess(null)
      try {
        const updated = await updateAdminEvent(eventId, params, authHeader)
        setSelectedEvent(updated)
        setGlobalSuccess('Successfully updated event details.')
      } catch (cause) {
        setGlobalError(cause instanceof Error ? cause.message : 'Unable to update event details')
      }
    },
    [authHeader, eventId],
  )

  const handleRecomputeEventPoints = useCallback(async () => {
    if (!authHeader) return
    setGlobalError(null)
    setGlobalSuccess(null)
    try {
      await recomputeEventPoints(eventId, authHeader)
      await reloadCurrentEvent()
      setGlobalSuccess('Successfully recomputed all results points.')
    } catch (cause) {
      setGlobalError(cause instanceof Error ? cause.message : 'Unable to recompute event points')
    }
  }, [authHeader, eventId, reloadCurrentEvent])

  // Add Member
  const handleAddMember = useCallback(
    async (evt: React.FormEvent) => {
      evt.preventDefault()
      if (!newMemberUserId.trim() || !authHeader) {
        return
      }
      setGlobalError(null)
      setGlobalSuccess(null)
      try {
        const updated = await addEventMember(eventId, newMemberUserId.trim(), authHeader)
        setSelectedEvent(updated)
        setNewMemberUserId('')
        setGlobalSuccess(`Successfully registered member "${newMemberUserId}" to the event.`)
      } catch (cause) {
        setGlobalError(cause instanceof Error ? cause.message : 'Unable to register event member')
      }
    },
    [authHeader, eventId, newMemberUserId],
  )

  // Remove Member
  const handleRemoveMember = useCallback(
    async (userId: string) => {
      if (!authHeader) return
      if (!confirm('Are you sure you want to remove this participant from the event?')) return
      setGlobalError(null)
      setGlobalSuccess(null)
      try {
        const updated = await removeEventMember(eventId, userId, authHeader)
        setSelectedEvent(updated)
        setGlobalSuccess('Successfully removed participant from the event.')
      } catch (cause) {
        setGlobalError(cause instanceof Error ? cause.message : 'Unable to remove member')
      }
    },
    [authHeader, eventId],
  )

  // Add Race Member
  const handleAddRaceMember = useCallback(
    async (raceId: string, userId: string) => {
      if (!userId.trim() || !authHeader) return
      setGlobalError(null)
      setGlobalSuccess(null)
      try {
        const updatedRace = await addRaceEventMember(eventId, raceId, userId.trim(), authHeader)
        setRaces((current) => current.map((r) => (r.id === raceId ? updatedRace : r)))
        if (selectedRaceId === raceId) {
          setSelectedRace(updatedRace)
        }
        setNewRaceMemberUserId('')
        setGlobalSuccess(`Successfully registered competitor "${userId}" for the race.`)
      } catch (cause) {
        setGlobalError(cause instanceof Error ? cause.message : 'Unable to register race member')
      }
    },
    [authHeader, eventId, selectedRaceId],
  )

  // Remove Race Member
  const handleRemoveRaceMember = useCallback(
    async (raceId: string, userId: string) => {
      if (!authHeader) return
      if (!confirm('Are you sure you want to unregister this competitor from this race?')) return
      setGlobalError(null)
      setGlobalSuccess(null)
      try {
        const updatedRace = await removeRaceEventMember(eventId, raceId, userId, authHeader)
        setRaces((current) => current.map((r) => (r.id === raceId ? updatedRace : r)))
        if (selectedRaceId === raceId) {
          setSelectedRace(updatedRace)
        }
        setGlobalSuccess('Successfully unregistered competitor from the race.')
      } catch (cause) {
        setGlobalError(cause instanceof Error ? cause.message : 'Unable to unregister race member')
      }
    },
    [authHeader, eventId, selectedRaceId],
  )

  // Create Race Event
  const handleCreateRace = useCallback(
    async (evt: React.FormEvent) => {
      evt.preventDefault()
      if (!newRaceForm.name || !authHeader) return
      setGlobalError(null)
      setGlobalSuccess(null)
      try {
        await createRaceEvent(eventId, newRaceForm, authHeader)
        await reloadCurrentEvent()
        setNewRaceForm({
          name: '',
          sequence: races.length + 1,
          distanceMeters: 1200,
          trackType: 'Turf',
          location: '',
          classRestriction: 'OP',
          grade: 'OP',
        })
        setGlobalSuccess(`Successfully created race event "${newRaceForm.name}".`)
      } catch (cause) {
        setGlobalError(cause instanceof Error ? cause.message : 'Unable to create race event')
      }
    },
    [authHeader, eventId, newRaceForm, races.length, reloadCurrentEvent],
  )

  // Select Race to load results
  const handleSelectRace = useCallback(
    async (race: eventmanager.RaceEventDetail, switchTab = true) => {
      setSelectedRaceId(race.id)
      setSelectedRace(race)
      setLoadingResults(true)
      setGlobalError(null)
      setGlobalSuccess(null)
      setEditedResults({})
      setPendingDeletions(new Set())
      if (switchTab) {
        setActiveTab('races')
      }
      try {
        const response = await listRaceResults(eventId, race.id)
        setResults(response.results)
        setEditedResults(editsFromResults(response.results))
      } catch (cause) {
        setGlobalError(cause instanceof Error ? cause.message : 'Unable to load race results')
        setResults([])
      } finally {
        setLoadingResults(false)
      }
    },
    [eventId],
  )

  // Start Race (Manual startsAt)
  const handleStartRace = useCallback(
    async (raceId: string) => {
      if (!authHeader) return
      setGlobalError(null)
      setGlobalSuccess(null)
      try {
        const nowString = new Date().toISOString()
        const updated = await updateRaceEvent(eventId, raceId, { startsAt: nowString }, authHeader)
        setRaces((current) => current.map((r) => (r.id === raceId ? updated : r)))
        if (selectedRaceId === raceId) {
          setSelectedRace(updated)
        }
        setGlobalSuccess(`Race manually started at ${new Date(nowString).toLocaleTimeString()}.`)
      } catch (cause) {
        setGlobalError(cause instanceof Error ? cause.message : 'Unable to start race')
      }
    },
    [authHeader, eventId, selectedRaceId],
  )

  // End Race (Manual endsAt)
  const handleEndRace = useCallback(
    async (raceId: string) => {
      if (!authHeader) return
      setGlobalError(null)
      setGlobalSuccess(null)
      try {
        const nowString = new Date().toISOString()
        const updated = await updateRaceEvent(eventId, raceId, { endsAt: nowString }, authHeader)
        setRaces((current) => current.map((r) => (r.id === raceId ? updated : r)))

        // Auto-select the race and guide the user to the Post Results tab (now inside races)
        await handleSelectRace(updated, true)

        setGlobalSuccess(`Race manually ended at ${new Date(nowString).toLocaleTimeString()}. Guided to results entry.`)
      } catch (cause) {
        setGlobalError(cause instanceof Error ? cause.message : 'Unable to end race')
      }
    },
    [authHeader, eventId, handleSelectRace],
  )

  // Update Race Details (such as classRestriction, grade)
  const handleUpdateRace = useCallback(
    async (raceId: string, params: { classRestriction?: eventmanager.ClassTier | null, grade?: string | null }) => {
      if (!authHeader) return
      setGlobalError(null)
      setGlobalSuccess(null)
      try {
        const updated = await updateRaceEvent(eventId, raceId, params, authHeader)
        setRaces((current) => current.map((r) => (r.id === raceId ? updated : r)))
        if (selectedRaceId === raceId) {
          setSelectedRace(updated)
        }
        setGlobalSuccess('Race updated successfully.')
      } catch (cause) {
        setGlobalError(cause instanceof Error ? cause.message : 'Unable to update race details')
      }
    },
    [authHeader, eventId, selectedRaceId],
  )

  // Delete Race
  const handleDeleteRace = useCallback(
    async (raceId: string) => {
      if (!authHeader) return
      if (!confirm('Are you sure you want to delete this race event? All registered results for this race will be deleted.')) return
      setGlobalError(null)
      setGlobalSuccess(null)
      try {
        await deleteRaceEvent(eventId, raceId, authHeader)
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
    },
    [authHeader, eventId, reloadCurrentEvent, selectedRaceId],
  )

  // Handle single result input change
  const handleResultChange = useCallback(
    (userId: string, field: keyof EditedResult, value: string) => {
      setEditedResults((current) => ({
        ...current,
        [userId]: {
          ...(current[userId] ?? EMPTY_EDIT),
          [field]: value,
        },
      }))
    },
    [],
  )

  // Mark row as pending deletion or reset its inputs
  const togglePendingDeletion = useCallback((userId: string) => {
    setPendingDeletions((current) => {
      const next = new Set(current)
      if (next.has(userId)) {
        next.delete(userId)
      } else {
        next.add(userId)
      }
      return next
    })
  }, [])

  // Undo changes to a single row
  const handleUndoRow = useCallback(
    (userId: string) => {
      const saved = results.find((r) => r.userId === userId)
      setEditedResults((current) => ({
        ...current,
        [userId]: {
          position: saved && saved.position !== null ? String(saved.position) : '',
          points: saved ? String(saved.points) : '0',
          gateNumber: saved && saved.gateNumber !== null ? String(saved.gateNumber) : '',
          finishTime: saved?.finishTime ?? '',
          margin: saved?.margin ?? '',
          passingOrder: saved?.passingOrder ?? '',
          final3F: saved?.final3F ?? '',
        },
      }))
      setPendingDeletions((current) => {
        const next = new Set(current)
        next.delete(userId)
        return next
      })
    },
    [results],
  )

  const derivedStates: DerivedRow[] = useMemo(() => {
    if (!selectedEvent) return []
    const membersToUse = (selectedEvent.granularParticipation && selectedRace) ? (selectedRace.members ?? []) : selectedEvent.members
    return deriveRows(membersToUse, results, editedResults, pendingDeletions)
  }, [selectedEvent, selectedRace, results, editedResults, pendingDeletions])

  const ongoingRaces = useMemo(() => races.filter(isRaceOngoing), [races])
  const concludedRaces = useMemo(() => races.filter(isRaceConcluded), [races])
  const notStartedRaces = useMemo(() => races.filter(isRaceNotStarted), [races])

  const changeSummary: ChangeSummary = useMemo(() => summarizeChanges(derivedStates), [derivedStates])

  function resetStandingsDraft() {
    setPendingDeletions(new Set())
    setEditedResults(editsFromResults(results))
  }

  const handleInferFinishTimes = useCallback(() => {
    const result = inferFinishTimes(derivedStates, editedResults)
    if ('error' in result) {
      setGlobalError(result.error)
      return
    }
    setEditedResults(result.edits)
    setGlobalSuccess(`Inferred finish times for ${result.inferredCount} horse(s) from the leader's time and margins.`)
  }, [derivedStates, editedResults])

  const handleCancelStandingsEdit = useCallback(() => {
    resetStandingsDraft()
    setSelectedRaceId(null)
    setSelectedRace(null)
    setGlobalError(null)
    setGlobalSuccess(null)
  }, [])

  // Unified Save Standings action (smart endpoint selection)
  const handleUnifiedSave = useCallback(async () => {
    if (!selectedRaceId || !authHeader) return
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

      const activeStagedChanges = derivedStates
        .filter((d) => d.rowState === 'new' || d.rowState === 'modified')
        .map((d) => ({
          userId: d.member.userId,
          position: d.edit.position.trim() !== '' ? Number(d.edit.position) : null,
          points: Number(d.edit.points) || 0,
          gateNumber: d.edit.gateNumber.trim() !== '' ? Number(d.edit.gateNumber) : null,
          finishTime: d.edit.finishTime.trim() !== '' ? d.edit.finishTime.trim() : null,
          margin: d.edit.margin.trim() !== '' ? d.edit.margin.trim() : null,
          passingOrder: d.edit.passingOrder.trim() !== '' ? d.edit.passingOrder.trim() : null,
          final3F: d.edit.final3F.trim() !== '' ? d.edit.final3F.trim() : null,
        }))

      let nextResults = [...results]

      if (totalCount === 1) {
        if (deletedCount === 1) {
          const deletedUserId = Array.from(pendingDeletions)[0]
          await deleteRaceResult(eventId, selectedRaceId, deletedUserId, authHeader)
          nextResults = results.filter((r) => r.userId !== deletedUserId)
          setResults(nextResults)
          setPendingDeletions(new Set())
          await reloadCurrentEvent()
          setGlobalSuccess('Successfully deleted participant result.')
        } else {
          const change = activeStagedChanges[0]
          const updated = await assignRaceResult(
            eventId,
            selectedRaceId,
            change.userId,
            {
              position: change.position,
              points: change.points,
              gateNumber: change.gateNumber,
              finishTime: change.finishTime,
              margin: change.margin,
              passingOrder: change.passingOrder,
              final3F: change.final3F,
            },
            authHeader,
          )
          const exists = results.some((r) => r.userId === change.userId)
          nextResults = exists
            ? results.map((r) => (r.userId === change.userId ? updated : r))
            : [...results, updated]
          setResults(nextResults)
          await reloadCurrentEvent()
          setGlobalSuccess('Successfully updated result in-place.')
        }
      } else if (deletedCount > 0) {
        const fullReplacePayload = derivedStates
          .filter((d) => d.rowState === 'unchanged' && d.savedResult)
          .map((d) => ({
            userId: d.member.userId,
            position: d.savedResult!.position,
            points: d.savedResult!.points,
            gateNumber: d.savedResult!.gateNumber,
            finishTime: d.savedResult!.finishTime,
            margin: d.savedResult!.margin,
            passingOrder: d.savedResult!.passingOrder,
            final3F: d.savedResult!.final3F,
          }))
          .concat(
            derivedStates
              .filter((d) => d.rowState === 'new' || d.rowState === 'modified')
              .map((d) => ({
                userId: d.member.userId,
                position: d.edit.position.trim() !== '' ? Number(d.edit.position) : null,
                points: d.edit.points.trim() !== '' ? Number(d.edit.points) : 0,
                gateNumber: d.edit.gateNumber.trim() !== '' ? Number(d.edit.gateNumber) : null,
                finishTime: d.edit.finishTime.trim() !== '' ? d.edit.finishTime.trim() : null,
                margin: d.edit.margin.trim() !== '' ? d.edit.margin.trim() : null,
                passingOrder: d.edit.passingOrder.trim() !== '' ? d.edit.passingOrder.trim() : null,
                final3F: d.edit.final3F.trim() !== '' ? d.edit.final3F.trim() : null,
              })),
          )

        const response = await replaceRaceResults(eventId, selectedRaceId, fullReplacePayload, authHeader)
        nextResults = response.results
        setResults(nextResults)
        setPendingDeletions(new Set())
        await reloadCurrentEvent()
        setGlobalSuccess('Successfully updated standings (Full Replace applied to reconcile deletions).')
      } else {
        const response = await mergeRaceResults(eventId, selectedRaceId, activeStagedChanges, authHeader)
        nextResults = response.results
        setResults(nextResults)
        await reloadCurrentEvent()
        setGlobalSuccess('Successfully merged and updated standings.')
      }

      setEditedResults(editsFromResults(nextResults))
    } catch (cause) {
      setGlobalError(cause instanceof Error ? cause.message : 'Unable to save standings changes')
    } finally {
      setSavingBatch(false)
    }
  }, [
    authHeader,
    changeSummary,
    derivedStates,
    eventId,
    pendingDeletions,
    reloadCurrentEvent,
    results,
    selectedRaceId,
  ])

  return {
    // constants
    STATUS_OPTIONS,
    CLASS_TIER_OPTIONS,
    // state
    selectedEvent,
    activeTab,
    setActiveTab,
    races,
    selectedRaceId,
    setSelectedRaceId,
    setSelectedRace,
    selectedRace,
    results,
    editedResults,
    pendingDeletions,
    newMemberUserId,
    setNewMemberUserId,
    newRaceMemberUserId,
    setNewRaceMemberUserId,
    newRaceForm,
    setNewRaceForm,
    loadingEventDetail,
    loadingRaces,
    loadingResults,
    savingBatch,
    eventStatusSaving,
    signupsLockedSaving,
    globalError,
    globalSuccess,
    derivedStates,
    changeSummary,
    ongoingRaces,
    concludedRaces,
    notStartedRaces,
    // actions
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
  }
}
