import { useState } from 'react'
import type { eventmanager } from '../lib/client'
import {
  parsePenaltyStatus,
  formatPenaltyStatus,
  type PenaltyType,
  type ChangeSummary,
  type DerivedRow,
  type EditedResult,
} from '../lib/standings'
import { AlertBanner } from './AlertBanner'
import { UserLink } from './UserLink'
import { DEFAULT_SCORING_TABLES } from '../lib/scoringDefaults'

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
    <article
      className={`slds-card ${noTopMargin ? '' : 'slds-m-top_large'}`}
      style={{ border: '2px solid #0176d3', borderRadius: '4px', background: '#f8fafc', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}
    >
      <div
        className="slds-card__header slds-grid slds-grid_align-spread"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f1f5f9', padding: '12px 16px', borderBottom: '1px solid #dddbda' }}
      >
        <header className="slds-media slds-media_center slds-has-flexi-truncate">
          <div className="slds-media__body">
            <h2 className="slds-card__header-title">
              <span className="slds-card__header-link slds-truncate font-bold text-slate-800" style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                Standings Grid: {raceName}
              </span>
            </h2>
            <p className="slds-text-body_small text-slate-500" style={{ fontSize: '11px' }}>
              Assign finishes for registered event participants. Click on a participant or Penalty button to issue conduct penalties. Status: {isRaceNotStarted ? 'Not Started' : isRaceOngoing ? 'Ongoing (Live - Provisional Saving Allowed)' : 'Concluded'}
            </p>
          </div>
        </header>

        <div style={{ display: 'flex', gap: '8px' }}>
          {!isRaceNotStarted && !isRaceOngoing && (
            <button
              type="button"
              onClick={onInferTimes}
              disabled={savingBatch || loadingResults}
              className="slds-button slds-button_neutral"
              style={{ padding: '6px 16px', fontSize: '13px', fontWeight: 'bold' }}
              title="Fill in missing finish times from the leader's time plus each horse's margin/length"
            >
              Infer Times
            </button>
          )}
          <button
            type="button"
            onClick={onCancel}
            disabled={savingBatch || loadingResults}
            className="slds-button slds-button_neutral"
            style={{ padding: '6px 16px', fontSize: '13px', fontWeight: 'bold' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={savingBatch || loadingResults || changeSummary.totalCount === 0}
            className={`slds-button ${changeSummary.totalCount > 0 ? 'slds-button_brand' : 'slds-button_neutral'}`}
            style={{ padding: '6px 16px', fontSize: '13px', fontWeight: 'bold' }}
            title={isRaceNotStarted ? 'Save draw numbers' : isRaceOngoing ? 'Save provisional standings' : 'Save final standings'}
          >
            {savingBatch ? 'Saving...' : isRaceNotStarted ? `Save Draw Numbers (${changeSummary.totalCount})` : `Save (${changeSummary.totalCount})`}
          </button>
        </div>
      </div>

      <div className="slds-card__body" style={{ padding: '16px' }}>
        {isRaceNotStarted && (
          <div className="slds-m-bottom_medium">
            <AlertBanner variant="warning">
              <span style={{ fontWeight: 'bold', fontSize: '12px' }}>
                Race has not started yet. You can set or edit the <strong>Draw (Gate Number)</strong> for each competitor below. Other finish-related fields will be enabled once the race starts.
              </span>
            </AlertBanner>
          </div>
        )}

        {isRaceOngoing && (
          <div className="slds-m-bottom_medium">
            <AlertBanner variant="warning">
              <span style={{ fontWeight: 'bold', fontSize: '12px', color: '#7c2d12' }}>
                Race is currently Ongoing (Live). You can save results now as <strong>Provisional Standings</strong>. You can still edit or finalize them once the race concludes.
              </span>
            </AlertBanner>
          </div>
        )}

        {changeSummary.totalCount > 0 && !isRaceOngoing && (
          <AlertBanner
            variant="warning"
            action={
              <button type="button" onClick={onResetAll} className="slds-button slds-button_neutral" style={{ padding: '2px 8px', fontSize: '10px' }}>
                Reset All
              </button>
            }
          >
            <span style={{ fontWeight: 'bold', fontSize: '12px' }}>
              Unsaved changes: {changeSummary.newCount > 0 && `${changeSummary.newCount} new, `}
              {changeSummary.modifiedCount > 0 && `${changeSummary.modifiedCount} modified, `}
              {changeSummary.deletedCount > 0 && `${changeSummary.deletedCount} pending deletion`}. Click "Save" above to submit.
            </span>
          </AlertBanner>
        )}

        {loadingResults ? (
          <p className="slds-text-body_medium text-slate-500">Loading race results data...</p>
        ) : memberCount === 0 ? (
          <div className="slds-align_absolute-center slds-p-around_large text-slate-500">
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
    </article>
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
  const [penaltyTarget, setPenaltyTarget] = useState<{ userId: string; name: string; currentStatus: string } | null>(null)

  const getPreviewPoints = (positionStr: string, resultStatus: string): number => {
    const statusUpper = (resultStatus || '').trim().toUpperCase()
    if (statusUpper === 'DSQ' || statusUpper === 'DNF' || statusUpper === 'DNS' || statusUpper === 'DEFERRED') {
      return 0
    }
    const position = parseInt(positionStr, 10)
    if (isNaN(position) || position < 1 || position > 10) return 0
    if (!raceGrade) return 0

    let basePoints = 0
    if (scoringRulesMode === 'CUSTOM' && customScoringTables && customScoringTables[raceGrade]) {
      basePoints = customScoringTables[raceGrade][position] ?? 0
    } else {
      basePoints = DEFAULT_SCORING_TABLES[raceGrade]?.[position] ?? 0
    }

    if (statusUpper.startsWith('PEN (POS-') && statusUpper.endsWith(')')) {
      const amtStr = statusUpper.slice('PEN (POS-'.length, -1).trim()
      const amt = parseInt(amtStr, 10) || 0
      const effectivePos = position + amt
      if (effectivePos > 10) return 0
      if (scoringRulesMode === 'CUSTOM' && customScoringTables && customScoringTables[raceGrade]) {
        return customScoringTables[raceGrade][effectivePos] ?? 0
      }
      return DEFAULT_SCORING_TABLES[raceGrade]?.[effectivePos] ?? 0
    }

    if (statusUpper.startsWith('PEN (PTS-') && statusUpper.endsWith(')')) {
      const amtStr = statusUpper.slice('PEN (PTS-'.length, -1).trim()
      const amt = parseInt(amtStr, 10) || 0
      return Math.max(0, basePoints - amt)
    }

    return basePoints
  }

  return (
    <div>
      {penaltyTarget && (
        <PenaltyDialogue
          participantName={penaltyTarget.name}
          currentStatus={penaltyTarget.currentStatus}
          onApply={(newStatus) => {
            onResultChange(penaltyTarget.userId, 'resultStatus', newStatus)
            setPenaltyTarget(null)
          }}
          onClose={() => setPenaltyTarget(null)}
        />
      )}

      <div style={{ overflowX: 'auto', width: '100%' }}>
        <table className="slds-table slds-table_cell-buffer slds-table_bordered" style={{ border: '1px solid #dddbda', minWidth: '100%' }}>
          <thead>
            <tr className="slds-line-height_reset" style={{ background: '#f3f2f1' }}>
              <th scope="col" style={{ fontWeight: 'bold' }}><div className="slds-truncate">Competitor Name</div></th>
              <th scope="col" style={{ fontWeight: 'bold' }}><div className="slds-truncate">User ID</div></th>
              <th scope="col" style={{ fontWeight: 'bold', width: '110px' }}><div className="slds-truncate">Draw</div></th>
              <th scope="col" style={{ fontWeight: 'bold', width: '90px' }}><div className="slds-truncate">Position</div></th>
              <th scope="col" style={{ fontWeight: 'bold', width: '90px' }}><div className="slds-truncate">Points</div></th>
              <th scope="col" style={{ fontWeight: 'bold', width: '110px' }}><div className="slds-truncate">Finish Time</div></th>
              <th scope="col" style={{ fontWeight: 'bold', width: '90px' }}><div className="slds-truncate">Behind</div></th>
              <th scope="col" style={{ fontWeight: 'bold', width: '100px' }}><div className="slds-truncate">Passing Order</div></th>
              <th scope="col" style={{ fontWeight: 'bold', width: '100px' }}><div className="slds-truncate">Final 3F</div></th>
              <th scope="col" style={{ fontWeight: 'bold', width: '130px' }}><div className="slds-truncate">Outcome / Penalty</div></th>
              <th scope="col" style={{ fontWeight: 'bold' }}><div className="slds-truncate">Status</div></th>
              <th scope="col" style={{ fontWeight: 'bold', width: '160px' }}><div className="slds-truncate">Staged Actions</div></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ member, savedResult, edit, rowState }) => {
              const isDeleted = rowState === 'pending_delete'
              const isModified = rowState === 'modified'
              const isNew = rowState === 'new'

              return (
                <tr
                  key={member.userId}
                  className="slds-hint-parent"
                  style={{
                    background: isDeleted ? '#fee2e2' : isModified ? '#eff6ff' : isNew ? '#f0fdf4' : 'transparent',
                    transition: 'background 0.2s',
                    textDecoration: isDeleted ? 'line-through' : 'none',
                    opacity: isDeleted ? 0.6 : 1,
                  }}
                >
                  <td>
                    <div
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                      onClick={() => !isDeleted && setPenaltyTarget({ userId: member.userId, name: member.name, currentStatus: edit.resultStatus })}
                      title="Click participant to issue penalty"
                    >
                      <UserLink userId={member.userId} name={member.name} />
                    </div>
                  </td>
                  <td>
                    <code className="text-xs">{member.userId}</code>
                  </td>
                  <td>
                    <div className="slds-form-element">
                      <div className="slds-form-element__control">
                        <input
                          type="number"
                          placeholder="Draw"
                          value={edit.gateNumber}
                          onChange={(e) => onResultChange(member.userId, 'gateNumber', e.target.value)}
                          className="slds-input standings-input-no-spinner"
                          style={{ padding: '4px 8px', border: '1px solid #dddbda', borderRadius: '4px' }}
                        />
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="slds-form-element">
                      <div className="slds-form-element__control">
                        <input
                          type="number"
                          placeholder="None"
                          disabled={isDeleted || isRaceNotStarted}
                          value={edit.position}
                          onChange={(e) => onResultChange(member.userId, 'position', e.target.value)}
                          className="slds-input standings-input-no-spinner"
                          style={{ padding: '4px 8px', border: '1px solid #dddbda', borderRadius: '4px' }}
                        />
                      </div>
                    </div>
                  </td>
                  <td>
                    {scoringType === 1 ? (
                      <div style={{ fontWeight: 'bold', color: '#0176d3', fontSize: '13px', textAlign: 'center' }}>
                        {getPreviewPoints(edit.position, edit.resultStatus)} pts <span style={{ fontSize: '9px', color: '#64748b', display: 'block' }}>(Auto)</span>
                      </div>
                    ) : (
                      <div className="slds-form-element">
                        <div className="slds-form-element__control">
                          <input
                            type="number"
                            placeholder="0"
                            disabled={isDeleted || isRaceNotStarted}
                            value={edit.points}
                            onChange={(e) => onResultChange(member.userId, 'points', e.target.value)}
                            className="slds-input standings-input-no-spinner"
                            style={{ padding: '4px 8px', border: '1px solid #dddbda', borderRadius: '4px' }}
                          />
                        </div>
                      </div>
                    )}
                  </td>
                  <td>
                    <div className="slds-form-element">
                      <div className="slds-form-element__control">
                        <input
                          type="text"
                          placeholder="1:32.1"
                          disabled={isDeleted || isRaceNotStarted}
                          value={edit.finishTime}
                          onChange={(e) => onResultChange(member.userId, 'finishTime', e.target.value)}
                          className="slds-input"
                          style={{ padding: '4px 8px', border: '1px solid #dddbda', borderRadius: '4px' }}
                        />
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="slds-form-element">
                      <div className="slds-form-element__control">
                        <input
                          type="text"
                          placeholder="nose"
                          disabled={isDeleted || isRaceNotStarted}
                          value={edit.margin}
                          onChange={(e) => onResultChange(member.userId, 'margin', e.target.value)}
                          className="slds-input"
                          style={{ padding: '4px 8px', border: '1px solid #dddbda', borderRadius: '4px' }}
                        />
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="slds-form-element">
                      <div className="slds-form-element__control">
                        <input
                          type="text"
                          placeholder="3-2-1"
                          disabled={isDeleted || isRaceNotStarted}
                          value={edit.passingOrder}
                          onChange={(e) => onResultChange(member.userId, 'passingOrder', e.target.value)}
                          className="slds-input"
                          style={{ padding: '4px 8px', border: '1px solid #dddbda', borderRadius: '4px' }}
                        />
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="slds-form-element">
                      <div className="slds-form-element__control">
                        <input
                          type="text"
                          placeholder="34.5"
                          disabled={isDeleted || isRaceNotStarted}
                          value={edit.final3F}
                          onChange={(e) => onResultChange(member.userId, 'final3F', e.target.value)}
                          className="slds-input"
                          style={{ padding: '4px 8px', border: '1px solid #dddbda', borderRadius: '4px' }}
                        />
                      </div>
                    </div>
                  </td>
                  <td>
                    <button
                      type="button"
                      disabled={isDeleted}
                      onClick={() => setPenaltyTarget({ userId: member.userId, name: member.name, currentStatus: edit.resultStatus })}
                      style={{
                        padding: '4px 8px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        borderRadius: '4px',
                        border: '1px solid',
                        borderColor: edit.resultStatus ? '#f87171' : '#cbd5e1',
                        backgroundColor: edit.resultStatus ? '#fef2f2' : '#ffffff',
                        color: edit.resultStatus ? '#dc2626' : '#475569',
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
                      <span className="slds-badge slds-theme_error" style={{ padding: '2px 8px', background: '#dc2626', color: '#fff', borderRadius: '4px' }}>
                        Pending Deletion
                      </span>
                    ) : isModified ? (
                      <span className="slds-badge slds-theme_warning" style={{ padding: '2px 8px', background: '#2563eb', color: '#fff', borderRadius: '4px' }}>
                        Modified (Unsaved)
                      </span>
                    ) : isNew ? (
                      <span className="slds-badge slds-theme_success" style={{ padding: '2px 8px', background: '#16a34a', color: '#fff', borderRadius: '4px' }}>
                        New (Unsaved)
                      </span>
                    ) : savedResult ? (
                      <span className="slds-badge slds-theme_success" style={{ padding: '2px 8px', background: savedResult.resultStatus === 'DEFERRED' ? '#64748b' : savedResult.resultStatus ? '#dc2626' : '#2e7d32', color: '#fff', borderRadius: '4px' }}>
                        {savedResult.resultStatus ? savedResult.resultStatus : isRaceNotStarted ? `Draw Assigned (${savedResult.gateNumber ?? 'n/a'})` : `Saved (Pos: ${savedResult.position ?? 'n/a'}, Pts: ${savedResult.points})`}
                      </span>
                    ) : (
                      <span className="slds-badge slds-theme_light" style={{ padding: '2px 8px', background: '#e0e0e0', color: '#555', borderRadius: '4px' }}>
                        {isRaceNotStarted ? 'No draw assigned' : 'No result recorded'}
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="slds-grid" style={{ display: 'flex', gap: '6px' }}>
                      {isDeleted ? (
                        <button
                          type="button"
                          onClick={() => onTogglePendingDeletion(member.userId)}
                          className="slds-button slds-button_neutral"
                          style={{ padding: '2px 8px', fontSize: '11px', flexGrow: 1 }}
                        >
                          Restore
                        </button>
                      ) : isModified || isNew ? (
                        <>
                          <button
                            type="button"
                            onClick={() => onUndoRow(member.userId)}
                            className="slds-button slds-button_neutral"
                            style={{ padding: '2px 8px', fontSize: '11px', flexGrow: 1 }}
                          >
                            Reset
                          </button>
                          {savedResult && (
                            <button
                              type="button"
                              onClick={() => onTogglePendingDeletion(member.userId)}
                              className="slds-button slds-button_destructive"
                              style={{ padding: '2px 8px', fontSize: '11px', background: '#dc2626', color: '#fff' }}
                            >
                              Remove
                            </button>
                          )}
                        </>
                      ) : savedResult ? (
                        <button
                          type="button"
                          onClick={() => onTogglePendingDeletion(member.userId)}
                          className="slds-button slds-button_destructive"
                          style={{ padding: '2px 8px', fontSize: '11px', background: '#dc2626', color: '#fff', flexGrow: 1 }}
                        >
                          Remove
                        </button>
                      ) : (
                        <span style={{ fontSize: '11px', color: '#888', fontStyle: 'italic', padding: '2px 8px' }}>
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

      <div className="slds-m-top_medium slds-box" style={{ background: '#f8fafc', border: '1px solid #dddbda', borderRadius: '4px', padding: '12px' }}>
        <h4 className="font-bold text-slate-800" style={{ fontWeight: 'bold' }}>Explanation of Standings update actions</h4>
        <ul style={{ paddingLeft: '1.25rem', marginTop: '4px' }}>
          <li className="text-slate-600" style={{ fontSize: '12px' }}><strong>Conduct Penalties</strong> - Click on a participant or the "Issue Penalty" button to launch the penalty dialogue for DSQ, DNF, DNS, Position Reduction PEN (POS-x), or Points Reduction PEN (PTS-x).</li>
          <li className="text-slate-600" style={{ fontSize: '12px' }}><strong>Staging Changes</strong> - Edits to the standings are compiled locally. Highlighting shows which rows have modified values or are pending deletion.</li>
          <li className="text-slate-600" style={{ fontSize: '12px' }}><strong>Smart Save Standings</strong> - The system analyzes your edits and executes the safest, most performant update automatically when you click "Save".</li>
        </ul>
      </div>
    </div>
  )
}

interface PenaltyDialogueProps {
  participantName: string
  currentStatus: string
  onApply: (status: string) => void
  onClose: () => void
}

function PenaltyDialogue({
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

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(2px)' }}
      />

      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'relative',
          width: '90%',
          maxWidth: '480px',
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2), 0 8px 10px -6px rgba(0,0,0,0.1)',
          overflow: 'hidden',
          zIndex: 10001,
        }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold', color: '#0f172a' }}>Issue Penalty / Conduct Violation</h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>Participant: <strong>{participantName}</strong></p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', fontSize: '20px', cursor: 'pointer', color: '#64748b', padding: '0 4px' }}
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#334155', marginBottom: '8px' }}>
                Penalty Type
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {[
                  { type: 'NONE', label: 'None (Clear Penalty)' },
                  { type: 'DSQ', label: 'Disqualification (DSQ)' },
                  { type: 'DNF', label: 'Did Not Finish (DNF)' },
                  { type: 'DNS', label: 'Did Not Start (DNS)' },
                  { type: 'POS', label: 'Position Reduction' },
                  { type: 'PTS', label: 'Points Reduction' },
                ].map(({ type, label }) => (
                  <label
                    key={type}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: selectedType === type ? '2px solid #0176d3' : '1px solid #cbd5e1',
                      backgroundColor: selectedType === type ? '#f0f9ff' : '#ffffff',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: selectedType === type ? 'bold' : 'normal',
                      color: selectedType === type ? '#0369a1' : '#334155',
                    }}
                  >
                    <input
                      type="radio"
                      name="penaltyType"
                      value={type}
                      checked={selectedType === type}
                      onChange={() => setSelectedType(type as PenaltyType)}
                      style={{ accentColor: '#0176d3' }}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            {(selectedType === 'POS' || selectedType === 'PTS') && (
              <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#334155', marginBottom: '6px' }}>
                  {selectedType === 'POS' ? 'Position Penalty Amount (positions to demote)' : 'Points Penalty Amount (points to deduct)'}
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={amount}
                  onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  style={{ width: '100%', padding: '6px 12px', fontSize: '13px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                />
              </div>
            )}

            <div style={{ backgroundColor: '#f1f5f9', padding: '10px 14px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#475569', fontWeight: '500' }}>Result Status Badge:</span>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 'bold',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  backgroundColor: previewTag ? '#fee2e2' : '#e2e8f0',
                  color: previewTag ? '#dc2626' : '#475569',
                }}
              >
                {previewTag || 'Normal (No Penalty)'}
              </span>
            </div>
          </div>

          <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              className="slds-button slds-button_neutral"
              style={{ padding: '6px 16px', fontSize: '13px', fontWeight: 'bold' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="slds-button slds-button_brand"
              style={{ padding: '6px 16px', fontSize: '13px', fontWeight: 'bold' }}
            >
              Apply
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
