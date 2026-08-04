import { useCallback, useState } from 'react'
import {
  addEventMember,
  removeEventMember,
  addRaceEventMember,
  removeRaceEventMember,
} from '../lib/admin-api'
import type { eventmanager } from '../lib/client'

interface UseEventMembersProps {
  eventId: string;
  authHeader: string | null;
  setSelectedEvent: (evt: eventmanager.EventDetail | null) => void;
  setRaces: React.Dispatch<React.SetStateAction<eventmanager.RaceEventDetail[]>>;
  setGlobalError: (err: string | null) => void;
  setGlobalSuccess: (success: string | null) => void;
}

export function useEventMembers({
  eventId,
  authHeader,
  setSelectedEvent,
  setRaces,
  setGlobalError,
  setGlobalSuccess,
}: UseEventMembersProps) {
  const [newMemberUserId, setNewMemberUserId] = useState('')
  const [newRaceMemberUserId, setNewRaceMemberUserId] = useState('')

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
    [authHeader, eventId, newMemberUserId, setSelectedEvent, setGlobalError, setGlobalSuccess],
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
    [authHeader, eventId, setSelectedEvent, setGlobalError, setGlobalSuccess],
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
        setNewRaceMemberUserId('')
        setGlobalSuccess(`Successfully registered competitor "${userId}" for the race.`)
      } catch (cause) {
        setGlobalError(cause instanceof Error ? cause.message : 'Unable to register race member')
      }
    },
    [authHeader, eventId, setRaces, setGlobalError, setGlobalSuccess],
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
        setGlobalSuccess('Successfully unregistered competitor from the race.')
      } catch (cause) {
        setGlobalError(cause instanceof Error ? cause.message : 'Unable to unregister race member')
      }
    },
    [authHeader, eventId, setRaces, setGlobalError, setGlobalSuccess],
  )

  return {
    newMemberUserId,
    setNewMemberUserId,
    newRaceMemberUserId,
    setNewRaceMemberUserId,
    handleAddMember,
    handleRemoveMember,
    handleAddRaceMember,
    handleRemoveRaceMember,
  }
}
