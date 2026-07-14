import type { eventmanager } from '../lib/client'
import type { ChangeSummary, DerivedRow, EditedResult } from '../lib/standings'
import { AlertBanner } from './AlertBanner'

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
              Assign finishes for registered event participants. Status: {isRaceNotStarted ? 'Not Started' : isRaceOngoing ? 'Ongoing (Live - Provisional Saving Allowed)' : 'Concluded'}
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
          {!isRaceNotStarted && (
            <button
              type="button"
              onClick={onSave}
              disabled={savingBatch || loadingResults || changeSummary.totalCount === 0}
              className={`slds-button ${changeSummary.totalCount > 0 ? 'slds-button_brand' : 'slds-button_neutral'}`}
              style={{ padding: '6px 16px', fontSize: '13px', fontWeight: 'bold' }}
              title={isRaceOngoing ? 'Save provisional standings' : 'Save final standings'}
            >
              {savingBatch ? 'Saving...' : `Save (${changeSummary.totalCount})`}
            </button>
          )}
        </div>
      </div>

      <div className="slds-card__body" style={{ padding: '16px' }}>
        {isRaceNotStarted ? (
          <div className="slds-align_absolute-center slds-p-around_large text-slate-500" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '200px', textAlign: 'center' }}>
            <h3 className="slds-text-heading_medium font-bold text-slate-700" style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>
              Race Has Not Started Yet
            </h3>
            <p className="slds-text-body_regular text-slate-500 slds-m-top_small" style={{ maxWidth: '400px', marginBottom: '16px' }}>
              Standings and finish times can only be recorded once the race has officially started. Use the "Start Race" button above in the Race Details card to begin tracking results.
            </p>
          </div>
        ) : (
          <>
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
              />
            )}
          </>
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
}

function StandingsTable({ rows, onResultChange, onTogglePendingDeletion, onUndoRow }: StandingsTableProps) {
  return (
    <div>
      <div style={{ overflowX: 'auto', width: '100%' }}>
        <table className="slds-table slds-table_cell-buffer slds-table_bordered" style={{ border: '1px solid #dddbda', minWidth: '100%' }}>
          <thead>
          <tr className="slds-line-height_reset" style={{ background: '#f3f2f1' }}>
            <th scope="col" style={{ fontWeight: 'bold' }}><div className="slds-truncate">Competitor Name</div></th>
            <th scope="col" style={{ fontWeight: 'bold' }}><div className="slds-truncate">User ID</div></th>
            <th scope="col" style={{ fontWeight: 'bold', width: '90px' }}><div className="slds-truncate">Draw</div></th>
            <th scope="col" style={{ fontWeight: 'bold', width: '90px' }}><div className="slds-truncate">Position</div></th>
            <th scope="col" style={{ fontWeight: 'bold', width: '90px' }}><div className="slds-truncate">Points</div></th>
            <th scope="col" style={{ fontWeight: 'bold', width: '110px' }}><div className="slds-truncate">Finish Time</div></th>
            <th scope="col" style={{ fontWeight: 'bold', width: '90px' }}><div className="slds-truncate">Behind</div></th>
            <th scope="col" style={{ fontWeight: 'bold', width: '100px' }}><div className="slds-truncate">Passing Order</div></th>
            <th scope="col" style={{ fontWeight: 'bold', width: '90px' }}><div className="slds-truncate">Final 3F</div></th>
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
                  <span className="font-bold text-slate-800" style={{ fontWeight: 'bold' }}>{member.name}</span>
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
                        type="number"
                        placeholder="None"
                        disabled={isDeleted}
                        value={edit.position}
                        onChange={(e) => onResultChange(member.userId, 'position', e.target.value)}
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
                        type="number"
                        placeholder="0"
                        disabled={isDeleted}
                        value={edit.points}
                        onChange={(e) => onResultChange(member.userId, 'points', e.target.value)}
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
                        placeholder="1:32.1"
                        disabled={isDeleted}
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
                        disabled={isDeleted}
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
                        disabled={isDeleted}
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
                        disabled={isDeleted}
                        value={edit.final3F}
                        onChange={(e) => onResultChange(member.userId, 'final3F', e.target.value)}
                        className="slds-input"
                        style={{ padding: '4px 8px', border: '1px solid #dddbda', borderRadius: '4px' }}
                      />
                    </div>
                  </div>
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
                    <span className="slds-badge slds-theme_success" style={{ padding: '2px 8px', background: '#2e7d32', color: '#fff', borderRadius: '4px' }}>
                      Saved (Pos: {savedResult.position ?? 'n/a'}, Pts: {savedResult.points})
                    </span>
                  ) : (
                    <span className="slds-badge slds-theme_light" style={{ padding: '2px 8px', background: '#e0e0e0', color: '#555', borderRadius: '4px' }}>
                      No result recorded
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
          <li className="text-slate-600" style={{ fontSize: '12px' }}><strong>Staging Changes</strong> - Edits to the standings are compiled locally. Highlighting shows which rows have modified values or are pending deletion.</li>
          <li className="text-slate-600" style={{ fontSize: '12px' }}><strong>Smart Save Standings</strong> - The system analyzes your edits and executes the safest, most performant update automatically:
            <ul style={{ paddingLeft: '1.25rem', marginTop: '2px', listStyleType: 'circle' }}>
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
