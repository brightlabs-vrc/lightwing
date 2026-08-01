import { useCallback, useState } from 'react'
import {
  updateAdminEventStatus,
  setEventSignupsLocked,
} from '../lib/admin-api'
import type { eventmanager } from '../lib/client'

interface UseEventStatusProps {
  eventId: string;
  authHeader: string | null;
  setSelectedEvent: (evt: eventmanager.EventDetail | null) => void;
  setGlobalError: (err: string | null) => void;
  setGlobalSuccess: (success: string | null) => void;
}

export function useEventStatus({
  eventId,
  authHeader,
  setSelectedEvent,
  setGlobalError,
  setGlobalSuccess,
}: UseEventStatusProps) {
  const [eventStatusSaving, setEventStatusSaving] = useState(false)
  const [signupsLockedSaving, setSignupsLockedSaving] = useState(false)

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
    [authHeader, eventId, setSelectedEvent, setGlobalError, setGlobalSuccess],
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
    [authHeader, eventId, setSelectedEvent, setGlobalError, setGlobalSuccess],
  )

  return {
    eventStatusSaving,
    signupsLockedSaving,
    handleUpdateEventStatus,
    handleSetSignupsLocked,
  }
}
