import { useCallback, useState } from 'react'
import {
  createRaceEvent,
  updateRaceEvent,
  deleteRaceEvent,
  reorderRaceEvents,
} from '../lib/admin-api'
import type { eventmanager } from '../lib/client'
import type { ClassTier } from '../types'

export interface NewRaceForm {
  name: string
  distanceMeters: number
  trackType: string
  location: string
  classRestriction: ClassTier | null
  grade?: string
  participantLimit?: number | null
}

interface UseEventRacesProps {
  eventId: string;
  authHeader: string | null;
  reloadCurrentEvent: () => Promise<void>;
  setGlobalError: (err: string | null) => void;
  setGlobalSuccess: (success: string | null) => void;
  selectedRaceId: string | null;
  setSelectedRaceId: (id: string | null) => void;
  setResults: (res: eventmanager.RaceResultView[]) => void;
  setEditedResults: (edits: any) => void;
  setPendingDeletions: (deletions: Set<string>) => void;
  handleSelectRace: (race: eventmanager.RaceEventDetail, switchTab?: boolean) => Promise<void>;
  races: eventmanager.RaceEventDetail[];
  setRaces: React.Dispatch<React.SetStateAction<eventmanager.RaceEventDetail[]>>;
}

export function useEventRaces({
  eventId,
  authHeader,
  reloadCurrentEvent,
  setGlobalError,
  setGlobalSuccess,
  selectedRaceId,
  setSelectedRaceId,
  setResults,
  setEditedResults,
  setPendingDeletions,
  handleSelectRace,
  races,
  setRaces,
}: UseEventRacesProps) {
  const [newRaceForm, setNewRaceForm] = useState<NewRaceForm>({
    name: '',
    distanceMeters: 1200,
    trackType: 'Turf',
    location: '',
    classRestriction: null,
    grade: 'OP',
  })

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
          distanceMeters: 1200,
          trackType: 'Turf',
          location: '',
          classRestriction: null,
          grade: 'OP',
        })
        setGlobalSuccess(`Successfully created race event "${newRaceForm.name}".`)
      } catch (cause) {
        setGlobalError(cause instanceof Error ? cause.message : 'Unable to create race event')
      }
    },
    [authHeader, eventId, newRaceForm, reloadCurrentEvent, setGlobalError, setGlobalSuccess],
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
        setGlobalSuccess(`Race manually started at ${new Date(nowString).toLocaleTimeString()}.`)
      } catch (cause) {
        setGlobalError(cause instanceof Error ? cause.message : 'Unable to start race')
      }
    },
    [authHeader, eventId, setGlobalError, setGlobalSuccess],
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
    [authHeader, eventId, handleSelectRace, setGlobalError, setGlobalSuccess],
  )

  // Update Race Details (such as name, distance, trackType, location, classRestriction, grade)
  const handleUpdateRace = useCallback(
    async (
      raceId: string,
      params: {
        name?: string
        distanceMeters?: number
        trackType?: string
        location?: string
        classRestriction?: ClassTier | null
        grade?: string | null
        participantLimit?: number | null
      }
    ) => {
      if (!authHeader) return
      setGlobalError(null)
      setGlobalSuccess(null)
      try {
        const updated = await updateRaceEvent(eventId, raceId, params, authHeader)
        setRaces((current) => current.map((r) => (r.id === raceId ? updated : r)))
        setGlobalSuccess('Race updated successfully.')
      } catch (cause) {
        setGlobalError(cause instanceof Error ? cause.message : 'Unable to update race details')
      }
    },
    [authHeader, eventId, setGlobalError, setGlobalSuccess],
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
    [authHeader, eventId, reloadCurrentEvent, selectedRaceId, setSelectedRaceId, setResults, setEditedResults, setPendingDeletions, setGlobalError, setGlobalSuccess],
  )

  const handleReorderRaces = useCallback(
    async (orderedRaceIds: string[]) => {
      if (!authHeader) return
      setGlobalError(null)
      setGlobalSuccess(null)
      const originalRaces = [...races]
      try {
        const nextRaces = orderedRaceIds
          .map((id) => races.find((r) => r.id === id))
          .filter(Boolean) as eventmanager.RaceEventDetail[]
        const optimisticRaces = nextRaces.map((r, index) => ({
          ...r,
          sequence: index + 1,
        }))
        setRaces(optimisticRaces)
        const response = await reorderRaceEvents(eventId, orderedRaceIds, authHeader)
        setRaces(response.races)
        setGlobalSuccess('Race order updated successfully.')
      } catch (cause) {
        setGlobalError(cause instanceof Error ? cause.message : 'Unable to reorder race events')
        setRaces(originalRaces)
      }
    },
    [authHeader, eventId, races, setGlobalError, setGlobalSuccess],
  )

  return {
    races,
    setRaces,
    newRaceForm,
    setNewRaceForm,
    handleCreateRace,
    handleStartRace,
    handleEndRace,
    handleUpdateRace,
    handleDeleteRace,
    handleReorderRaces,
  }
}
