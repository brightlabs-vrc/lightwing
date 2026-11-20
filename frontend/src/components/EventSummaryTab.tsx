import type { eventmanager } from '../lib/client'
import { GradePointsPreview } from './GradePointsPreview'
import { DEFAULT_SCORING_TABLES } from '../lib/scoringDefaults'
import { UserLink } from './UserLink'
import { MarkdownView } from './MarkdownView'
import { formatLocalDateTime } from '../lib/datetime'

interface EventSummaryTabProps {
  selectedEvent: eventmanager.EventDetail
}

export function EventSummaryTab({ selectedEvent }: EventSummaryTabProps) {
  return (
    <div style={{ paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Key Metadata Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
        }}
      >
        {selectedEvent.scheduledAt && (
          <div className="primer-box" style={{ padding: '12px 14px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--fgColor-muted, #636c76)', marginBottom: '4px' }}>
              Scheduled Time
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--fgColor-default, #1f2328)' }}>
              <time dateTime={selectedEvent.scheduledAt}>{formatLocalDateTime(selectedEvent.scheduledAt)}</time>
            </div>
          </div>
        )}

        <div className="primer-box" style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--fgColor-muted, #636c76)', marginBottom: '4px' }}>
            Scoring Configuration
          </div>
          <div style={{ fontSize: '13px', color: 'var(--fgColor-default, #1f2328)' }}>
            Mode: <strong>{selectedEvent.scoringTypeLabel}</strong> ({selectedEvent.scoringType === 1 ? 'Points aggregation' : 'Ladder Rating (ELO)'})
            {selectedEvent.scoringType === 1 && (
              <div style={{ marginTop: '2px', fontSize: '12px', color: 'var(--fgColor-muted, #636c76)' }}>
                Rules Source: <strong>{selectedEvent.scoringRulesMode || 'STANDARD'}</strong>
              </div>
            )}
          </div>
        </div>

        <div className="primer-box" style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--fgColor-muted, #636c76)', marginBottom: '4px' }}>
            Owner Parameters
          </div>
          <div style={{ fontSize: '13px', color: 'var(--fgColor-default, #1f2328)' }}>
            Type: <strong>{selectedEvent.ownerType}</strong>
            <div style={{ marginTop: '2px', fontSize: '12px', color: 'var(--fgColor-muted, #636c76)', wordBreak: 'break-all' }}>
              ID: <code>{selectedEvent.organizationId ?? selectedEvent.ownerUserId}</code>
            </div>
          </div>
        </div>

        <div className="primer-box" style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--fgColor-muted, #636c76)', marginBottom: '4px' }}>
            Class Restriction
          </div>
          <div style={{ fontSize: '13px', color: 'var(--fgColor-default, #1f2328)' }}>
            Tier: <strong>{selectedEvent.classRestriction ?? 'Any tier eligibility'}</strong>
          </div>
        </div>

        <div className="primer-box" style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--fgColor-muted, #636c76)', marginBottom: '4px' }}>
            Participation Model
          </div>
          <div style={{ fontSize: '13px', color: 'var(--fgColor-default, #1f2328)' }}>
            <strong>{selectedEvent.granularParticipation ? 'Granular (Per-Race registration)' : 'Event-wide registration'}</strong>
          </div>
        </div>

        <div className="primer-box" style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--fgColor-muted, #636c76)', marginBottom: '4px' }}>
            Signups Status
          </div>
          <div style={{ fontSize: '13px', color: 'var(--fgColor-default, #1f2328)' }}>
            <strong>{selectedEvent.signupsLocked ? 'Locked (Self-service disabled)' : 'Open (Self-service enabled)'}</strong>
          </div>
        </div>

        <div className="primer-box" style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--fgColor-muted, #636c76)', marginBottom: '4px' }}>
            Competition Format
          </div>
          <div style={{ fontSize: '13px', color: 'var(--fgColor-default, #1f2328)' }}>
            <strong>{selectedEvent.isTeamEvent ? 'Team-Based Event' : 'Individual Event'}</strong>
            {selectedEvent.isTeamEvent && (
              <div style={{ marginTop: '2px', fontSize: '12px', color: 'var(--fgColor-muted, #636c76)' }}>
                Roster Limits: Primary{' '}
                <strong>{selectedEvent.maxPrimaryRosterSize ?? 'Unlimited'}</strong> · Backup{' '}
                <strong>{selectedEvent.maxBackupRosterSize ?? 'Unlimited'}</strong>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="primer-box">
        <div className="primer-box-header">
          <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 600 }}>Description</h3>
        </div>
        <div style={{ padding: '14px 16px' }}>
          <MarkdownView content={selectedEvent.description} fallbackText="No description registered." />
        </div>
      </div>

      {/* Points Scoring Tables */}
      {selectedEvent.scoringType === 1 && (
        <div>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 600, color: 'var(--fgColor-default, #1f2328)' }}>
            Event Points Scoring Configuration Tables
          </h3>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {['OP', 'GIII', 'GII', 'GI'].map((grade) => {
              const table =
                selectedEvent.scoringRulesMode === 'CUSTOM' && selectedEvent.customScoringTables
                  ? (selectedEvent.customScoringTables as Record<string, Record<number, number>>)[grade] || DEFAULT_SCORING_TABLES[grade]
                  : DEFAULT_SCORING_TABLES[grade]
              return <GradePointsPreview key={grade} grade={grade} table={table} />
            })}
          </div>
        </div>
      )}

      {/* Team Standings */}
      {selectedEvent.isTeamEvent && selectedEvent.scoringType === 1 && (
        <div className="primer-box">
          <div className="primer-box-header">
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Team Standings</h3>
          </div>
          {selectedEvent.teamPointsOverview && selectedEvent.teamPointsOverview.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="primer-table" style={{ tableLayout: 'fixed', minWidth: '520px' }}>
                <thead>
                  <tr>
                    <th scope="col" style={{ width: '70px' }}>Rank</th>
                    <th scope="col" style={{ width: '45%' }}>Team</th>
                    <th scope="col" style={{ width: '20%' }}>Roster Size</th>
                    <th scope="col" style={{ width: '130px' }}>Total Points</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedEvent.teamPointsOverview.map((team, idx) => (
                    <tr key={team.teamId}>
                      <td><strong>#{idx + 1}</strong></td>
                      <td>
                        <strong>{team.name}</strong>{' '}
                        <code style={{ fontSize: '11px', color: 'var(--fgColor-muted, #636c76)' }}>@{team.slug}</code>
                      </td>
                      <td>{team.memberCount}</td>
                      <td><strong>{team.points} pts</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ margin: 0, padding: '16px', fontSize: '13px', color: 'var(--fgColor-muted, #636c76)' }}>
              No team standings recorded yet.
            </p>
          )}
        </div>
      )}

      {/* Individual Standings */}
      <div className="primer-box">
        <div className="primer-box-header">
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>
            {selectedEvent.isTeamEvent ? 'Individual Standings' : 'Current Event Overall Leaderboard'}
          </h3>
        </div>
        {selectedEvent.scoringType === 1 ? (
          selectedEvent.pointsOverview && selectedEvent.pointsOverview.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="primer-table" style={{ tableLayout: 'fixed', minWidth: '520px' }}>
                <thead>
                  <tr>
                    <th scope="col" style={{ width: '70px' }}>Rank</th>
                    <th scope="col" style={{ width: selectedEvent.isTeamEvent ? '32%' : '40%' }}>Name</th>
                    {selectedEvent.isTeamEvent && <th scope="col" style={{ width: '25%' }}>Team</th>}
                    <th scope="col" style={{ width: selectedEvent.isTeamEvent ? '22%' : '35%' }}>User ID</th>
                    <th scope="col" style={{ width: '120px' }}>Total Points</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedEvent.pointsOverview.map((item, idx) => (
                    <tr key={item.userId}>
                      <td><strong>#{idx + 1}</strong></td>
                      <td>
                        <UserLink userId={item.userId} name={item.name} />
                      </td>
                      {selectedEvent.isTeamEvent && (
                        <td>
                          {item.teamName ? (
                            <span>
                              {item.teamName}{' '}
                              {item.rosterRole && (
                                <code style={{ fontSize: '10px', color: 'var(--fgColor-muted, #636c76)' }}>
                                  ({item.rosterRole})
                                </code>
                              )}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--fgColor-muted, #636c76)' }}>—</span>
                          )}
                        </td>
                      )}
                      <td>
                        <code style={{ fontSize: '12px', color: 'var(--fgColor-muted, #636c76)' }}>{item.userId}</code>
                      </td>
                      <td><strong>{item.points} pts</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ margin: 0, padding: '16px', fontSize: '13px', color: 'var(--fgColor-muted, #636c76)' }}>
              No participant score standings loaded yet.
            </p>
          )
        ) : selectedEvent.ladderOverview && selectedEvent.ladderOverview.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="primer-table" style={{ tableLayout: 'fixed', minWidth: '520px' }}>
              <thead>
                <tr>
                  <th scope="col" style={{ width: '70px' }}>Rank</th>
                  <th scope="col" style={{ width: '45%' }}>Name</th>
                  <th scope="col" style={{ width: '130px' }}>Rating (ELO)</th>
                  <th scope="col" style={{ width: '130px' }}>Wins / Losses</th>
                </tr>
              </thead>
              <tbody>
                {selectedEvent.ladderOverview.map((item) => (
                  <tr key={item.userId}>
                    <td><strong>#{item.rank}</strong></td>
                    <td>
                      <UserLink userId={item.userId} name={item.name} />
                    </td>
                    <td><strong>{item.elo}</strong></td>
                    <td>{item.wins}W – {item.losses}L</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ margin: 0, padding: '16px', fontSize: '13px', color: 'var(--fgColor-muted, #636c76)' }}>
            No ladder match results computed yet.
          </p>
        )}
      </div>
    </div>
  )
}
