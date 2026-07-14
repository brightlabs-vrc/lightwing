import type { eventmanager } from './client'

export type EditedResult = {
  position: string
  points: string
  gateNumber: string
  finishTime: string
  margin: string
  passingOrder: string
  final3F: string
}

export const EMPTY_EDIT: EditedResult = {
  position: '',
  points: '0',
  gateNumber: '',
  finishTime: '',
  margin: '',
  passingOrder: '',
  final3F: '',
}

export type RowState = 'unchanged' | 'new' | 'modified' | 'pending_delete'

export interface DerivedRow {
  member: eventmanager.EventMemberView
  savedResult: eventmanager.RaceResultView | undefined
  edit: EditedResult
  rowState: RowState
}

export interface ChangeSummary {
  newCount: number
  modifiedCount: number
  deletedCount: number
  totalCount: number
}

// Build the initial edit buffer from saved results.
export function editsFromResults(results: eventmanager.RaceResultView[]): Record<string, EditedResult> {
  const nextEdits: Record<string, EditedResult> = {}
  for (const res of results) {
    nextEdits[res.userId] = {
      position: res.position !== null ? String(res.position) : '',
      points: String(res.points),
      gateNumber: res.gateNumber !== null ? String(res.gateNumber) : '',
      finishTime: res.finishTime ?? '',
      margin: res.margin ?? '',
      passingOrder: res.passingOrder ?? '',
      final3F: res.final3F ?? '',
    }
  }
  return nextEdits
}

// Derive per-member row state for the standings editor.
export function deriveRows(
  members: eventmanager.EventMemberView[],
  results: eventmanager.RaceResultView[],
  editedResults: Record<string, EditedResult>,
  pendingDeletions: Set<string>,
): DerivedRow[] {
  return members.map((member) => {
    const savedResult = results.find((r) => r.userId === member.userId)
    const edit = editedResults[member.userId] ?? EMPTY_EDIT
    const isPendingDelete = pendingDeletions.has(member.userId)

    let rowState: RowState = 'unchanged'

    if (isPendingDelete) {
      rowState = 'pending_delete'
    } else if (savedResult) {
      const savedPos = savedResult.position !== null ? String(savedResult.position) : ''
      const savedPoints = String(savedResult.points)
      const savedGate = savedResult.gateNumber !== null ? String(savedResult.gateNumber) : ''
      const savedFinish = savedResult.finishTime ?? ''
      const savedMargin = savedResult.margin ?? ''
      const savedPassing = savedResult.passingOrder ?? ''
      const savedFinal3F = savedResult.final3F ?? ''

      if (
        edit.position !== savedPos ||
        edit.points !== savedPoints ||
        edit.gateNumber !== savedGate ||
        edit.finishTime !== savedFinish ||
        edit.margin !== savedMargin ||
        edit.passingOrder !== savedPassing ||
        edit.final3F !== savedFinal3F
      ) {
        rowState = 'modified'
      }
    } else {
      const isDefault =
        edit.position === '' &&
        (edit.points === '' || edit.points === '0') &&
        edit.gateNumber === '' &&
        edit.finishTime === '' &&
        edit.margin === '' &&
        edit.passingOrder === '' &&
        edit.final3F === ''

      if (!isDefault) {
        rowState = 'new'
      }
    }

    return { member, savedResult, edit, rowState }
  })
}

export function summarizeChanges(rows: DerivedRow[]): ChangeSummary {
  let newCount = 0
  let modifiedCount = 0
  let deletedCount = 0

  for (const d of rows) {
    if (d.rowState === 'new') newCount++
    if (d.rowState === 'modified') modifiedCount++
    if (d.rowState === 'pending_delete') deletedCount++
  }

  return { newCount, modifiedCount, deletedCount, totalCount: newCount + modifiedCount + deletedCount }
}

// Parse a finish time string (m:ss.t / mm:ss.t / ss.t) into seconds.
export function parseFinishTimeToSeconds(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const match = trimmed.match(/^(?:(\d+):)?(\d+)(?:\.(\d+))?$/)
  if (!match) return null
  const minutes = match[1] ? Number(match[1]) : 0
  const seconds = Number(match[2])
  if (Number.isNaN(minutes) || Number.isNaN(seconds)) return null
  return minutes * 60 + seconds + (match[3] ? Number(`0.${match[3]}`) : 0)
}

