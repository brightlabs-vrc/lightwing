import type { eventmanager } from '../lib/client'
import { GradePointsPreview } from './GradePointsPreview'
import { DEFAULT_SCORING_TABLES } from '../lib/scoringDefaults'
import { UserLink } from './UserLink'
import { Heading, Text, Label } from '@primer/react'
import { formatLocalDateTime } from '../lib/datetime'

interface EventSummaryTabProps {
  selectedEvent: eventmanager.EventDetail
}

export function EventSummaryTab({ selectedEvent }: EventSummaryTabProps) {
  return (
    <div style={{ paddingTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '1.5rem'
      }}>
        {selectedEvent.scheduledAt && (
          <div>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-fg-muted)', fontWeight: 'bold', display: 'block', marginBottom: '0.25rem' }}>Scheduled Time</span>
            <span style={{ fontSize: '14px' }}>
              <time dateTime={selectedEvent.scheduledAt}>
                <strong>{formatLocalDateTime(selectedEvent.scheduledAt)}</strong>
              </time>
            </span>
          </div>
        )}
        <div>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-fg-muted)', fontWeight: 'bold', display: 'block', marginBottom: '0.25rem' }}>Description</span>
          <span style={{ fontSize: '14px' }}>
            {selectedEvent.description ?? 'No description registered.'}
          </span>
        </div>
        <div>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-fg-muted)', fontWeight: 'bold', display: 'block', marginBottom: '0.25rem' }}>Scoring Configuration</span>
          <span style={{ fontSize: '14px', lineHeight: '1.5' }}>
            Scoring Mode: <strong>{selectedEvent.scoringTypeLabel}</strong> ({selectedEvent.scoringType === 1 ? 'Points aggregation' : 'Ladder Rating (ELO)'}) <br />
            {selectedEvent.scoringType === 1 && (
              <>
                Rules Source: <strong>{selectedEvent.scoringRulesMode || 'STANDARD'}</strong>
              </>
            )}
          </span>
        </div>
        <div>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-fg-muted)', fontWeight: 'bold', display: 'block', marginBottom: '0.25rem' }}>Owner Parameters</span>
          <span style={{ fontSize: '14px' }}>
            Ownership Type: {selectedEvent.ownerType} <br />
            ID: {selectedEvent.organizationId ?? selectedEvent.ownerUserId}
          </span>
        </div>
        <div>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-fg-muted)', fontWeight: 'bold', display: 'block', marginBottom: '0.25rem' }}>Class restriction</span>
          <span style={{ fontSize: '14px' }}>
            Tier Restriction: <strong>{selectedEvent.classRestriction ?? 'PRE_OP (Any tier eligibility)'}</strong>
          </span>
        </div>
        <div>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-fg-muted)', fontWeight: 'bold', display: 'block', marginBottom: '0.25rem' }}>Participation Model</span>
          <span style={{ fontSize: '14px' }}>
            Granular Per-Race Participation: <strong>{selectedEvent.granularParticipation ? 'Enabled (Per-Race registration required)' : 'Disabled (Event-wide registration)'}</strong>
          </span>
        </div>
        <div>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-fg-muted)', fontWeight: 'bold', display: 'block', marginBottom: '0.25rem' }}>Signups Status</span>
          <span style={{ fontSize: '14px' }}>
            Signups Lock: <strong>{selectedEvent.signupsLocked ? 'Locked (Self-service signups disabled)' : 'Open (Self-service signups enabled)'}</strong>
          </span>
        </div>
      </div>

      {selectedEvent.scoringType === 1 && (
        <div style={{ marginTop: '1rem', borderTop: '1px solid var(--color-border-default)', paddingTop: '1.5rem' }}>
          <Heading as="h3" style={{ fontSize: '16px', marginBottom: '1rem' }}>
            Event Points Scoring Configuration Tables
          </Heading>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {['OP', 'GIII', 'GII', 'GI'].map((grade) => {
              const table = (selectedEvent.scoringRulesMode === 'CUSTOM' && selectedEvent.customScoringTables)
                ? (selectedEvent.customScoringTables[grade] || DEFAULT_SCORING_TABLES[grade])
                : DEFAULT_SCORING_TABLES[grade]
              return <GradePointsPreview key={grade} grade={grade} table={table} />
            })}
          </div>
        </div>
      )}

      {/* Standings overview aggregates block */}
      <div style={{ marginTop: '1rem', borderTop: '1px solid var(--color-border-default)', paddingTop: '1.5rem' }}>
        <Heading as="h3" style={{ fontSize: '16px', marginBottom: '1rem' }}>
          Current Event Overall Leaderboard
        </Heading>
        {selectedEvent.scoringType === 1 ? (
          selectedEvent.pointsOverview && selectedEvent.pointsOverview.length > 0 ? (
            <div style={{ overflowX: 'auto', border: '1px solid var(--color-border-default)', borderRadius: '6px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                <thead>
                  <tr style={{ background: 'var(--color-canvas-subtle)', borderBottom: '1px solid var(--color-border-default)' }}>
                    <th style={{ padding: '12px', fontWeight: 'bold' }}>Rank</th>
                    <th style={{ padding: '12px', fontWeight: 'bold' }}>Name</th>
                    <th style={{ padding: '12px', fontWeight: 'bold' }}>User ID</th>
                    <th style={{ padding: '12px', fontWeight: 'bold' }}>Total Points</th>
                    <th style={{ padding: '12px', fontWeight: 'bold' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedEvent.pointsOverview.map((item, idx) => (
                    <tr key={item.userId} style={{ borderBottom: '1px solid var(--color-border-default)' }}>
                      <td style={{ padding: '12px' }}><strong>{idx + 1}</strong></td>
                      <td style={{ padding: '12px' }}><UserLink userId={item.userId} name={item.name} /></td>
                      <td style={{ padding: '12px' }}><code style={{ fontSize: '12px' }}>{item.userId}</code></td>
                      <td style={{ padding: '12px' }}><strong>{item.points} pts</strong></td>
                      <td style={{ padding: '12px' }}>
                        {item.resultStatus === 'DSQ' ? <Label variant="severe">DSQ</Label> : item.resultStatus === 'DNF' ? <Label variant="attention">DNF</Label> : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <span style={{ fontSize: '14px', color: 'var(--color-fg-muted)' }}>No participants score standings loaded.</span>
          )
        ) : (
          selectedEvent.ladderOverview && selectedEvent.ladderOverview.length > 0 ? (
            <div style={{ overflowX: 'auto', border: '1px solid var(--color-border-default)', borderRadius: '6px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                <thead>
                  <tr style={{ background: 'var(--color-canvas-subtle)', borderBottom: '1px solid var(--color-border-default)' }}>
                    <th style={{ padding: '12px', fontWeight: 'bold' }}>Rank</th>
                    <th style={{ padding: '12px', fontWeight: 'bold' }}>Name</th>
                    <th style={{ padding: '12px', fontWeight: 'bold' }}>Rating (ELO)</th>
                    <th style={{ padding: '12px', fontWeight: 'bold' }}>Wins / Losses</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedEvent.ladderOverview.map((item) => (
                    <tr key={item.userId} style={{ borderBottom: '1px solid var(--color-border-default)' }}>
                      <td style={{ padding: '12px' }}><strong>{item.rank}</strong></td>
                      <td style={{ padding: '12px' }}><UserLink userId={item.userId} name={item.name} /></td>
                      <td style={{ padding: '12px' }}><strong>{item.elo}</strong></td>
                      <td style={{ padding: '12px' }}>{item.wins}W - {item.losses}L</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <span style={{ fontSize: '14px', color: 'var(--color-fg-muted)' }}>No ladder match results computed yet.</span>
          )
        )}
      </div>
    </div>
  )
}
