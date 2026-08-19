import type { eventmanager } from './client'

export type EditedResult = {
  position: string
  points: string
  gateNumber: string
  finishTime: string
  margin: string
  passingOrder: string
  final3F: string
  resultStatus: string
}

export const EMPTY_EDIT: EditedResult = {
  position: '',
  points: '0',
  gateNumber: '',
  finishTime: '',
  margin: '',
  passingOrder: '',
  final3F: '',
  resultStatus: '',
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
      resultStatus: res.resultStatus ?? '',
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
      const savedStatus = savedResult.resultStatus ?? ''

      if (
        edit.position !== savedPos ||
        edit.points !== savedPoints ||
        edit.gateNumber !== savedGate ||
        edit.finishTime !== savedFinish ||
        edit.margin !== savedMargin ||
        edit.passingOrder !== savedPassing ||
        edit.final3F !== savedFinal3F ||
        edit.resultStatus !== savedStatus
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
        edit.final3F === '' &&
        edit.resultStatus === ''

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

  let whole = 0
  let fraction = 0

  const match = trimmed.match(/^(?:(\d+)\s*[- ]\s*)?(\d+)\/(\d+)|^(\d+)/)
  if (match) {
    if (match[4]) {
      whole = Number(match[4])
    } else {
      if (match[1]) {
        whole = Number(match[1])
      }
      const num = Number(match[2])
      const den = Number(match[3])
      if (den !== 0) {
        fraction = num / den
      }
    }
  }

  let base = whole + fraction
  if (base === 0 && (trimmed.includes('nose') || trimmed.includes('head') || trimmed.includes('neck') || trimmed.includes('length'))) {
    base = 1
  }

  if (trimmed.includes('nose')) return base * 0.05
  if (trimmed.includes('head')) return base * 0.15
  if (trimmed.includes('neck')) return base * 0.25
  // Default unit is "length" (~2 horse lengths per second in flat racing).
  return base * 0.5
}

// Infer missing finish times from the leader's time and ordered per-position margins.
// Pure: returns either an error message or the next edits map + inferred count.
export function inferFinishTimes(
  rows: DerivedRow[],
  editedResults: Record<string, EditedResult>,
): { error: string } | { edits: Record<string, EditedResult>; inferredCount: number } {
  // DSQ/DNF/DNS rows are excluded — they have no valid position and cannot have
  // inferred finish times.
  const activeRows = rows.filter(
    (d) => d.rowState !== 'pending_delete' && d.edit.resultStatus !== 'DSQ' && d.edit.resultStatus !== 'DNF' && d.edit.resultStatus !== 'DNS'
  )

  // 1. Verify all rows have valid numeric positions
  for (const d of activeRows) {
    const posStr = (d.edit.position ?? '').trim()
    if (!posStr || !/^[1-9]\d*$/.test(posStr)) {
      return { error: 'All rows participating in infer time must have numeric finishing positions.' }
    }
  }

  // 2. Check for duplicate positions
  const posSet = new Set<number>()
  for (const d of activeRows) {
    const pos = Number(d.edit.position.trim())
    if (posSet.has(pos)) {
      return { error: `Duplicate position ${pos} detected in standings.` }
    }
    posSet.add(pos)
  }

  // Sort rows ascending by position
  const sortedRows = [...activeRows].sort((a, b) => {
    return Number(a.edit.position.trim()) - Number(b.edit.position.trim())
  })

  if (sortedRows.length === 0) {
    return { error: 'No active rows to infer finish times.' }
  }

  // 3. Verify contiguous positions starting from 1
  for (let i = 0; i < sortedRows.length; i++) {
    const expectedPos = i + 1
    const actualPos = Number(sortedRows[i].edit.position.trim())
    if (actualPos !== expectedPos) {
      return {
        error: `Missing position ${expectedPos} in the standings sequence. Infer time requires contiguous official finishing positions starting from 1.`
      }
    }
  }

  // 4. Position-1 must be the leader and have a valid, parseable finish time
  const leader = sortedRows[0]
  const leaderSeconds = parseFinishTimeToSeconds(leader.edit.finishTime ?? '')
  if (leaderSeconds === null) {
    return { error: 'Unable to parse the leader finish time. Use m:ss.t format (e.g. 1:32.1).' }
  }

  const nextEdits: Record<string, EditedResult> = { ...editedResults }
  let previousSeconds = leaderSeconds
  let inferredCount = 0

  // 5. Apply cumulative margin math for positions 2..N
  for (let i = 1; i < sortedRows.length; i++) {
    const row = sortedRows[i]
    const pos = i + 1
    const marginStr = (row.edit.margin ?? '').trim()

    const isZeroEquivalent = !marginStr || marginStr === '0' || marginStr === '—' || marginStr === '-'
    let gapSeconds = 0
    if (!isZeroEquivalent) {
      gapSeconds = parseMarginToSeconds(marginStr)
    }

    if (isZeroEquivalent || gapSeconds === 0) {
      return { error: `Position ${pos} has an empty or zero margin, which blocks cumulative inference.` }
    }

    const currentSeconds = previousSeconds + gapSeconds
    nextEdits[row.member.userId] = {
      ...(nextEdits[row.member.userId] ?? EMPTY_EDIT),
      finishTime: formatSecondsToFinishTime(currentSeconds),
    }
    previousSeconds = currentSeconds
    inferredCount++
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
    resultStatus: edit.resultStatus.trim() !== '' ? edit.resultStatus.trim() : null,
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
    resultStatus: saved.resultStatus,
  }
}