// Format seconds back into m:ss.t (one decimal) finish time notation.
export function formatSecondsToFinishTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds - minutes * 60
  return `${minutes}:${seconds.toFixed(1).padStart(4, '0')}`
}

// Parse a margin string into a gap in seconds. Supports lengths, noses, heads,
// necks and shorthand like "2 1/2", "1/2", "3/4". Falls back to 0 for "—"/"".
export function parseMarginToSeconds(value: string): number {
  const trimmed = value.trim().toLowerCase()
  if (!trimmed || trimmed === '—' || trimmed === '-' || trimmed === '0') return 0

  // Capture optional fractional part like "1/2" or "3/4" after a whole number.
  const fractionMatch = trimmed.match(/(\d+)\/(\d+)/)
  let fraction = 0
  if (fractionMatch) {
    fraction = Number(fractionMatch[1]) / Number(fractionMatch[2])
  }

  const wholeMatch = trimmed.match(/^(\d+)/)
  const whole = wholeMatch ? Number(wholeMatch[1]) : 0

  const base = whole + fraction

  if (trimmed.includes('nose')) return base * 0.05
  if (trimmed.includes('head')) return base * 0.15
  if (trimmed.includes('neck')) return base * 0.25
  // Default unit is "length" (~2 horse lengths per second in flat racing).
  return base * 0.5
}

// Infer missing finish times from the leader's time plus each horse's margin.
// Pure: returns either an error message or the next edits map + inferred count.
export function inferFinishTimes(
  rows: DerivedRow[],
  editedResults: Record<string, EditedResult>,
): { error: string } | { edits: Record<string, EditedResult>; inferredCount: number } {
  const rowsWithTime = rows.filter(
    (d) => d.rowState !== 'pending_delete' && (d.edit.finishTime ?? '').trim() !== '',
  )
  if (rowsWithTime.length !== 1) {
    return { error: 'Infer Times needs exactly one horse with a known finish time (the leader).' }
  }

  const leader = rowsWithTime[0]
  const leaderSeconds = parseFinishTimeToSeconds(leader.edit.finishTime ?? '')
  if (leaderSeconds === null) {
    return { error: 'Unable to parse the leader finish time. Use m:ss.t format (e.g. 1:32.1).' }
  }

  const nextEdits: Record<string, EditedResult> = { ...editedResults }
  let inferredCount = 0

  for (const d of rows) {
    if (d.rowState === 'pending_delete') continue
    if (d.member.userId === leader.member.userId) continue
    if ((d.edit.finishTime ?? '').trim() !== '') continue

    const gapSeconds = parseMarginToSeconds(d.edit.margin ?? '')
    if (gapSeconds === 0) continue

    const inferredSeconds = leaderSeconds + gapSeconds
    nextEdits[d.member.userId] = {
      ...(nextEdits[d.member.userId] ?? EMPTY_EDIT),
      finishTime: formatSecondsToFinishTime(inferredSeconds),
    }
    inferredCount++
  }

  if (inferredCount === 0) {
    return { error: 'No finish times could be inferred. Ensure trailing horses have a margin/length value.' }
  }

  return { edits: nextEdits, inferredCount }
}

// Convert a single edited row into the API payload shape.
export function editedToRaceResultInput(userId: string, edit: EditedResult): eventmanager.RaceResultInput {
  return {
    userId,
    position: edit.position.trim() !== '' ? Number(edit.position) : null,
    points: Number(edit.points) || 0,
    gateNumber: edit.gateNumber.trim() !== '' ? Number(edit.gateNumber) : null,
    finishTime: edit.finishTime.trim() !== '' ? edit.finishTime.trim() : null,
    margin: edit.margin.trim() !== '' ? edit.margin.trim() : null,
    passingOrder: edit.passingOrder.trim() !== '' ? edit.passingOrder.trim() : null,
    final3F: edit.final3F.trim() !== '' ? edit.final3F.trim() : null,
  }
}

// Convert a saved result row into the API payload shape (used for full replace).
export function savedToRaceResultInput(saved: eventmanager.RaceResultView): eventmanager.RaceResultInput {
  return {
    userId: saved.userId,
    position: saved.position,
    points: saved.points,
    gateNumber: saved.gateNumber,
    finishTime: saved.finishTime,
    margin: saved.margin,
    passingOrder: saved.passingOrder,
    final3F: saved.final3F,
  }
}
