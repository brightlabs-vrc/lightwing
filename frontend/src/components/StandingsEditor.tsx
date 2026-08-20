'use client'
import type { eventmanager } from '../lib/client'
import type { ChangeSummary, DerivedRow, EditedResult } from '../lib/standings'
import { AlertBanner } from './AlertBanner'
import { UserLink } from './UserLink'
import { DEFAULT_SCORING_TABLES } from '../lib/scoringDefaults'
import { Heading, Text, Label, Button, TextInput, FormControl, Select } from '@primer/react'

interface StandingsEditorProps {
  raceName: string
  isRaceOngoing: boolean
  isRaceNotStarted: boolean
  loadingResults: boolean
  memberCount: number
  rows: DerivedRow[]
  changeSummary: ChangeSummary
  savingBatch: boolean
  onInferTimes: () => void
  onCancel: () => void
  onSave: () => void
  onResetAll: () => void
  onResultChange: (userId: string, field: keyof EditedResult, value: string) => void
  onTogglePendingDeletion: (userId: string) => void
  onUndoRow: (userId: string) => void
  noTopMargin?: boolean
  scoringType?: number
  scoringRulesMode?: string | null
  customScoringTables?: any | null
  raceGrade?: string | null
}

export function StandingsEditor({
  raceName,
  isRaceOngoing,
  isRaceNotStarted,
  loadingResults,
  memberCount,
  rows,
  changeSummary,
  savingBatch,
  onInferTimes,
  onCancel,
  onSave,
  onResetAll,
  onResultChange,
  onTogglePendingDeletion,
  onUndoRow,
  noTopMargin = false,
  scoringType,
  scoringRulesMode,
  customScoringTables,
  raceGrade,
}: StandingsEditorProps) {
  return (
    <div style={{
      border: '2px solid var(--color-accent-emphasis)',
      borderRadius: '6px',
      backgroundColor: 'var(--color-canvas-default)',
      boxShadow: 'var(--color-shadow-medium)',
      marginTop: noTopMargin ? 0 : '1.5rem',
      overflow: 'hidden'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'var(--color-canvas-subtle)',
        padding: '12px 16px',
        borderBottom: '1px solid var(--color-border-default)'
      }}>
        <div>
          <Heading as="h2" style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>
            Standings Grid: {raceName}
          </Heading>
          <Text style={{ fontSize: '11px', color: 'var(--color-fg-muted)', display: 'block' }}>
            Assign finishes for registered event participants. Status: {isRaceNotStarted ? 'Not Started' : isRaceOngoing ? 'Ongoing (Live - Provisional Saving Allowed)' : 'Concluded'}
          </Text>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {!isRaceNotStarted && !isRaceOngoing && (
            <Button
              onClick={onInferTimes}
              disabled={savingBatch || loadingResults}
              title="Fill in missing finish times from the leader's time plus each horse's margin/length"
            >
              Infer Times
            </Button>
          )}
          <Button
            onClick={onCancel}
            disabled={savingBatch || loadingResults}
          >
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={savingBatch || loadingResults || changeSummary.totalCount === 0}
            variant={changeSummary.totalCount > 0 ? 'primary' : 'default'}
            title={isRaceNotStarted ? 'Save draw numbers' : isRaceOngoing ? 'Save provisional standings' : 'Save final standings'}
          >
            {savingBatch ? 'Saving...' : isRaceNotStarted ? `Save Draw Numbers (${changeSummary.totalCount})` : `Save (${changeSummary.totalCount})`}
          </Button>
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        {isRaceNotStarted && (
          <div style={{ marginBottom: '1rem' }}>
            <AlertBanner variant="warning">
              <span style={{ fontWeight: 'bold', fontSize: '12px' }}>
                Race has not started yet. You can set or edit the <strong>Draw (Gate Number)</strong> for each competitor below. Other finish-related fields will be enabled once the race starts.
              </span>
            </AlertBanner>
          </div>
        )}

        {isRaceOngoing && (
          <div style={{ marginBottom: '1rem' }}>
            <AlertBanner variant="warning">
              <span style={{ fontWeight: 'bold', fontSize: '12px' }}>
                Race is currently Ongoing (Live). You can save results now as <strong>Provisional Standings</strong>. You can still edit or finalize them once the race concludes.
              </span>
            </AlertBanner>
          </div>
        )}

        {changeSummary.totalCount > 0 && !isRaceOngoing && (
          <div style={{ marginBottom: '1rem' }}>
            <AlertBanner
              variant="warning"
              action={
                <Button onClick={onResetAll} size="small">
                  Reset All
                </Button>
              }
            >
              <span style={{ fontWeight: 'bold', fontSize: '12px' }}>
                Unsaved changes: {changeSummary.newCount > 0 && `${changeSummary.newCount} new, `}
                {changeSummary.modifiedCount > 0 && `${changeSummary.modifiedCount} modified, `}
                {changeSummary.deletedCount > 0 && `${changeSummary.deletedCount} pending deletion`}. Click "Save" above to submit.
              </span>
            </AlertBanner>
          </div>
        )}

        {loadingResults ? (
          <p style={{ color: 'var(--color-fg-muted)', fontSize: '14px' }}>Loading race results data...</p>
        ) : memberCount === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-fg-muted)' }}>
            No registered event participants found. Add participants under "Event Members" tab first.
          </div>
        ) : (
          <StandingsTable
            rows={rows}
            onResultChange={onResultChange}
            onTogglePendingDeletion={onTogglePendingDeletion}
            onUndoRow={onUndoRow}
            scoringType={scoringType}
            scoringRulesMode={scoringRulesMode}
            customScoringTables={customScoringTables}
            raceGrade={raceGrade}
            isRaceNotStarted={isRaceNotStarted}
          />
        )}
      </div>
    </div>
  )
}

