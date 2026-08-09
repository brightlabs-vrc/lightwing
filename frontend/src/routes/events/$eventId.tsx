import { createFileRoute, Link } from '@tanstack/react-router'
import { useAuth } from '../../hooks/useAuth'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getPublicEvent, joinEvent, leaveEvent, listPublicRaceEvents, getPublicRaceResults, joinRaceEvent, leaveRaceEvent } from '../../lib/public-api'
import { formatLocalDateTime } from '../../lib/datetime'
import { useNotification } from '../../hooks/useNotification'
import { Heading, Text, Label, Button, Spinner } from '@primer/react'
import type { eventmanager } from '../../lib/client'

const CLASS_TIER_LABELS: Record<string, string> = {
  PRE_OP: 'PRE-OP',
  OP: 'OP',
  G3: 'G3',
  G2: 'G2',
  G1: 'G1',
}

const SCORING_LABELS: Record<number, string> = {
  1: 'POINTS-BASED',
  2: 'LADDER-ELO',
}

const STATUS_TONE: Record<eventmanager.EventStatus, 'default' | 'accent' | 'success' | 'severe'> = {
  DRAFT: 'default',
  UNOFFICIAL: 'accent',
  OFFICIAL: 'success',
  CONCLUDED: 'severe',
}

export const Route = createFileRoute('/events/$eventId')({
  component: EventDetailPage,
})

