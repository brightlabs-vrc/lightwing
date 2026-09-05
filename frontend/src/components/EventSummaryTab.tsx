import type { eventmanager } from '../lib/client'
import { GradePointsPreview } from './GradePointsPreview'
import styles from './EventSummaryTab.module.css'
import { DEFAULT_SCORING_TABLES } from '../lib/scoringDefaults'
import { UserLink } from './UserLink'

interface EventSummaryTabProps {
  selectedEvent: eventmanager.EventDetail
}

import { formatLocalDateTime } from '../lib/datetime'

export function EventSummaryTab({ selectedEvent }: EventSummaryTabProps) {
  return (
    <div className="slds-tabs_default__content slds-show slds-p-vertical_medium" style={{ paddingTop: '1.5rem' }}>
      <div className={styles.summaryGrid}>
        {selectedEvent.scheduledAt && (
          <div>
            <p className={styles.titleCaps}>Scheduled Time</p>
            <p className={styles.bodyRegular}>
              <time dateTime={selectedEvent.scheduledAt}>
                <strong>{formatLocalDateTime(selectedEvent.scheduledAt)}</strong>
              </time>
            </p>
          </div>
        )}
        <div>
          <p className={styles.titleCaps}>Description</p>
          <p className={styles.bodyRegular}>
            {selectedEvent.description ?? 'No description registered.'}
          </p>
        </div>
        <div>
          <p className={styles.titleCaps}>Scoring Configuration</p>
          <p className={styles.bodyRegular}>
            Scoring Mode: <strong>{selectedEvent.scoringTypeLabel}</strong> ({selectedEvent.scoringType === 1 ? 'Points aggregation' : 'Ladder Rating (ELO)'}) <br />
            {selectedEvent.scoringType === 1 && (
              <>
                Rules Source: <strong>{selectedEvent.scoringRulesMode || 'STANDARD'}</strong>
              </>
            )}
          </p>
        </div>
        <div>
          <p className={styles.titleCaps}>Owner Parameters</p>
          <p className={styles.bodyRegular}>
            Ownership Type: {selectedEvent.ownerType} <br />
            ID: {selectedEvent.organizationId ?? selectedEvent.ownerUserId}
          </p>
        </div>
        <div>
          <p className={styles.titleCaps}>Class restriction</p>
          <p className={styles.bodyRegular}>
            Tier Restriction: <strong>{selectedEvent.classRestriction ?? 'PRE_OP (Any tier eligibility)'}</strong>
          </p>
        </div>
        <div>
          <p className={styles.titleCaps}>Participation Model</p>
          <p className={styles.bodyRegular}>
            Granular Per-Race Participation: <strong>{selectedEvent.granularParticipation ? 'Enabled (Per-Race registration required)' : 'Disabled (Event-wide registration)'}</strong>
          </p>
        </div>
        <div>
          <p className={styles.titleCaps}>Signups Status</p>
          <p className={styles.bodyRegular}>
            Signups Lock: <strong>{selectedEvent.signupsLocked ? 'Locked (Self-service signups disabled)' : 'Open (Self-service signups enabled)'}</strong>
          </p>
        </div>
      </div>

      {selectedEvent.scoringType === 1 && (
        <div className={styles.tablesSection}>
          <h3 className={styles.tablesHeader}>
            Event Points Scoring Configuration Tables
          </h3>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {['OP', 'GIII', 'GII', 'GI'].map((grade) => {
              const table = (selectedEvent.scoringRulesMode === 'CUSTOM' && selectedEvent.customScoringTables)
                ? ((selectedEvent.customScoringTables as Record<string, Record<number, number>>)[grade] || DEFAULT_SCORING_TABLES[grade])
                : DEFAULT_SCORING_TABLES[grade];
              return <GradePointsPreview key={grade} grade={grade} table={table} />;
            })}
          </div>
        </div>
      )}

      {/* Standings overview aggregates block */}
      <div className={styles.leaderboardSection}>
        <h3 className={styles.leaderboardHeader}>
          Current Event Overall Leaderboard
        </h3>
        {selectedEvent.scoringType === 1 ? (
          selectedEvent.pointsOverview && selectedEvent.pointsOverview.length > 0 ? (
            <table className={`slds-table slds-table_cell-buffer slds-table_bordered ${styles.leaderboardTable}`}>
              <thead>
                <tr className="slds-line-height_reset" style={{ background: '#f3f2f1' }}>
                  <th scope="col" style={{ fontWeight: 'bold' }}><div className="slds-truncate">Rank</div></th>
                  <th scope="col" style={{ fontWeight: 'bold' }}><div className="slds-truncate">Name</div></th>
                  <th scope="col" style={{ fontWeight: 'bold' }}><div className="slds-truncate">User ID</div></th>
                  <th scope="col" style={{ fontWeight: 'bold' }}><div className="slds-truncate">Total Points</div></th>
                </tr>
              </thead>
              <tbody>
                {selectedEvent.pointsOverview.map((item, idx) => (
                  <tr key={item.userId} className="slds-hint-parent">
                    <td><strong>{idx + 1}</strong></td>
                    <td><UserLink userId={item.userId} name={item.name} /></td>
                    <td><code className="text-xs">{item.userId}</code></td>
                    <td><strong>{item.points} pts</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="slds-text-body_small text-slate-500">No participants score standings loaded.</p>
          )
        ) : (
          selectedEvent.ladderOverview && selectedEvent.ladderOverview.length > 0 ? (
            <table className={`slds-table slds-table_cell-buffer slds-table_bordered ${styles.leaderboardTable}`}>
              <thead>
                <tr className="slds-line-height_reset" style={{ background: '#f3f2f1' }}>
                  <th scope="col" style={{ fontWeight: 'bold' }}><div className="slds-truncate">Rank</div></th>
                  <th scope="col" style={{ fontWeight: 'bold' }}><div className="slds-truncate">Name</div></th>
                  <th scope="col" style={{ fontWeight: 'bold' }}><div className="slds-truncate">Rating (ELO)</div></th>
                  <th scope="col" style={{ fontWeight: 'bold' }}><div className="slds-truncate">Wins / Losses</div></th>
                </tr>
              </thead>
              <tbody>
                {selectedEvent.ladderOverview.map((item) => (
                  <tr key={item.userId} className="slds-hint-parent">
                    <td><strong>{item.rank}</strong></td>
                    <td><UserLink userId={item.userId} name={item.name} /></td>
                    <td><strong>{item.elo}</strong></td>
                    <td>{item.wins}W - {item.losses}L</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="slds-text-body_small text-slate-500">No ladder match results computed yet.</p>
          )
        )}
      </div>
    </div>
  )
}