interface StandingsTableProps {
  rows: DerivedRow[]
  onResultChange: (userId: string, field: keyof EditedResult, value: string) => void
  onTogglePendingDeletion: (userId: string) => void
  onUndoRow: (userId: string) => void
  scoringType?: number
  scoringRulesMode?: string | null
  customScoringTables?: any | null
  raceGrade?: string | null
  isRaceNotStarted?: boolean
}

function StandingsTable({
  rows,
  onResultChange,
  onTogglePendingDeletion,
  onUndoRow,
  scoringType,
  scoringRulesMode,
  customScoringTables,
  raceGrade,
  isRaceNotStarted = false,
}: StandingsTableProps) {
  const getPreviewPoints = (positionStr: string, resultStatus: string): number => {
    // DSQ/DNF always resolve to 0 points
    if (resultStatus === 'DSQ' || resultStatus === 'DNF') {
      return 0
    }
    const position = parseInt(positionStr, 10)
    if (isNaN(position) || position < 1 || position > 10) return 0
    if (!raceGrade) return 0

    if (scoringRulesMode === 'CUSTOM' && customScoringTables && customScoringTables[raceGrade]) {
      return customScoringTables[raceGrade][position] ?? 0
    }

    return DEFAULT_SCORING_TABLES[raceGrade]?.[position] ?? 0
  }

  return (
    <div>
      <div style={{ overflowX: 'auto', width: '100%' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px', border: '1px solid var(--color-border-default)', borderRadius: '6px' }}>
          <thead>
            <tr style={{ background: 'var(--color-canvas-subtle)', borderBottom: '1px solid var(--color-border-default)' }}>
              <th style={{ padding: '8px', fontWeight: 'bold' }}>Competitor Name</th>
              <th style={{ padding: '8px', fontWeight: 'bold' }}>User ID</th>
              <th style={{ padding: '8px', fontWeight: 'bold', width: '110px' }}>Draw</th>
              <th style={{ padding: '8px', fontWeight: 'bold', width: '90px' }}>Position</th>
              <th style={{ padding: '8px', fontWeight: 'bold', width: '90px' }}>Points</th>
              <th style={{ padding: '8px', fontWeight: 'bold', width: '110px' }}>Finish Time</th>
              <th style={{ padding: '8px', fontWeight: 'bold', width: '90px' }}>Behind</th>
              <th style={{ padding: '8px', fontWeight: 'bold', width: '100px' }}>Passing Order</th>
              <th style={{ padding: '8px', fontWeight: 'bold', width: '100px' }}>Final 3F</th>
              <th style={{ padding: '8px', fontWeight: 'bold', width: '100px' }}>Outcome</th>
              <th style={{ padding: '8px', fontWeight: 'bold' }}>Status</th>
              <th style={{ padding: '8px', fontWeight: 'bold', width: '160px' }}>Staged Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ member, savedResult, edit, rowState }) => {
              const isDeleted = rowState === 'pending_delete'
              const isModified = rowState === 'modified'
              const isNew = rowState === 'new'

              let rowBg = 'transparent'
              if (isDeleted) rowBg = 'var(--color-danger-subtle)'
              else if (isModified) rowBg = 'var(--color-accent-subtle)'
              else if (isNew) rowBg = 'var(--color-success-subtle)'

              return (
                <tr
                  key={member.userId}
                  style={{
                    backgroundColor: rowBg,
                    transition: 'background-color 0.2s',
                    textDecoration: isDeleted ? 'line-through' : 'none',
                    opacity: isDeleted ? 0.6 : 1,
                    borderBottom: '1px solid var(--color-border-default)'
                  }}
                >
                  <td style={{ padding: '8px' }}>
                    <UserLink userId={member.userId} name={member.name} />
                  </td>
                  <td style={{ padding: '8px' }}>
                    <code style={{ fontSize: '11px' }}>{member.userId}</code>
                  </td>
                  <td style={{ padding: '8px' }}>
                    <TextInput
                      type="number"
                      placeholder="Draw"
                      value={edit.gateNumber}
                      onChange={(e) => onResultChange(member.userId, 'gateNumber', e.target.value)}
                      size="small"
                      className="standings-input-no-spinner"
                      style={{ width: '100%' }}
                    />
                  </td>
                  <td style={{ padding: '8px' }}>
                    <TextInput
                      type="number"
                      placeholder="None"
                      disabled={isDeleted || isRaceNotStarted}
                      value={edit.position}
                      onChange={(e) => onResultChange(member.userId, 'position', e.target.value)}
                      size="small"
                      className="standings-input-no-spinner"
                      style={{ width: '100%' }}
                    />
                  </td>
                  <td style={{ padding: '8px' }}>
                    {scoringType === 1 ? (
                      <div style={{ fontWeight: 'bold', color: 'var(--color-accent-fg)', fontSize: '13px', textAlign: 'center' }}>
                        {getPreviewPoints(edit.position, edit.resultStatus)} pts <span style={{ fontSize: '9px', color: 'var(--color-fg-muted)', display: 'block', fontWeight: 'normal' }}>(Auto)</span>
                      </div>
                    ) : (
                      <TextInput
                        type="number"
                        placeholder="0"
                        disabled={isDeleted || isRaceNotStarted}
                        value={edit.points}
                        onChange={(e) => onResultChange(member.userId, 'points', e.target.value)}
                        size="small"
                        className="standings-input-no-spinner"
                        style={{ width: '100%' }}
                      />
                    )}
                  </td>
                  <td style={{ padding: '8px' }}>
                    <TextInput
                      type="text"
                      placeholder="1:32.1"
                      disabled={isDeleted || isRaceNotStarted}
                      value={edit.finishTime}
                      onChange={(e) => onResultChange(member.userId, 'finishTime', e.target.value)}
                      size="small"
                      style={{ width: '100%' }}
                    />
                  </td>
                  <td style={{ padding: '8px' }}>
                    <TextInput
                      type="text"
                      placeholder="nose"
                      disabled={isDeleted || isRaceNotStarted}
                      value={edit.margin}
                      onChange={(e) => onResultChange(member.userId, 'margin', e.target.value)}
                      size="small"
                      style={{ width: '100%' }}
                    />
                  </td>
                  <td style={{ padding: '8px' }}>
                    <TextInput
                      type="text"
                      placeholder="3-2-1"
                      disabled={isDeleted || isRaceNotStarted}
                      value={edit.passingOrder}
                      onChange={(e) => onResultChange(member.userId, 'passingOrder', e.target.value)}
                      size="small"
                      style={{ width: '100%' }}
                    />
                  </td>
                  <td style={{ padding: '8px' }}>
                    <TextInput
                      type="text"
                      placeholder="34.5"
                      disabled={isDeleted || isRaceNotStarted}
                      value={edit.final3F}
                      onChange={(e) => onResultChange(member.userId, 'final3F', e.target.value)}
                      size="small"
                      style={{ width: '100%' }}
                    />
                  </td>
                  <td style={{ padding: '8px' }}>
                    <Select
                      disabled={isDeleted}
                      value={edit.resultStatus}
                      onChange={(e) => onResultChange(member.userId, 'resultStatus', e.target.value)}
                      size="small"
                      style={{ width: '100%' }}
                    >
                      <option value="">Normal</option>
                      <option value="DSQ">DSQ — Did Not Qualify</option>
                      <option value="DNF">DNF — Did Not Finish</option>
                    </Select>
                  </td>
                  <td style={{ padding: '8px' }}>
                    {isDeleted ? (
                      <Label variant="danger">Pending Deletion</Label>
                    ) : isModified ? (
                      <Label variant="accent">Modified (Unsaved)</Label>
                    ) : isNew ? (
                      <Label variant="success">New (Unsaved)</Label>
                    ) : savedResult ? (
                      <Label variant="success">
                        {savedResult.resultStatus === 'DSQ' ? 'DSQ' : savedResult.resultStatus === 'DNF' ? 'DNF' : isRaceNotStarted ? `Draw Assigned (${savedResult.gateNumber ?? 'n/a'})` : `Saved (Pos: ${savedResult.position ?? 'n/a'}, Pts: ${savedResult.points})`}
                      </Label>
                    ) : (
                      <Label variant="default">
                        {isRaceNotStarted ? 'No draw assigned' : 'No result recorded'}
                      </Label>
                    )}
                  </td>
                  <td style={{ padding: '8px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {isDeleted ? (
                        <Button
                          onClick={() => onTogglePendingDeletion(member.userId)}
                          size="small"
                          style={{ width: '100%' }}
                        >
                          Restore
                        </Button>
                      ) : isModified || isNew ? (
                        <>
                          <Button
                            onClick={() => onUndoRow(member.userId)}
                            size="small"
                            style={{ width: '100%' }}
                          >
                            Reset
                          </Button>
                          {savedResult && (
                            <Button
                              onClick={() => onTogglePendingDeletion(member.userId)}
                              variant="danger"
                              size="small"
                            >
                              Remove
                            </Button>
                          )}
                        </>
                      ) : savedResult ? (
                        <Button
                          onClick={() => onTogglePendingDeletion(member.userId)}
                          variant="danger"
                          size="small"
                          style={{ width: '100%' }}
                        >
                          Remove
                        </Button>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--fgColor-muted)', fontStyle: 'italic', padding: '2px 8px' }}>
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
      </div>

      <div style={{
        backgroundColor: 'var(--color-canvas-subtle)',
        border: '1px solid var(--color-border-default)',
        borderRadius: '6px',
        padding: '12px',
        marginTop: '1.5rem'
      }}>
        <h4 style={{ fontWeight: 'bold', color: 'var(--color-fg-default)', margin: '0 0 4px 0' }}>Explanation of Standings update actions</h4>
        <ul style={{ paddingLeft: '1.25rem', marginTop: '4px', fontSize: '12px', color: 'var(--color-fg-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <li><strong>Staging Changes</strong> - Edits to the standings are compiled locally. Highlighting shows which rows have modified values or are pending deletion.</li>
          <li><strong>Smart Save Standings</strong> - The system analyzes your edits and executes the safest, most performant update automatically:
            <ul style={{ paddingLeft: '1.25rem', marginTop: '2px', listStyleType: 'circle', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <li style={{ fontSize: '11px' }}>Exactly 1 change: Updates single row in-place.</li>
              <li style={{ fontSize: '11px' }}>Exactly 1 delete: Removes single result in-place.</li>
              <li style={{ fontSize: '11px' }}>Multiple changes w/o deletions: Blends/merges the bulk updates safely.</li>
              <li style={{ fontSize: '11px' }}>Multiple changes containing deletions: Replaces standings to reconcile deleted results.</li>
            </ul>
          </li>
        </ul>
      </div>
    </div>
  )
}
export default StandingsEditor
