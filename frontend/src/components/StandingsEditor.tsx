import { useState } from 'react'
import type { eventmanager } from '../lib/client'
import {
  parsePenaltyStatus,
  formatPenaltyStatus,
  computeRaceEffectiveResults,
  type PenaltyType,
  type ChangeSummary,
  type DerivedRow,
  type EditedResult,
} from '../lib/standings'
import { AlertBanner } from './AlertBanner'
import { UserLink } from './UserLink'
import { DEFAULT_SCORING_TABLES } from '../lib/scoringDefaults'
import {
  PixelButton,
  PixelBadge,
  PixelAlert,
  PixelModal,
} from '@pxlkit/ui-kit'

interface StandingsEditorProps {
  variant?: 'pixel' | 'slds'
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
  variant = 'slds',
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
  const isPixel = variant === 'pixel'

  if (isPixel) {
    return (
      <article className={`p-4 rounded border-2 border-retro-border bg-retro-surface ${noTopMargin ? '' : 'mt-6'}`}>
        <div className="flex justify-between items-center pb-4 mb-4 border-b border-retro-border flex-wrap gap-2">
          <div>
            <h3 className="font-pixel text-base font-bold text-retro-text">
              STANDINGS GRID: {raceName.toUpperCase()}
            </h3>
            <p className="font-sans text-xs text-retro-muted">
              Assign finishes for registered event participants. Click on a participant or Penalty button to issue conduct penalties. Status: {isRaceNotStarted ? 'Not Started' : isRaceOngoing ? 'Ongoing (Live - Provisional Saving Allowed)' : 'Concluded'}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {!isRaceNotStarted && !isRaceOngoing && (
              <PixelButton
                variant="ghost"
                tone="neutral"
                size="sm"
                onClick={onInferTimes}
                disabled={savingBatch || loadingResults}
                title="Fill in missing finish times from the leader's time plus each horse's margin/length"
              >
                INFER TIMES
              </PixelButton>
            )}
            <PixelButton
              variant="ghost"
              tone="neutral"
              size="sm"
              onClick={onCancel}
              disabled={savingBatch || loadingResults}
            >
              CANCEL
            </PixelButton>
            <PixelButton
              variant="solid"
              tone="purple"
              size="sm"
              onClick={onSave}
              disabled={savingBatch || loadingResults || changeSummary.totalCount === 0}
              title={isRaceNotStarted ? 'Save draw numbers' : isRaceOngoing ? 'Save provisional standings' : 'Save final standings'}
            >
              {savingBatch ? 'SAVING...' : isRaceNotStarted ? `SAVE DRAW NUMBERS (${changeSummary.totalCount})` : `SAVE (${changeSummary.totalCount})`}
            </PixelButton>
          </div>
        </div>

        <div className="space-y-3 mb-4">
          {isRaceNotStarted && (
            <PixelAlert
              tone="cyan"
              message="Race has not started yet. You can set or edit the Draw (Gate Number) for each competitor below. Other finish-related fields will be enabled once the race starts."
            />
          )}

          {isRaceOngoing && (
            <PixelAlert
              tone="cyan"
              message="Race is currently Ongoing (Live). You can save results now as Provisional Standings. You can still edit or finalize them once the race concludes."
            />
          )}

          {changeSummary.totalCount > 0 && !isRaceOngoing && (
            <div className="flex items-center justify-between p-3 bg-retro-bg border border-retro-border rounded">
              <span className="font-sans text-xs text-retro-text">
                Unsaved changes: {changeSummary.newCount > 0 && `${changeSummary.newCount} new, `}
                {changeSummary.modifiedCount > 0 && `${changeSummary.modifiedCount} modified, `}
                {changeSummary.deletedCount > 0 && `${changeSummary.deletedCount} pending deletion`}. Click "Save" above to submit.
              </span>
              <PixelButton variant="ghost" tone="neutral" size="sm" onClick={onResetAll}>
                RESET ALL
              </PixelButton>
            </div>
          )}
        </div>

        {loadingResults ? (
          <p className="font-pixel text-xs text-retro-muted">LOADING RACE RESULTS DATA...</p>
        ) : memberCount === 0 ? (
          <p className="font-pixel text-xs text-retro-muted">
            NO REGISTERED EVENT PARTICIPANTS FOUND. ADD PARTICIPANTS FIRST.
          </p>
        ) : (
          <StandingsTable
            variant="pixel"
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
      </article>
    )
  }

  return (
    <article
      className="primer-box"
      style={{
        marginTop: noTopMargin ? 0 : '20px',
        overflow: 'hidden',
      }}
    >
      <div
        className="primer-box-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--fgColor-default, #1f2328)' }}>
            Standings Grid: {raceName}
          </h2>
          <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--fgColor-muted, #636c76)' }}>
            Assign finishes for registered participants. Click a participant or Penalty button to issue conduct penalties. Status:{' '}
            <strong>
              {isRaceNotStarted ? 'Not Started' : isRaceOngoing ? 'Ongoing (Provisional Saving Allowed)' : 'Concluded'}
            </strong>
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {!isRaceNotStarted && !isRaceOngoing && (
            <button
              type="button"
              onClick={onInferTimes}
              disabled={savingBatch || loadingResults}
              title="Fill in missing finish times from the leader's time plus each horse's margin/length"
              style={{
                padding: '5px 12px',
                fontSize: '12px',
                fontWeight: 500,
                borderRadius: '6px',
                border: '1px solid var(--borderColor-default, #d0d7de)',
                backgroundColor: 'var(--bgColor-default, #ffffff)',
                color: 'var(--fgColor-default, #1f2328)',
                cursor: savingBatch || loadingResults ? 'not-allowed' : 'pointer',
              }}
            >
              Infer Times
            </button>
          )}
          <button
            type="button"
            onClick={onCancel}
            disabled={savingBatch || loadingResults}
            style={{
              padding: '5px 12px',
              fontSize: '12px',
              fontWeight: 500,
              borderRadius: '6px',
              border: '1px solid var(--borderColor-default, #d0d7de)',
              backgroundColor: 'var(--bgColor-default, #ffffff)',
              color: 'var(--fgColor-default, #1f2328)',
              cursor: savingBatch || loadingResults ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={savingBatch || loadingResults || changeSummary.totalCount === 0}
            title={isRaceNotStarted ? 'Save draw numbers' : isRaceOngoing ? 'Save provisional standings' : 'Save final standings'}
            style={{
              padding: '5px 14px',
              fontSize: '12px',
              fontWeight: 600,
              borderRadius: '6px',
              border: '1px solid rgba(31, 35, 40, 0.15)',
              backgroundColor:
                changeSummary.totalCount > 0 && !savingBatch && !loadingResults
                  ? 'var(--bgColor-success-emphasis, #1f883d)'
                  : 'var(--bgColor-muted, #f6f8fa)',
              color:
                changeSummary.totalCount > 0 && !savingBatch && !loadingResults
                  ? '#ffffff'
                  : 'var(--fgColor-disabled, #8c959f)',
              cursor: savingBatch || loadingResults || changeSummary.totalCount === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            {savingBatch
              ? 'Saving...'
              : isRaceNotStarted
              ? `Save Draw Numbers (${changeSummary.totalCount})`
              : `Save (${changeSummary.totalCount})`}
          </button>
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        {isRaceNotStarted && (
          <AlertBanner variant="warning">
            <span style={{ fontSize: '12px' }}>
              Race has not started yet. You can set or edit the <strong>Draw (Gate Number)</strong> for each competitor below. Other finish-related fields will unlock once the race starts.
            </span>
          </AlertBanner>
        )}

        {isRaceOngoing && (
          <AlertBanner variant="warning">
            <span style={{ fontSize: '12px' }}>
              Race is currently Ongoing (Live). You can save results now as <strong>Provisional Standings</strong> and finalize them once the race concludes.
            </span>
          </AlertBanner>
        )}

        {changeSummary.totalCount > 0 && !isRaceOngoing && (
          <AlertBanner
            variant="warning"
            action={
              <button
                type="button"
                onClick={onResetAll}
                style={{
                  padding: '3px 10px',
                  fontSize: '11px',
                  fontWeight: 500,
                  borderRadius: '6px',
                  border: '1px solid var(--borderColor-default, #d0d7de)',
                  backgroundColor: 'var(--bgColor-default, #ffffff)',
                  color: 'var(--fgColor-default, #1f2328)',
                  cursor: 'pointer',
                }}
              >
                Reset All
              </button>
            }
          >
            <span style={{ fontSize: '12px' }}>
              Unsaved changes: {changeSummary.newCount > 0 && `${changeSummary.newCount} new, `}
              {changeSummary.modifiedCount > 0 && `${changeSummary.modifiedCount} modified, `}
              {changeSummary.deletedCount > 0 && `${changeSummary.deletedCount} pending deletion`}. Click &quot;Save&quot; above to submit.
            </span>
          </AlertBanner>
        )}

        {loadingResults ? (
          <p style={{ fontSize: '13px', color: 'var(--fgColor-muted, #636c76)', margin: '12px 0' }}>
            Loading race results data...
          </p>
        ) : memberCount === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', fontSize: '13px', color: 'var(--fgColor-muted, #636c76)' }}>
            No registered event participants found. Add participants under the &quot;Event Members&quot; tab first.
          </div>
        ) : (
          <StandingsTable
            variant="primer"
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
    </article>
  )
}

interface StandingsTableProps {
  variant?: 'pixel' | 'primer' | 'slds'
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
  variant = 'slds',
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
  const [penaltyTarget, setPenaltyTarget] = useState<{ userId: string; name: string; currentStatus: string } | null>(null)
  const isPixel = variant === 'pixel'


  const rowItems = rows.map((r) => ({
    userId: r.member.userId,
    position: r.edit.position,
    resultStatus: r.edit.resultStatus,
  }))
  const detailsMap = computeRaceEffectiveResults(
    rowItems,
    raceGrade,
    scoringRulesMode,
    customScoringTables
  )
  const userDetailsMap = new Map(rowItems.map((item) => [item.userId, detailsMap.get(item)!]))

  if (isPixel) {
    return (
      <div>
        {penaltyTarget && (
          <PenaltyDialogue
            variant="pixel"
            participantName={penaltyTarget.name}
            currentStatus={penaltyTarget.currentStatus}
            onApply={(newStatus) => {
              onResultChange(penaltyTarget.userId, 'resultStatus', newStatus)
              setPenaltyTarget(null)
            }}
            onClose={() => setPenaltyTarget(null)}
          />
        )}

        <div className="overflow-x-auto w-full border border-retro-border rounded bg-retro-bg">
          <table className="w-full text-left font-sans text-xs border-collapse min-w-[1175px] table-fixed">
            <thead>
              <tr className="bg-retro-surface border-b border-retro-border font-pixel text-[11px] text-retro-muted uppercase">
                <th className="px-2.5 py-2 align-middle w-[150px]">Competitor Name</th>
                <th className="px-2.5 py-2 align-middle w-[130px]">User ID</th>
                <th className="px-2.5 py-2 align-middle w-[65px]">Draw</th>
                <th className="px-2.5 py-2 align-middle w-[75px]">Position</th>
                <th className="px-2.5 py-2 align-middle w-[65px]">Points</th>
                <th className="px-2.5 py-2 align-middle w-[95px]">Finish Time</th>
                <th className="px-2.5 py-2 align-middle w-[75px]">Behind</th>
                <th className="px-2.5 py-2 align-middle w-[95px]">Passing Order</th>
                <th className="px-2.5 py-2 align-middle w-[75px]">Final 3F</th>
                <th className="px-2.5 py-2 align-middle w-[110px]">Penalty</th>
                <th className="px-2.5 py-2 align-middle w-[130px]">Status</th>
                <th className="px-2.5 py-2 align-middle w-[110px]">Staged Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ member, savedResult, edit, rowState }) => {
                const isDeleted = rowState === 'pending_delete'
                const isModified = rowState === 'modified'
                const isNew = rowState === 'new'

                const details = userDetailsMap.get(member.userId)!

                return (
                  <tr
                    key={member.userId}
                    className={`border-b border-retro-border transition-colors ${
                      isDeleted
                        ? 'bg-red-950/30 line-through opacity-60'
                        : isModified
                        ? 'bg-purple-950/20'
                        : isNew
                        ? 'bg-green-950/20'
                        : 'hover:bg-retro-surface/50'
                    }`}
                  >
                    <td className="px-2.5 py-1.5 align-middle">
                      <div
                        className="cursor-pointer truncate font-medium text-retro-text"
                        onClick={() => !isDeleted && setPenaltyTarget({ userId: member.userId, name: member.name, currentStatus: edit.resultStatus })}
                        title={`Click ${member.name} to issue penalty`}
                      >
                        <UserLink userId={member.userId} name={member.name} />
                      </div>
                    </td>
                    <td className="px-2.5 py-1.5 align-middle">
                      <code className="text-xs text-retro-muted truncate block" title={member.userId}>{member.userId}</code>
                    </td>
                    <td className="px-2.5 py-1.5 align-middle">
                      <input
                        type="number"
                        placeholder="Draw"
                        value={edit.gateNumber}
                        onChange={(e) => onResultChange(member.userId, 'gateNumber', e.target.value)}
                        className="w-full px-1.5 py-1 bg-retro-bg border border-retro-border rounded text-xs text-retro-text text-center focus:outline-none focus:border-retro-primary standings-input-no-spinner"
                      />
                    </td>
                    <td className="px-2.5 py-1.5 align-middle">
                      <input
                        type="number"
                        placeholder="None"
                        disabled={isDeleted || isRaceNotStarted}
                        value={edit.position}
                        onChange={(e) => onResultChange(member.userId, 'position', e.target.value)}
                        className="w-full px-1.5 py-1 bg-retro-bg border border-retro-border rounded text-xs text-retro-text text-center focus:outline-none focus:border-retro-primary disabled:opacity-50 standings-input-no-spinner"
                      />
                      {details.penaltyType === 'POS' && details.effectivePosition !== null && (
                        <div className="text-[10px] text-red-500 font-bold text-center mt-0.5" title={`Position demoted from ${details.physicalPosition} to ${details.effectivePosition}`}>
                          Demoted: Pos {details.effectivePosition}
                        </div>
                      )}
                    </td>
                    <td className="px-2.5 py-1.5 align-middle text-center">
                      {scoringType === 1 ? (
                        <div className="font-bold text-retro-primary text-xs">
                          {details.awardedPoints} pts
                          {details.hasPenalty && details.basePoints > 0 && details.basePoints !== details.awardedPoints && (
                            <span className="text-retro-muted text-[10px] font-normal block" title={`Original base points: ${details.basePoints}`}>
                              ({details.basePoints} orig)
                            </span>
                          )}
                        </div>
                      ) : (
                        <input
                          type="number"
                          placeholder="0"
                          disabled={isDeleted || isRaceNotStarted}
                          value={edit.points}
                          onChange={(e) => onResultChange(member.userId, 'points', e.target.value)}
                          className="w-full px-1.5 py-1 bg-retro-bg border border-retro-border rounded text-xs text-retro-text text-center focus:outline-none focus:border-retro-primary disabled:opacity-50 standings-input-no-spinner"
                        />
                      )}
                    </td>
                    <td className="px-2.5 py-1.5 align-middle">
                      <input
                        type="text"
                        placeholder="1:32.1"
                        disabled={isDeleted || isRaceNotStarted}
                        value={edit.finishTime}
                        onChange={(e) => onResultChange(member.userId, 'finishTime', e.target.value)}
                        className="w-full px-1.5 py-1 bg-retro-bg border border-retro-border rounded text-xs text-retro-text focus:outline-none focus:border-retro-primary disabled:opacity-50"
                      />
                    </td>
                    <td className="px-2.5 py-1.5 align-middle">
                      <input
                        type="text"
                        placeholder="nose"
                        disabled={isDeleted || isRaceNotStarted}
                        value={edit.margin}
                        onChange={(e) => onResultChange(member.userId, 'margin', e.target.value)}
                        className="w-full px-1.5 py-1 bg-retro-bg border border-retro-border rounded text-xs text-retro-text text-center focus:outline-none focus:border-retro-primary disabled:opacity-50"
                      />
                    </td>
                    <td className="px-2.5 py-1.5 align-middle">
                      <input
                        type="text"
                        placeholder="3-2-1"
                        disabled={isDeleted || isRaceNotStarted}
                        value={edit.passingOrder}
                        onChange={(e) => onResultChange(member.userId, 'passingOrder', e.target.value)}
                        className="w-full px-1.5 py-1 bg-retro-bg border border-retro-border rounded text-xs text-retro-text text-center focus:outline-none focus:border-retro-primary disabled:opacity-50"
                      />
                    </td>
                    <td className="px-2.5 py-1.5 align-middle">
                      <input
                        type="text"
                        placeholder="34.5"
                        disabled={isDeleted || isRaceNotStarted}
                        value={edit.final3F}
                        onChange={(e) => onResultChange(member.userId, 'final3F', e.target.value)}
                        className="w-full px-1.5 py-1 bg-retro-bg border border-retro-border rounded text-xs text-retro-text text-center focus:outline-none focus:border-retro-primary disabled:opacity-50"
                      />
                    </td>
                    <td className="px-2.5 py-1.5 align-middle">
                      <PixelButton
                        variant="ghost"
                        tone={edit.resultStatus ? 'pink' : 'neutral'}
                        size="sm"
                        disabled={isDeleted}
                        onClick={() => setPenaltyTarget({ userId: member.userId, name: member.name, currentStatus: edit.resultStatus })}
                        className="w-full text-center"
                      >
                        {edit.resultStatus ? edit.resultStatus : 'PENALTY'}
                      </PixelButton>
                    </td>
                    <td className="px-2.5 py-1.5 align-middle">
                      {isDeleted ? (
                        <PixelBadge tone="pink">PENDING DELETION</PixelBadge>
                      ) : isModified ? (
                        <PixelBadge tone="cyan">MODIFIED</PixelBadge>
                      ) : isNew ? (
                        <PixelBadge tone="green">NEW</PixelBadge>
                      ) : savedResult ? (
                        <PixelBadge tone={savedResult.resultStatus ? 'pink' : 'purple'}>
                          {savedResult.resultStatus ? savedResult.resultStatus : isRaceNotStarted ? `DRAW ${savedResult.gateNumber ?? 'N/A'}` : `POS ${savedResult.position ?? 'N/A'} (${savedResult.points} PTS)`}
                        </PixelBadge>
                      ) : (
                        <PixelBadge tone="neutral">UNRECORDED</PixelBadge>
                      )}
                    </td>
                    <td className="px-2.5 py-1.5 align-middle">
                      <div className="flex gap-1 items-center">
                        {isDeleted ? (
                          <PixelButton variant="ghost" tone="green" size="sm" onClick={() => onTogglePendingDeletion(member.userId)}>
                            RESTORE
                          </PixelButton>
                        ) : isModified || isNew ? (
                          <>
                            <PixelButton variant="ghost" tone="neutral" size="sm" onClick={() => onUndoRow(member.userId)}>
                              RESET
                            </PixelButton>
                            {savedResult && (
                              <PixelButton variant="ghost" tone="red" size="sm" onClick={() => onTogglePendingDeletion(member.userId)}>
                                REMOVE
                              </PixelButton>
                            )}
                          </>
                        ) : savedResult ? (
                          <PixelButton variant="ghost" tone="red" size="sm" onClick={() => onTogglePendingDeletion(member.userId)}>
                            REMOVE
                          </PixelButton>
                        ) : (
                          <span className="font-pixel text-[10px] text-retro-muted py-1">NO CHANGES</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="p-3 bg-retro-bg border border-retro-border rounded mt-4 font-sans text-xs text-retro-text">
          <h4 className="font-pixel text-xs font-bold text-retro-text mb-1">EXPLANATION OF STANDINGS UPDATE ACTIONS</h4>
          <ul className="list-disc list-inside space-y-1 text-retro-muted">
            <li><strong>Conduct Penalties</strong> - Click on a participant or the "Penalty" button to launch the penalty dialogue for DSQ, DNF, DNS, Position Reduction PEN (POS-x), or Points Reduction PEN (PTS-x).</li>
            <li><strong>Staging Changes</strong> - Edits to the standings are compiled locally. Highlighting shows which rows have modified values or are pending deletion.</li>
            <li><strong>Smart Save Standings</strong> - The system analyzes your edits and executes the safest, most performant update automatically when you click "Save".</li>
          </ul>
        </div>
      </div>
    )
  }

  const inputStyle: React.CSSProperties = {
    padding: '4px 8px',
    border: '1px solid var(--borderColor-default, #d0d7de)',
    borderRadius: '6px',
    width: '100%',
    fontSize: '12px',
    backgroundColor: 'var(--bgColor-default, #ffffff)',
    color: 'var(--fgColor-default, #1f2328)',
  }

  return (
    <div>
      {penaltyTarget && (
        <PenaltyDialogue
          variant="primer"
          participantName={penaltyTarget.name}
          currentStatus={penaltyTarget.currentStatus}
          onApply={(newStatus) => {
            onResultChange(penaltyTarget.userId, 'resultStatus', newStatus)
            setPenaltyTarget(null)
          }}
          onClose={() => setPenaltyTarget(null)}
        />
      )}

      <div style={{ overflowX: 'auto', width: '100%', border: '1px solid var(--borderColor-default, #d0d7de)', borderRadius: '6px' }}>
        <table className="primer-table" style={{ minWidth: '1100px', width: '100%', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th scope="col" style={{ width: '160px' }}>Competitor</th>
              <th scope="col" style={{ width: '130px' }}>User ID</th>
              <th scope="col" style={{ width: '75px' }}>Draw</th>
              <th scope="col" style={{ width: '80px' }}>Position</th>
              <th scope="col" style={{ width: '80px' }}>Points</th>
              <th scope="col" style={{ width: '100px' }}>Finish Time</th>
              <th scope="col" style={{ width: '85px' }}>Behind</th>
              <th scope="col" style={{ width: '100px' }}>Passing Order</th>
              <th scope="col" style={{ width: '85px' }}>Final 3F</th>
              <th scope="col" style={{ width: '130px' }}>Outcome / Penalty</th>
              <th scope="col" style={{ width: '140px' }}>Status</th>
              <th scope="col" style={{ width: '130px' }}>Staged Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ member, savedResult, edit, rowState }) => {
              const isDeleted = rowState === 'pending_delete'
              const isModified = rowState === 'modified'
              const isNew = rowState === 'new'

              const details = userDetailsMap.get(member.userId)!

              return (
                <tr
                  key={member.userId}
                  style={{
                    backgroundColor: isDeleted
                      ? 'var(--bgColor-danger-muted, #ffebe9)'
                      : isModified
                      ? 'var(--bgColor-accent-muted, #ddf4ff)'
                      : isNew
                      ? 'var(--bgColor-success-muted, #dafbe1)'
                      : undefined,
                    textDecoration: isDeleted ? 'line-through' : 'none',
                    opacity: isDeleted ? 0.65 : 1,
                  }}
                >
                  <td>
                    <div
                      style={{ cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}
                      onClick={() => !isDeleted && setPenaltyTarget({ userId: member.userId, name: member.name, currentStatus: edit.resultStatus })}
                      title={`Click ${member.name} to issue penalty`}
                    >
                      <UserLink userId={member.userId} name={member.name} />
                    </div>
                  </td>
                  <td>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={member.userId}>
                      <code style={{ fontSize: '11px', color: 'var(--fgColor-muted, #636c76)' }}>{member.userId}</code>
                    </div>
                  </td>
                  <td>
                    <input
                      type="number"
                      placeholder="Draw"
                      value={edit.gateNumber}
                      onChange={(e) => onResultChange(member.userId, 'gateNumber', e.target.value)}
                      className="standings-input-no-spinner"
                      style={inputStyle}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      placeholder="None"
                      disabled={isDeleted || isRaceNotStarted}
                      value={edit.position}
                      onChange={(e) => onResultChange(member.userId, 'position', e.target.value)}
                      className="standings-input-no-spinner"
                      style={inputStyle}
                    />
                    {details.penaltyType === 'POS' && details.effectivePosition !== null && (
                      <div style={{ fontSize: '10px', color: 'var(--fgColor-danger, #d1242f)', fontWeight: 600, textAlign: 'center', marginTop: '2px' }} title={`Position demoted from ${details.physicalPosition} to ${details.effectivePosition}`}>
                        Demoted: Pos {details.effectivePosition}
                      </div>
                    )}
                  </td>
                  <td>
                    {scoringType === 1 ? (
                      <div style={{ fontWeight: 600, color: 'var(--fgColor-accent, #0969da)', fontSize: '13px', textAlign: 'center' }}>
                        {details.awardedPoints} pts
                        {details.hasPenalty && details.basePoints > 0 && details.basePoints !== details.awardedPoints && (
                          <span style={{ fontSize: '10px', color: 'var(--fgColor-muted, #636c76)', display: 'block', fontWeight: 400 }}>
                            ({details.basePoints} orig)
                          </span>
                        )}
                        {!details.hasPenalty && (
                          <span style={{ fontSize: '9px', color: 'var(--fgColor-muted, #636c76)', display: 'block', fontWeight: 400 }}>
                            (Auto)
                          </span>
                        )}
                      </div>
                    ) : (
                      <input
                        type="number"
                        placeholder="0"
                        disabled={isDeleted || isRaceNotStarted}
                        value={edit.points}
                        onChange={(e) => onResultChange(member.userId, 'points', e.target.value)}
                        className="standings-input-no-spinner"
                        style={inputStyle}
                      />
                    )}
                  </td>
                  <td>
                    <input
                      type="text"
                      placeholder="1:32.1"
                      disabled={isDeleted || isRaceNotStarted}
                      value={edit.finishTime}
                      onChange={(e) => onResultChange(member.userId, 'finishTime', e.target.value)}
                      style={inputStyle}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      placeholder="nose"
                      disabled={isDeleted || isRaceNotStarted}
                      value={edit.margin}
                      onChange={(e) => onResultChange(member.userId, 'margin', e.target.value)}
                      style={inputStyle}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      placeholder="3-2-1"
                      disabled={isDeleted || isRaceNotStarted}
                      value={edit.passingOrder}
                      onChange={(e) => onResultChange(member.userId, 'passingOrder', e.target.value)}
                      style={inputStyle}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      placeholder="34.5"
                      disabled={isDeleted || isRaceNotStarted}
                      value={edit.final3F}
                      onChange={(e) => onResultChange(member.userId, 'final3F', e.target.value)}
                      style={inputStyle}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      disabled={isDeleted}
                      onClick={() => setPenaltyTarget({ userId: member.userId, name: member.name, currentStatus: edit.resultStatus })}
                      style={{
                        padding: '4px 8px',
                        fontSize: '11px',
                        fontWeight: 600,
                        borderRadius: '6px',
                        border: '1px solid',
                        borderColor: edit.resultStatus ? 'var(--borderColor-danger-emphasis, #cf222e)' : 'var(--borderColor-default, #d0d7de)',
                        backgroundColor: edit.resultStatus ? 'var(--bgColor-danger-muted, #ffebe9)' : 'var(--bgColor-default, #ffffff)',
                        color: edit.resultStatus ? 'var(--fgColor-danger, #d1242f)' : 'var(--fgColor-default, #1f2328)',
                        cursor: isDeleted ? 'not-allowed' : 'pointer',
                        whiteSpace: 'nowrap',
                        width: '100%',
                        textAlign: 'center',
                      }}
                      title="Click to issue or edit penalty"
                    >
                      {edit.resultStatus ? edit.resultStatus : 'Issue Penalty'}
                    </button>
                  </td>
                  <td>
                    {isDeleted ? (
                      <span style={{ padding: '2px 8px', fontSize: '11px', fontWeight: 600, backgroundColor: '#cf222e', color: '#fff', borderRadius: '999px', display: 'inline-block' }}>
                        Pending Deletion
                      </span>
                    ) : isModified ? (
                      <span style={{ padding: '2px 8px', fontSize: '11px', fontWeight: 600, backgroundColor: '#0969da', color: '#fff', borderRadius: '999px', display: 'inline-block' }}>
                        Modified
                      </span>
                    ) : isNew ? (
                      <span style={{ padding: '2px 8px', fontSize: '11px', fontWeight: 600, backgroundColor: '#1f883d', color: '#fff', borderRadius: '999px', display: 'inline-block' }}>
                        New
                      </span>
                    ) : savedResult ? (
                      <span style={{ padding: '2px 8px', fontSize: '11px', fontWeight: 600, backgroundColor: savedResult.resultStatus === 'DEFERRED' ? '#636c76' : savedResult.resultStatus ? '#cf222e' : '#1f883d', color: '#fff', borderRadius: '999px', display: 'inline-block' }}>
                        {savedResult.resultStatus ? savedResult.resultStatus : isRaceNotStarted ? `Draw ${savedResult.gateNumber ?? 'n/a'}` : `Pos ${savedResult.position ?? 'n/a'} (${savedResult.points} pts)`}
                      </span>
                    ) : (
                      <span style={{ padding: '2px 8px', fontSize: '11px', fontWeight: 500, backgroundColor: 'var(--bgColor-muted, #f6f8fa)', color: 'var(--fgColor-muted, #636c76)', border: '1px solid var(--borderColor-default, #d0d7de)', borderRadius: '999px', display: 'inline-block' }}>
                        {isRaceNotStarted ? 'No draw' : 'Unrecorded'}
                      </span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {isDeleted ? (
                        <button
                          type="button"
                          onClick={() => onTogglePendingDeletion(member.userId)}
                          style={{ padding: '3px 8px', fontSize: '11px', fontWeight: 500, borderRadius: '6px', border: '1px solid var(--borderColor-default, #d0d7de)', backgroundColor: 'var(--bgColor-default, #ffffff)', color: 'var(--fgColor-default, #1f2328)', cursor: 'pointer', flexGrow: 1 }}
                        >
                          Restore
                        </button>
                      ) : isModified || isNew ? (
                        <>
                          <button
                            type="button"
                            onClick={() => onUndoRow(member.userId)}
                            style={{ padding: '3px 8px', fontSize: '11px', fontWeight: 500, borderRadius: '6px', border: '1px solid var(--borderColor-default, #d0d7de)', backgroundColor: 'var(--bgColor-default, #ffffff)', color: 'var(--fgColor-default, #1f2328)', cursor: 'pointer', flexGrow: 1 }}
                          >
                            Reset
                          </button>
                          {savedResult && (
                            <button
                              type="button"
                              onClick={() => onTogglePendingDeletion(member.userId)}
                              style={{ padding: '3px 8px', fontSize: '11px', fontWeight: 500, borderRadius: '6px', border: '1px solid rgba(31, 35, 40, 0.15)', backgroundColor: '#cf222e', color: '#fff', cursor: 'pointer' }}
                            >
                              Remove
                            </button>
                          )}
                        </>
                      ) : savedResult ? (
                        <button
                          type="button"
                          onClick={() => onTogglePendingDeletion(member.userId)}
                          style={{ padding: '3px 8px', fontSize: '11px', fontWeight: 500, borderRadius: '6px', border: '1px solid rgba(31, 35, 40, 0.15)', backgroundColor: '#cf222e', color: '#fff', cursor: 'pointer', flexGrow: 1 }}
                        >
                          Remove
                        </button>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--fgColor-muted, #636c76)', padding: '2px 4px' }}>
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

      <div
        style={{
          marginTop: '14px',
          backgroundColor: 'var(--bgColor-muted, #f6f8fa)',
          border: '1px solid var(--borderColor-default, #d0d7de)',
          borderRadius: '6px',
          padding: '12px 14px',
        }}
      >
        <h4 style={{ margin: '0 0 6px 0', fontSize: '12px', fontWeight: 600, color: 'var(--fgColor-default, #1f2328)' }}>
          Standings Update Guide
        </h4>
        <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: 'var(--fgColor-muted, #636c76)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <li><strong>Conduct Penalties</strong> — Click a participant or &quot;Issue Penalty&quot; to assign DSQ, DNF, DNS, Position Reduction (POS-x), or Points Reduction (PTS-x).</li>
          <li><strong>Staging Changes</strong> — Edits are tracked locally with row highlights until you click &quot;Save&quot;.</li>
          <li><strong>Smart Save Standings</strong> — Only modified or deleted entries are sent in batch on save.</li>
        </ul>
      </div>
    </div>
  )
}

interface PenaltyDialogueProps {
  variant?: 'pixel' | 'primer' | 'slds'
  participantName: string
  currentStatus: string
  onApply: (status: string) => void
  onClose: () => void
}

function PenaltyDialogue({
  variant = 'primer',
  participantName,
  currentStatus,
  onApply,
  onClose,
}: PenaltyDialogueProps) {
  const initialPenalty = parsePenaltyStatus(currentStatus)
  const [selectedType, setSelectedType] = useState<PenaltyType>(initialPenalty.type)
  const [amount, setAmount] = useState<number>(initialPenalty.amount ?? 3)

  const previewTag = formatPenaltyStatus(selectedType, amount)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onApply(previewTag)
  }

  if (variant === 'pixel') {
    return (
      <PixelModal open onClose={onClose} title="ISSUE CONDUCT PENALTY">
        <form onSubmit={handleSubmit} className="space-y-4 font-sans text-xs text-retro-text">
          <div>
            <span className="font-pixel text-xs text-retro-muted">PARTICIPANT: </span>
            <strong className="font-pixel text-xs text-retro-text">{participantName}</strong>
          </div>

          <div>
            <label className="block font-pixel text-xs text-retro-text mb-2">PENALTY TYPE</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { type: 'NONE', label: 'None (Clear Penalty)' },
                { type: 'DSQ', label: 'Disqualification (DSQ)' },
                { type: 'DNF', label: 'Did Not Finish (DNF)' },
                { type: 'DNS', label: 'Did Not Start (DNS)' },
                { type: 'DEFERRED', label: 'Deferred (DEFERRED)' },
                { type: 'POS', label: 'Position Reduction' },
                { type: 'PTS', label: 'Points Reduction' },
              ].map(({ type, label }) => (
                <label
                  key={type}
                  className={`flex items-center gap-2 p-2 rounded border cursor-pointer ${
                    selectedType === type
                      ? 'border-retro-primary bg-retro-bg font-bold'
                      : 'border-retro-border bg-retro-surface hover:border-retro-muted'
                  }`}
                >
                  <input
                    type="radio"
                    name="penaltyTypePixel"
                    value={type}
                    checked={selectedType === type}
                    onChange={() => setSelectedType(type as PenaltyType)}
                    className="accent-retro-primary"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>

          {(selectedType === 'POS' || selectedType === 'PTS') && (
            <div className="p-3 bg-retro-bg border border-retro-border rounded space-y-1">
              <label className="block font-pixel text-xs text-retro-text mb-1">
                {selectedType === 'POS' ? 'POSITIONS TO DEMOTE' : 'POINTS TO DEDUCT'}
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={amount}
                onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full px-3 py-1.5 bg-retro-surface border border-retro-border rounded font-sans text-xs text-retro-text focus:outline-none focus:border-retro-primary"
              />
            </div>
          )}

          <div className="flex justify-between items-center p-3 bg-retro-bg border border-retro-border rounded">
            <span className="font-pixel text-xs text-retro-muted">RESULT STATUS BADGE:</span>
            <PixelBadge tone={previewTag ? 'pink' : 'neutral'}>
              {previewTag || 'Normal (No Penalty)'}
            </PixelBadge>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-retro-border">
            <PixelButton variant="ghost" tone="neutral" onClick={onClose}>
              CANCEL
            </PixelButton>
            <PixelButton variant="solid" tone="purple" type="submit">
              APPLY PENALTY
            </PixelButton>
          </div>
        </form>
      </PixelModal>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(27, 31, 36, 0.5)' }}
      />

      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'relative',
          width: '90%',
          maxWidth: '480px',
          backgroundColor: 'var(--bgColor-default, #ffffff)',
          border: '1px solid var(--borderColor-default, #d0d7de)',
          borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(140, 149, 159, 0.25)',
          overflow: 'hidden',
          zIndex: 10001,
        }}
      >
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--borderColor-default, #d0d7de)', backgroundColor: 'var(--bgColor-muted, #f6f8fa)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--fgColor-default, #1f2328)' }}>
              Issue Penalty / Conduct Violation
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--fgColor-muted, #636c76)' }}>
              Participant: <strong>{participantName}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: 'var(--fgColor-muted, #636c76)', padding: '0 4px' }}
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--fgColor-default, #1f2328)', marginBottom: '8px' }}>
                Penalty Type
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {[
                  { type: 'NONE', label: 'None (Clear Penalty)' },
                  { type: 'DSQ', label: 'Disqualification (DSQ)' },
                  { type: 'DNF', label: 'Did Not Finish (DNF)' },
                  { type: 'DNS', label: 'Did Not Start (DNS)' },
                  { type: 'DEFERRED', label: 'Deferred (DEFERRED)' },
                  { type: 'POS', label: 'Position Reduction' },
                  { type: 'PTS', label: 'Points Reduction' },
                ].map(({ type, label }) => (
                  <label
                    key={type}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: selectedType === type ? '1px solid var(--borderColor-accent-emphasis, #0969da)' : '1px solid var(--borderColor-default, #d0d7de)',
                      backgroundColor: selectedType === type ? 'var(--bgColor-accent-muted, #ddf4ff)' : 'var(--bgColor-default, #ffffff)',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: selectedType === type ? 600 : 400,
                      color: selectedType === type ? 'var(--fgColor-accent, #0969da)' : 'var(--fgColor-default, #1f2328)',
                    }}
                  >
                    <input
                      type="radio"
                      name="penaltyType"
                      value={type}
                      checked={selectedType === type}
                      onChange={() => setSelectedType(type as PenaltyType)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            {(selectedType === 'POS' || selectedType === 'PTS') && (
              <div style={{ backgroundColor: 'var(--bgColor-muted, #f6f8fa)', padding: '12px', borderRadius: '6px', border: '1px solid var(--borderColor-default, #d0d7de)' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--fgColor-default, #1f2328)', marginBottom: '6px' }}>
                  {selectedType === 'POS' ? 'Position Penalty Amount (positions to demote)' : 'Points Penalty Amount (points to deduct)'}
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={amount}
                  onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  style={{ width: '100%', padding: '5px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--borderColor-default, #d0d7de)' }}
                />
              </div>
            )}

            <div style={{ backgroundColor: 'var(--bgColor-muted, #f6f8fa)', padding: '10px 14px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--fgColor-muted, #636c76)', fontWeight: 500 }}>Result Status Badge:</span>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '999px',
                  backgroundColor: previewTag ? 'var(--bgColor-danger-muted, #ffebe9)' : 'var(--bgColor-neutral-muted, #eaeef2)',
                  color: previewTag ? 'var(--fgColor-danger, #d1242f)' : 'var(--fgColor-muted, #636c76)',
                }}
              >
                {previewTag || 'Normal (No Penalty)'}
              </span>
            </div>
          </div>

          <div style={{ padding: '12px 18px', borderTop: '1px solid var(--borderColor-default, #d0d7de)', backgroundColor: 'var(--bgColor-muted, #f6f8fa)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '5px 14px', fontSize: '13px', fontWeight: 500, borderRadius: '6px', border: '1px solid var(--borderColor-default, #d0d7de)', backgroundColor: 'var(--bgColor-default, #ffffff)', color: 'var(--fgColor-default, #1f2328)', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{ padding: '5px 14px', fontSize: '13px', fontWeight: 600, borderRadius: '6px', border: '1px solid rgba(31, 35, 40, 0.15)', backgroundColor: 'var(--bgColor-success-emphasis, #1f883d)', color: '#ffffff', cursor: 'pointer' }}
            >
              Apply
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
