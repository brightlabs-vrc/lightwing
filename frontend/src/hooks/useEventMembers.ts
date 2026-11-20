import { useCallback, useState } from 'react'
import {
  addEventMember,
  removeEventMember,
  addRaceEventMember,
  removeRaceEventMember,
  upsertEventTeamRoster,
  substituteEventTeamMember,
  removeEventTeam,
} from '../lib/admin-api'
import type { eventmanager } from '../lib/client'

interface UseEventMembersProps {
  eventId: string;
  authHeader: string | null;
  setSelectedEvent: (evt: eventmanager.EventDetail | null) => void;
  setRaces: React.Dispatch<React.SetStateAction<eventmanager.RaceEventDetail[]>>;
  setGlobalError: (err: string | null) => void;
  setGlobalSuccess: (success: string | null) => void;
  reloadCurrentEvent?: () => Promise<void>;
}

export function useEventMembers({
  eventId,
  authHeader,
  setSelectedEvent,
  setRaces,
  setGlobalError,
  setGlobalSuccess,
  reloadCurrentEvent,
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
        if (reloadCurrentEvent) {
          await reloadCurrentEvent()
        }
      } catch (cause) {
        setGlobalError(cause instanceof Error ? cause.message : 'Unable to register race member')
      }
    },
    [authHeader, eventId, setRaces, setGlobalError, setGlobalSuccess, reloadCurrentEvent],
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
        if (reloadCurrentEvent) {
          await reloadCurrentEvent()
        }
      } catch (cause) {
        setGlobalError(cause instanceof Error ? cause.message : 'Unable to unregister race member')
      }
    },
    [authHeader, eventId, setRaces, setGlobalError, setGlobalSuccess, reloadCurrentEvent],
  )

  // Upsert Event Team Roster (Primary + Backup)
  const handleUpsertEventTeamRoster = useCallback(
    async (teamId: string, primaryUserIds: string[], backupUserIds: string[]) => {
      if (!teamId || !authHeader) return false
      setGlobalError(null)
      setGlobalSuccess(null)
      try {
        const updated = await upsertEventTeamRoster(eventId, teamId, primaryUserIds, backupUserIds, authHeader)
        setSelectedEvent(updated)
        setRaces(updated.raceEvents as unknown as eventmanager.RaceEventDetail[])
        setGlobalSuccess('Successfully saved team roster.')
        return true
      } catch (cause) {
        setGlobalError(cause instanceof Error ? cause.message : 'Unable to save team roster')
        return false
      }
    },
    [authHeader, eventId, setSelectedEvent, setRaces, setGlobalError, setGlobalSuccess],
  )

  // 1-Click Substitute / Promote Backup to Primary
  const handleSubstituteTeamMember = useCallback(
    async (
      teamId: string,
      incomingUserId: string,
      outgoingUserId?: string | null,
      replaceInUpcomingRaces = true,
    ) => {
      if (!teamId || !incomingUserId || !authHeader) return false
      setGlobalError(null)
      setGlobalSuccess(null)
      try {
        const updated = await substituteEventTeamMember(
          eventId,
          teamId,
          incomingUserId,
          outgoingUserId,
          replaceInUpcomingRaces,
          authHeader,
        )
        setSelectedEvent(updated)
        setRaces(updated.raceEvents as unknown as eventmanager.RaceEventDetail[])
        setGlobalSuccess(
          outgoingUserId
            ? 'Successfully swapped backup member into the primary roster.'
            : 'Successfully promoted backup member to the primary roster.',
        )
        return true
      } catch (cause) {
        setGlobalError(cause instanceof Error ? cause.message : 'Unable to substitute team member')
        return false
      }
    },
    [authHeader, eventId, setSelectedEvent, setRaces, setGlobalError, setGlobalSuccess],
  )

  // Remove Team from Event
  const handleRemoveEventTeam = useCallback(
    async (teamId: string) => {
      if (!authHeader) return
      if (!confirm('Are you sure you want to remove this team and all its roster members from the event?')) return
      setGlobalError(null)
      setGlobalSuccess(null)
      try {
        const updated = await removeEventTeam(eventId, teamId, authHeader)
        setSelectedEvent(updated)
        setRaces(updated.raceEvents as unknown as eventmanager.RaceEventDetail[])
        setGlobalSuccess('Successfully removed team from the event.')
      } catch (cause) {
        setGlobalError(cause instanceof Error ? cause.message : 'Unable to remove team from event')
      }
    },
    [authHeader, eventId, setSelectedEvent, setRaces, setGlobalError, setGlobalSuccess],
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
    handleUpsertEventTeamRoster,
    handleSubstituteTeamMember,
    handleRemoveEventTeam,
  }
}
