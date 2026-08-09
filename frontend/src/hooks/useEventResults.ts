import { useCallback, useMemo, useState } from 'react'
import {
  deleteRaceResult,
  assignRaceResult,
  replaceRaceResults,
  mergeRaceResults,
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

interface UseEventResultsProps {
  eventId: string;
  authHeader: string | null;
  selectedEvent: eventmanager.EventDetail | null;
  selectedRace: eventmanager.RaceEventDetail | null;
  selectedRaceId: string | null;
  setSelectedRaceId: (id: string | null) => void;
  reloadCurrentEvent: () => Promise<void>;
  setGlobalError: (err: string | null) => void;
  setGlobalSuccess: (success: string | null) => void;
}

export function useEventResults({
  eventId,
  authHeader,
  selectedEvent,
  selectedRace,
  selectedRaceId,
  setSelectedRaceId,
  reloadCurrentEvent,
  setGlobalError,
  setGlobalSuccess,
}: UseEventResultsProps) {
  // Results Editor States
  const [results, setResults] = useState<eventmanager.RaceResultView[]>([])
  const [editedResults, setEditedResults] = useState<Record<string, EditedResult>>({})
  const [pendingDeletions, setPendingDeletions] = useState<Set<string>>(new Set())
  const [savingBatch, setSavingBatch] = useState(false)

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
          resultStatus: saved?.resultStatus ?? '',
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
    setGlobalSuccess(`Recalculated finish times cumulatively by finishing position for ${result.inferredCount} horse(s).`)
  }, [derivedStates, editedResults, setGlobalError, setGlobalSuccess])

  const handleCancelStandingsEdit = useCallback(() => {
    resetStandingsDraft()
    setSelectedRaceId(null)
    setGlobalError(null)
    setGlobalSuccess(null)
  }, [results, setSelectedRaceId, setGlobalError, setGlobalSuccess])

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
          resultStatus: d.edit.resultStatus.trim() !== '' ? d.edit.resultStatus.trim() : null,
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
              resultStatus: change.resultStatus,
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
            resultStatus: d.savedResult!.resultStatus,
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
                resultStatus: d.edit.resultStatus.trim() !== '' ? d.edit.resultStatus.trim() : null,
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
    setGlobalError,
    setGlobalSuccess,
  ])

  return {
    results,
    setResults,
    editedResults,
    setEditedResults,
    pendingDeletions,
    setPendingDeletions,
    savingBatch,
    derivedStates,
    changeSummary,
    handleResultChange,
    togglePendingDeletion,
    handleUndoRow,
    resetStandingsDraft,
    handleInferFinishTimes,
    handleCancelStandingsEdit,
    handleUnifiedSave,
  }
}