function EventDetailPage() {
  const { eventId } = Route.useParams()
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const { addToast } = useNotification()

  const { data: event, isLoading, error } = useQuery({
    queryKey: ['public-event', eventId],
    queryFn: () => getPublicEvent(eventId),
  })

  const joinMutation = useMutation({
    mutationFn: (id: string) => joinEvent(id, `Bearer ${session?.session.token ?? ''}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public-event', eventId] })
      addToast({ severity: 'success', message: 'Successfully signed up for this event!' })
    },
    onError: (err) => {
      addToast({ severity: 'error', message: err instanceof Error ? err.message : 'Failed to join event' })
    }
  })

  const leaveMutation = useMutation({
    mutationFn: (id: string) => leaveEvent(id, `Bearer ${session?.session.token ?? ''}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public-event', eventId] })
      addToast({ severity: 'success', message: 'Successfully withdrew from this event!' })
    },
    onError: (err) => {
      addToast({ severity: 'error', message: err instanceof Error ? err.message : 'Failed to withdraw from event' })
    }
  })

  if (isLoading) {
    return (
      <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem', gap: '0.5rem', color: 'var(--color-fg-muted)' }}>
          <Spinner size="medium" />
          <span>Loading event details...</span>
        </div>
      </div>
    )
  }

  if (error || !event) {
    return (
      <div style={{ maxWidth: '640px', margin: '4rem auto', textAlign: 'center' }}>
        <Heading as="h2" style={{ fontSize: '20px', color: 'var(--color-danger-fg)' }}>
          Error loading event
        </Heading>
        <Text style={{ fontSize: '14px', color: 'var(--color-fg-muted)', marginTop: '8px', display: 'block' }}>
          Something went wrong while fetching the event details.
        </Text>
      </div>
    )
  }

  const isMember = session && event.members.some((m) => m.userId === session.user.id)
  const isConcluded = event.status === 'CONCLUDED'
  const isGranular = event.granularParticipation

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <Button as={Link as any} to="/events" size="small">
          &lt; Back to Events
        </Button>
      </div>

      {/* Main Info Card */}
      <div style={{
        backgroundColor: 'var(--color-canvas-default)',
        border: '1px solid var(--color-border-default)',
        borderRadius: '8px',
        padding: '1.5rem',
        boxShadow: 'var(--color-shadow-small)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <Heading as="h1" style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, color: 'var(--color-fg-default)' }}>
              {event.name}
            </Heading>
            {event.scheduledAt && (
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--color-attention-fg)' }}>
                SCHEDULED: <time dateTime={event.scheduledAt}>{formatLocalDateTime(event.scheduledAt)}</time>
              </span>
            )}
          </div>
          <Label variant={STATUS_TONE[event.status]}>{event.status.toUpperCase()}</Label>
        </div>

        {event.description && (
          <Text style={{ fontSize: '14px', color: 'var(--color-fg-muted)', lineHeight: '1.5', display: 'block' }}>
            {event.description}
          </Text>
        )}

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Label variant="default">
            SCORING TYPE: {SCORING_LABELS[event.scoringType] ?? 'UNKNOWN'}
          </Label>
          <Label variant="default">
            CLASS RESTRICTION:{' '}
            {event.classRestriction && event.classRestriction !== 'PRE_OP' && event.classRestriction !== 'OP' ? CLASS_TIER_LABELS[event.classRestriction as any] : 'OPEN TO ALL'}
          </Label>
        </div>

        {!isGranular && (
          <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--color-border-default)' }}>
            {!session ? (
              <Button as={Link as any} to="/auth" search={{ redirect: `/events/${eventId}` } as any} variant="primary">
                Sign in to join
              </Button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <Button
                  variant={isMember ? 'danger' : 'primary'}
                  disabled={isConcluded || event.signupsLocked || joinMutation.isPending || leaveMutation.isPending || (!isMember && event.participantLimit !== null && event.members.length >= event.participantLimit)}
                  onClick={() => {
                    if (isConcluded) return
                    if (isMember) {
                      leaveMutation.mutate(eventId)
                    } else {
                      joinMutation.mutate(eventId)
                    }
                  }}
                >
                  {isMember ? 'Withdraw from event' : (event.participantLimit !== null && event.members.length >= event.participantLimit) ? 'Event Full' : 'Sign up for event'}
                </Button>
                {event.signupsLocked && (
                  <span style={{ fontSize: '12px', color: 'var(--color-danger-fg)', fontWeight: 'bold', marginTop: '4px' }}>
                    SIGNUPS ARE LOCKED FOR THIS EVENT
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {/* Participants Panel */}
        <div style={{
          backgroundColor: 'var(--color-canvas-default)',
          border: '1px solid var(--color-border-default)',
          borderRadius: '8px',
          padding: '1.5rem',
          boxShadow: 'var(--color-shadow-small)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}>
          <Heading as="h3" style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>
            Participants ({event.members.length}{!event.granularParticipation && event.participantLimit !== null && event.participantLimit > 0 ? ` / ${event.participantLimit}` : ''})
          </Heading>
          {event.members.length === 0 ? (
            <span style={{ fontSize: '12px', color: 'var(--color-fg-muted)', fontStyle: 'italic' }}>NO MEMBERS YET</span>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid var(--color-border-default)', borderRadius: '6px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: 'var(--color-canvas-subtle)', borderBottom: '1px solid var(--color-border-default)' }}>
                    <th style={{ padding: '8px', fontWeight: 'bold' }}>Name</th>
                    <th style={{ padding: '8px', fontWeight: 'bold' }}>Class Tier</th>
                  </tr>
                </thead>
                <tbody>
                  {event.members.map((m) => (
                    <tr key={m.userId} style={{ borderBottom: '1px solid var(--color-border-default)' }}>
                      <td style={{ padding: '8px', fontWeight: 'bold' }}>{m.name}</td>
                      <td style={{ padding: '8px' }}>
                        {m.classTier ? (
                          <Label variant="default">{CLASS_TIER_LABELS[m.classTier as any]}</Label>
                        ) : (
                          <span style={{ color: 'var(--color-fg-subtle)' }}>-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Schedule Panel */}
        {event.schedules && event.schedules.length > 0 && (
          <div style={{
            backgroundColor: 'var(--color-canvas-default)',
            border: '1px solid var(--color-border-default)',
            borderRadius: '8px',
            padding: '1.5rem',
            boxShadow: 'var(--color-shadow-small)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}>
            <Heading as="h3" style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>
              Schedule
            </Heading>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {event.schedules.map((schedule) => (
                <div
                  key={schedule.id}
                  style={{
                    borderBottom: '1px solid var(--color-border-default)',
                    paddingBottom: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <span style={{ fontWeight: 'bold', fontSize: '14px', color: 'var(--color-accent-fg)' }}>
                    {schedule.title || 'UNTITLED'}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--color-fg-muted)' }}>
                    {new Date(schedule.startsAt).toLocaleString()}
                    {schedule.location && (
                      <span style={{
                        display: 'block',
                        marginTop: '4px',
                        fontSize: '11px',
                        color: 'var(--color-fg-default)',
                        backgroundColor: 'var(--color-canvas-subtle)',
                        padding: '2px 8px',
                        border: '1px solid var(--color-border-default)',
                        borderRadius: '6px',
                        width: 'fit-content'
                      }}>
                        📍 {schedule.location}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Standings (Points) */}
      {event.pointsOverview && (
        <div style={{
          backgroundColor: 'var(--color-canvas-default)',
          border: '1px solid var(--color-border-default)',
          borderRadius: '8px',
          padding: '1.5rem',
          boxShadow: 'var(--color-shadow-small)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <Heading as="h2" style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>
              STANDINGS (POINTS)
            </Heading>
            {event.status === 'OFFICIAL' || event.status === 'CONCLUDED' ? (
              <Label variant="success">FINAL</Label>
            ) : (
              <Label variant="attention">PROVISIONAL</Label>
            )}
          </div>
          {event.pointsOverview.length === 0 ? (
            <span style={{ fontSize: '12px', color: 'var(--color-fg-muted)', fontStyle: 'italic' }}>NO RESULTS RECORDED</span>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid var(--color-border-default)', borderRadius: '6px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: 'var(--color-canvas-subtle)', borderBottom: '1px solid var(--color-border-default)' }}>
                    <th style={{ padding: '8px', fontWeight: 'bold' }}>Rank</th>
                    <th style={{ padding: '8px', fontWeight: 'bold' }}>Participant</th>
                    <th style={{ padding: '8px', fontWeight: 'bold', textAlign: 'right' }}>Total Points</th>
                  </tr>
                </thead>
                <tbody>
                  {event.pointsOverview.map((e, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--color-border-default)' }}>
                      <td style={{ padding: '8px' }}>{idx + 1}</td>
                      <td style={{ padding: '8px', fontWeight: 'bold' }}>{e.name}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold', color: 'var(--color-accent-fg)' }}>{e.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Standings (Ladder) */}
      {event.ladderOverview && (
        <div style={{
          backgroundColor: 'var(--color-canvas-default)',
          border: '1px solid var(--color-border-default)',
          borderRadius: '8px',
          padding: '1.5rem',
          boxShadow: 'var(--color-shadow-small)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <Heading as="h2" style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>
              STANDINGS (LADDER)
            </Heading>
            {event.status === 'OFFICIAL' || event.status === 'CONCLUDED' ? (
              <Label variant="success">FINAL</Label>
            ) : (
              <Label variant="attention">PROVISIONAL</Label>
            )}
          </div>
          {event.ladderOverview.length === 0 ? (
            <span style={{ fontSize: '12px', color: 'var(--color-fg-muted)', fontStyle: 'italic' }}>NO LADDER RECORDS</span>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid var(--color-border-default)', borderRadius: '6px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: 'var(--color-canvas-subtle)', borderBottom: '1px solid var(--color-border-default)' }}>
                    <th style={{ padding: '8px', fontWeight: 'bold' }}>Rank</th>
                    <th style={{ padding: '8px', fontWeight: 'bold' }}>Participant</th>
                    <th style={{ padding: '8px', fontWeight: 'bold', textAlign: 'right' }}>ELO</th>
                    <th style={{ padding: '8px', fontWeight: 'bold', textAlign: 'right' }}>W-L</th>
                  </tr>
                </thead>
                <tbody>
                  {event.ladderOverview.map((e, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--color-border-default)' }}>
                      <td style={{ padding: '8px' }}>{e.rank}</td>
                      <td style={{ padding: '8px', fontWeight: 'bold' }}>{e.name}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold', color: 'var(--color-attention-fg)' }}>{e.elo}</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>{e.wins}-{e.losses}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* RACES SECTION */}
      <div>
        <Heading as="h2" style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '1rem' }}>
          Races
        </Heading>
        <EventRacesList event={event} />
      </div>
    </div>
  )
}

function RaceStandingsTable({
  eventId,
  raceId,
  members,
}: {
  eventId: string
  raceId: string
  members: eventmanager.EventMemberView[]
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['public-race-results', eventId, raceId],
    queryFn: () => getPublicRaceResults(eventId, raceId),
  })

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem', gap: '0.5rem', color: 'var(--color-fg-muted)' }}>
        <Spinner size="small" />
        <span>Loading standings...</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <span style={{ fontSize: '12px', color: 'var(--color-danger-fg)' }}>ERROR LOADING STANDINGS</span>
    )
  }

  const results = data.results

  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--color-border-default)', borderRadius: '6px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
        <thead>
          <tr style={{ background: 'var(--color-canvas-subtle)', borderBottom: '1px solid var(--color-border-default)' }}>
            <th style={{ padding: '8px', fontWeight: 'bold' }}>POS</th>
            <th style={{ padding: '8px', fontWeight: 'bold' }}>DRAW</th>
            <th style={{ padding: '8px', fontWeight: 'bold' }}>PARTICIPANT</th>
            <th style={{ padding: '8px', fontWeight: 'bold', textAlign: 'right' }}>POINTS</th>
            <th style={{ padding: '8px', fontWeight: 'bold' }}>FINISH TIME</th>
            <th style={{ padding: '8px', fontWeight: 'bold' }}>MARGIN</th>
            <th style={{ padding: '8px', fontWeight: 'bold' }}>PASSING ORDER</th>
            <th style={{ padding: '8px', fontWeight: 'bold' }}>FINAL 3F</th>
          </tr>
        </thead>
        <tbody>
          {results.length === 0 ? (
            <tr>
              <td colSpan={8} style={{ padding: '12px', textAlign: 'center', color: 'var(--color-fg-muted)', fontStyle: 'italic' }}>
                NO STANDINGS RECORDED
              </td>
            </tr>
          ) : (
            results.map((r, idx) => {
              const member = members.find((m) => m.userId === r.userId)
              return (
                <tr key={idx} style={{ borderBottom: '1px solid var(--color-border-default)' }}>
                  <td style={{ padding: '8px', fontWeight: 'bold' }}>{r.position ?? '-'}</td>
                  <td style={{ padding: '8px' }}>{r.gateNumber ?? '-'}</td>
                  <td style={{ padding: '8px', fontWeight: 'bold' }}>{member?.name ?? r.userId}</td>
                  <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold', color: 'var(--color-accent-fg)' }}>{r.points}</td>
                  <td style={{ padding: '8px' }}>{r.finishTime ?? '-'}</td>
                  <td style={{ padding: '8px' }}>{r.margin ?? '-'}</td>
                  <td style={{ padding: '8px' }}>{r.passingOrder ?? '-'}</td>
                  <td style={{ padding: '8px' }}>{r.final3F ?? '-'}</td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}

function EventRacesList({ event }: { event: eventmanager.EventDetail }) {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const { addToast } = useNotification()
  const isMember = session && event.members.some((m) => m.userId === session.user.id)

  const joinRaceMutation = useMutation({
    mutationFn: ({ raceId }: { raceId: string }) =>
      joinRaceEvent(event.id, raceId, `Bearer ${session?.session.token ?? ''}`),
    onSuccess: (_, { raceId }) => {
      queryClient.invalidateQueries({ queryKey: ['public-event', event.id] })
      queryClient.invalidateQueries({ queryKey: ['public-event-races', event.id] })
      queryClient.invalidateQueries({ queryKey: ['public-race-results', event.id, raceId] })
      addToast({ severity: 'success', message: 'Successfully signed up for this race!' })
    },
    onError: (err: any) => {
      const msg = err?.message || err?.toString() || 'Unknown error'
      addToast({ severity: 'error', message: `Could not sign up for this race: ${msg}` })
    },
  })

  const leaveRaceMutation = useMutation({
    mutationFn: ({ raceId }: { raceId: string }) =>
      leaveRaceEvent(event.id, raceId, `Bearer ${session?.session.token ?? ''}`),
    onSuccess: (_, { raceId }) => {
      queryClient.invalidateQueries({ queryKey: ['public-event', event.id] })
      queryClient.invalidateQueries({ queryKey: ['public-event-races', event.id] })
      queryClient.invalidateQueries({ queryKey: ['public-race-results', event.id, raceId] })
      addToast({ severity: 'success', message: 'Successfully withdrew from this race!' })
    },
    onError: (err: any) => {
      const msg = err?.message || err?.toString() || 'Unknown error'
      addToast({ severity: 'error', message: `Could not withdraw from this race: ${msg}` })
    },
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['public-event-races', event.id],
    queryFn: () => listPublicRaceEvents(event.id),
  })

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem', gap: '0.5rem', color: 'var(--color-fg-muted)' }}>
        <Spinner size="medium" />
        <span>Loading races...</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-danger-fg)' }}>
        <span>Error loading races.</span>
      </div>
    )
  }

  const races = data.races

  if (races.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-fg-muted)' }}>
        <span>There are no individual race events configured for this competition.</span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {races.map((race) => {
        const isRaceMember = session && (race.members ?? []).some((rm) => rm.userId === session.user.id)

        return (
          <div
            key={race.id}
            style={{
              backgroundColor: 'var(--color-canvas-default)',
              border: '1px solid var(--color-border-default)',
              borderRadius: '8px',
              padding: '1.5rem',
              boxShadow: 'var(--color-shadow-small)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            {/* Race Header Info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <Heading as="h3" style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, color: 'var(--color-fg-default)' }}>
                  #{race.sequence}. {race.name}
                </Heading>
                <div style={{ fontSize: '12px', color: 'var(--color-fg-muted)', display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                  <span>TRACK: <strong>{race.trackType}</strong> ({race.distanceMeters}m)</span>
                  <span>LOCATION: <strong>{race.location}</strong></span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignSelf: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
                <Label variant="default">
                  CLASS:{' '}
                  {race.classRestriction && race.classRestriction !== 'PRE_OP' && race.classRestriction !== 'OP' ? CLASS_TIER_LABELS[race.classRestriction] ?? race.classRestriction : 'OPEN'}
                </Label>
                {race.participantLimit !== null && (
                  <Label variant="default">
                    CAPACITY: {(race.members ?? []).length} / {race.participantLimit}
                  </Label>
                )}

                {event.granularParticipation && (
                  <>
                    {!session ? (
                      <Button as={Link as any} to="/auth" search={{ redirect: `/events/${event.id}` } as any} size="small">
                        Sign In
                      </Button>
                    ) : (
                      <Button
                        variant={isRaceMember ? 'danger' : 'primary'}
                        size="small"
                        disabled={event.signupsLocked || joinRaceMutation.isPending || leaveRaceMutation.isPending || (!isRaceMember && race.participantLimit !== null && (race.members ?? []).length >= race.participantLimit)}
                        onClick={() => {
                          if (isRaceMember) {
                            leaveRaceMutation.mutate({ raceId: race.id })
                          } else {
                            joinRaceMutation.mutate({ raceId: race.id })
                          }
                        }}
                      >
                        {isRaceMember ? 'Withdraw' : (race.participantLimit !== null && (race.members ?? []).length >= race.participantLimit) ? 'Full' : 'Sign Up'}
                      </Button>
                    )}
                  </>
                )}

                {!event.granularParticipation && isMember && (
                  <Button
                    variant={isRaceMember ? 'danger' : 'primary'}
                    size="small"
                    disabled={event.signupsLocked || joinRaceMutation.isPending || leaveRaceMutation.isPending}
                    onClick={() => {
                      if (isRaceMember) {
                        leaveRaceMutation.mutate({ raceId: race.id })
                      } else {
                        joinRaceMutation.mutate({ raceId: race.id })
                      }
                    }}
                  >
                    {isRaceMember ? 'Withdraw' : 'Sign Up'}
                  </Button>
                )}
              </div>
            </div>

            {/* Standings Table */}
            <div style={{ marginTop: '0.5rem' }}>
              <div style={{ fontWeight: 'bold', fontSize: '11px', color: 'var(--color-fg-muted)', marginBottom: '8px' }}>RACE STANDINGS</div>
              <RaceStandingsTable eventId={event.id} raceId={race.id} members={event.members} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
