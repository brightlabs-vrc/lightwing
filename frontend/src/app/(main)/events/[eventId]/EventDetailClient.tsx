'use client'

import { useAuth } from '@/hooks/useAuth'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getPublicEvent,
  joinEvent,
  leaveEvent,
  getPublicRaceResults,
  listPublicRaceEvents,
  joinRaceEvent,
  leaveRaceEvent,
} from '@/lib/public-api'
import { formatLocalDateTime } from '@/lib/datetime'
import { useNotification } from '@/hooks/useNotification'
import { Heading, Text, Label, Button, Spinner } from '@primer/react'
import Link from 'next/link'
import type { eventmanager } from '@/lib/client'

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

const STATUS_TONE: Record<string, 'default' | 'accent' | 'success' | 'severe'> = {
  DRAFT: 'default',
  UNOFFICIAL: 'accent',
  OFFICIAL: 'success',
  CONCLUDED: 'severe',
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
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '1rem',
          gap: '0.5rem',
          color: 'var(--color-fg-muted)',
        }}
      >
        <Spinner size="small" />
        <span style={{ fontSize: '12px' }}>Loading standings...</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div style={{ padding: '0.5rem', fontSize: '12px', color: 'var(--color-danger-fg)' }}>
        ERROR LOADING STANDINGS
      </div>
    )
  }

  const results = data.results

  return (
    <div
      style={{
        overflowX: 'auto',
        border: '1px solid var(--color-border-default)',
        borderRadius: '6px',
        backgroundColor: 'var(--color-canvas-default)',
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
        <thead>
          <tr
            style={{
              backgroundColor: 'var(--color-canvas-subtle)',
              borderBottom: '1px solid var(--color-border-default)',
              color: 'var(--color-fg-muted)',
            }}
          >
            <th style={{ padding: '8px 12px', width: '64px' }}>POS</th>
            <th style={{ padding: '8px 12px', width: '64px' }}>DRAW</th>
            <th style={{ padding: '8px 12px' }}>PARTICIPANT</th>
            <th style={{ padding: '8px 12px', textAlign: 'right', width: '96px' }}>POINTS</th>
            <th style={{ padding: '8px 12px' }}>FINISH TIME</th>
            <th style={{ padding: '8px 12px' }}>MARGIN</th>
            <th style={{ padding: '8px 12px' }}>PASSING ORDER</th>
            <th style={{ padding: '8px 12px' }}>FINAL 3F</th>
            <th style={{ padding: '8px 12px', width: '96px' }}>RESULT</th>
          </tr>
        </thead>
        <tbody>
          {results.length === 0 ? (
            <tr>
              <td
                colSpan={9}
                style={{
                  padding: '12px',
                  textAlign: 'center',
                  color: 'var(--color-fg-muted)',
                  fontSize: '12px',
                }}
              >
                NO STANDINGS RECORDED
              </td>
            </tr>
          ) : (
            results.map((r, idx) => {
              const member = members.find((m) => m.userId === r.userId)
              const status = r.resultStatus?.toUpperCase()

              return (
                <tr key={r.id || idx} style={{ borderBottom: '1px solid var(--color-border-muted)' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 'bold', color: 'var(--color-fg-default)' }}>
                    {r.position ?? '-'}
                  </td>
                  <td style={{ padding: '8px 12px', color: 'var(--color-fg-default)' }}>
                    {r.gateNumber ?? '-'}
                  </td>
                  <td style={{ padding: '8px 12px', fontWeight: 500, color: 'var(--color-fg-default)' }}>
                    {member?.name ?? r.userId}
                  </td>
                  <td
                    style={{
                      padding: '8px 12px',
                      textAlign: 'right',
                      fontWeight: 'bold',
                      color: 'var(--color-accent-fg)',
                    }}
                  >
                    {r.points}
                  </td>
                  <td style={{ padding: '8px 12px', color: 'var(--color-fg-default)' }}>
                    {r.finishTime ?? '-'}
                  </td>
                  <td style={{ padding: '8px 12px', color: 'var(--color-fg-default)' }}>
                    {r.margin ?? '-'}
                  </td>
                  <td style={{ padding: '8px 12px', color: 'var(--color-fg-default)' }}>
                    {r.passingOrder ?? '-'}
                  </td>
                  <td style={{ padding: '8px 12px', color: 'var(--color-fg-default)' }}>
                    {r.final3F ?? '-'}
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    {status === 'DSQ' && (
                      <span style={{ color: 'var(--color-danger-fg)', fontWeight: 'bold' }}>DSQ</span>
                    )}
                    {status === 'DNF' && (
                      <span style={{ color: 'var(--color-attention-fg)', fontWeight: 'bold' }}>DNF</span>
                    )}
                    {status === 'DNS' && (
                      <span style={{ color: 'var(--color-severe-fg)', fontWeight: 'bold' }}>DNS</span>
                    )}
                    {status === 'DEFERRED' && (
                      <span
                        style={{ color: 'var(--color-fg-muted)', fontWeight: 'bold' }}
                        title="Deferred - Already won an OP"
                      >
                        DEFERRED
                      </span>
                    )}
                    {!status && <span style={{ color: 'var(--color-fg-muted)' }}>-</span>}
                  </td>
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
      addToast({ message: 'Signed up for race successfully', severity: 'success' })
    },
    onError: (err: Error) => {
      addToast({ message: `Could not sign up for this race: ${err.message || 'Unknown error'}`, severity: 'error' })
    },
  })

  const leaveRaceMutation = useMutation({
    mutationFn: ({ raceId }: { raceId: string }) =>
      leaveRaceEvent(event.id, raceId, `Bearer ${session?.session.token ?? ''}`),
    onSuccess: (_, { raceId }) => {
      queryClient.invalidateQueries({ queryKey: ['public-event', event.id] })
      queryClient.invalidateQueries({ queryKey: ['public-event-races', event.id] })
      queryClient.invalidateQueries({ queryKey: ['public-race-results', event.id, raceId] })
      addToast({ message: 'Withdrew from race successfully', severity: 'success' })
    },
    onError: (err: Error) => {
      addToast({ message: `Could not withdraw from this race: ${err.message || 'Unknown error'}`, severity: 'error' })
    },
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['public-event-races', event.id],
    queryFn: () => listPublicRaceEvents(event.id),
  })

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem', color: 'var(--color-fg-muted)' }}>
        <Spinner size="medium" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div
        style={{
          padding: '1.5rem',
          textAlign: 'center',
          border: '1px solid var(--color-border-default)',
          borderRadius: '8px',
          color: 'var(--color-danger-fg)',
        }}
      >
        Error loading races
      </div>
    )
  }

  const races = data.races

  if (races.length === 0) {
    return (
      <div
        style={{
          padding: '2rem',
          textAlign: 'center',
          border: '1px solid var(--color-border-default)',
          borderRadius: '8px',
          color: 'var(--color-fg-muted)',
        }}
      >
        There are no individual race events configured for this competition.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {races.map((race) => {
        const raceMembers = race.members ?? []
        const isRaceMember = !!session?.user.id && raceMembers.some((rm) => rm.userId === session.user.id)
        const isFull = race.participantLimit !== null && raceMembers.length >= race.participantLimit
        const canManageSignup = event.granularParticipation || isMember

        return (
          <div
            key={race.id}
            style={{
              border: '1px solid var(--color-border-default)',
              borderRadius: '8px',
              backgroundColor: 'var(--color-canvas-default)',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            {/* Race Header Info */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <Heading
                  as="h3"
                  style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, color: 'var(--color-fg-default)' }}
                >
                  #{race.sequence}. {race.name}
                </Heading>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '1rem',
                    fontSize: '12px',
                    color: 'var(--color-fg-muted)',
                  }}
                >
                  <span>
                    TRACK: <strong style={{ color: 'var(--color-fg-default)' }}>{race.trackType}</strong> (
                    {race.distanceMeters}m)
                  </span>
                  {race.location && (
                    <span>
                      LOCATION: <strong style={{ color: 'var(--color-fg-default)' }}>{race.location}</strong>
                    </span>
                  )}
                  {race.startsAt && (
                    <span>
                      STARTS AT: <strong style={{ color: 'var(--color-fg-default)' }}>{formatLocalDateTime(race.startsAt)}</strong>
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <Label variant="default">
                  CLASS:{' '}
                  {race.classRestriction && race.classRestriction !== 'PRE_OP' && race.classRestriction !== 'OP'
                    ? CLASS_TIER_LABELS[race.classRestriction] ?? race.classRestriction
                    : 'OPEN'}
                </Label>
                {race.participantLimit !== null && (
                  <Label variant="default">
                    CAPACITY: {raceMembers.length} / {race.participantLimit}
                  </Label>
                )}

                {canManageSignup && (
                  <>
                    {!session?.session ? (
                      <Link
                        href={`/auth?redirect=${encodeURIComponent(`/events/${event.id}`)}`}
                        style={{ textDecoration: 'none' }}
                      >
                        <Button size="small" variant="primary">
                          SIGN IN
                        </Button>
                      </Link>
                    ) : (
                      <Button
                        size="small"
                        variant={isRaceMember ? 'danger' : 'primary'}
                        disabled={
                          event.signupsLocked ||
                          joinRaceMutation.isPending ||
                          leaveRaceMutation.isPending ||
                          (!isRaceMember && isFull)
                        }
                        onClick={() => {
                          if (isRaceMember) {
                            leaveRaceMutation.mutate({ raceId: race.id })
                          } else {
                            joinRaceMutation.mutate({ raceId: race.id })
                          }
                        }}
                      >
                        {isRaceMember ? 'WITHDRAW' : isFull ? 'FULL' : 'SIGN UP'}
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Standings Table */}
            <div>
              <Heading
                as="h4"
                style={{
                  fontSize: '12px',
                  fontWeight: 'bold',
                  letterSpacing: '0.05em',
                  color: 'var(--color-fg-muted)',
                  marginBottom: '0.5rem',
                }}
              >
                RACE STANDINGS
              </Heading>
              <RaceStandingsTable eventId={event.id} raceId={race.id} members={event.members} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function EventDetailClient({
  initialEvent,
  eventId,
}: {
  initialEvent: eventmanager.EventDetail | null
  eventId: string
}) {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const { addToast } = useNotification()

  const { data: event, isLoading, error } = useQuery({
    queryKey: ['public-event', eventId],
    queryFn: () => getPublicEvent(eventId),
    ...(initialEvent ? { initialData: initialEvent } : {}),
  })

  const joinMutation = useMutation({
    mutationFn: () => joinEvent(eventId, `Bearer ${session?.session?.token ?? ''}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public-event', eventId] })
      addToast({ message: 'Signed up for event successfully', severity: 'success' })
    },
    onError: (err: Error) => {
      addToast({ message: err.message || 'Failed to sign up for event', severity: 'error' })
    },
  })

  const leaveMutation = useMutation({
    mutationFn: () => leaveEvent(eventId, `Bearer ${session?.session?.token ?? ''}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public-event', eventId] })
      addToast({ message: 'Withdrew from event successfully', severity: 'success' })
    },
    onError: (err: Error) => {
      addToast({ message: err.message || 'Failed to withdraw from event', severity: 'error' })
    },
  })

  if (isLoading && !event) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem', color: 'var(--color-fg-muted)' }}>
        <Spinner size="medium" />
      </div>
    )
  }

  if (error || !event) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ padding: '1rem', borderRadius: '6px', backgroundColor: 'var(--color-danger-subtle)', border: '1px solid var(--color-danger-muted)', color: 'var(--color-danger-fg)' }}>
          Event not found
        </div>
        <div>
          <Link href="/events" style={{ textDecoration: 'none' }}>
            <Button>Back to Events</Button>
          </Link>
        </div>
      </div>
    )
  }

  const isCreator = session?.user.id === event.ownerUserId
  const isSiteAdmin = session?.user.siteRole === 'SITE_ADMIN'
  const isMember = session?.session && event.members.some((m) => m.userId === session.user.id)
  const isConcluded = event.status === 'CONCLUDED'
  const isGranular = event.granularParticipation

  const members = event.members ?? []
  const schedules = event.schedules ?? []
  const pointsOverview = event.pointsOverview
  const ladderOverview = event.ladderOverview

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Back link */}
      <div>
        <Link
          href="/events"
          style={{
            textDecoration: 'none',
            color: 'var(--color-fg-muted)',
            fontSize: '13px',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          &lt; BACK TO EVENTS
        </Link>
      </div>

      {/* Main Info Box */}
      <div
        style={{
          border: '1px solid var(--color-border-default)',
          borderRadius: '8px',
          backgroundColor: 'var(--color-canvas-default)',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <Heading
              as="h1"
              style={{ fontSize: '26px', fontWeight: 'bold', margin: 0, color: 'var(--color-fg-default)' }}
            >
              {event.name}
            </Heading>
            {event.scheduledAt && (
              <Text style={{ fontSize: '13px', color: 'var(--color-attention-fg)', fontWeight: 600 }}>
                SCHEDULED: {formatLocalDateTime(event.scheduledAt)}
              </Text>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Label variant={STATUS_TONE[event.status]}>{event.status.toUpperCase()}</Label>
            {(isCreator || isSiteAdmin) && (
              <Link href={`/admin/events/${event.id}`} style={{ textDecoration: 'none' }}>
                <Button size="small">Admin</Button>
              </Link>
            )}
          </div>
        </div>

        {event.description && (
          <Text style={{ fontSize: '14px', color: 'var(--color-fg-muted)', lineHeight: '1.6' }}>
            {event.description}
          </Text>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Label variant="default">SCORING TYPE: {SCORING_LABELS[event.scoringType] ?? 'UNKNOWN'}</Label>
          <Label variant="default">
            CLASS RESTRICTION:{' '}
            {event.classRestriction && event.classRestriction !== 'PRE_OP' && event.classRestriction !== 'OP'
              ? CLASS_TIER_LABELS[event.classRestriction] ?? event.classRestriction
              : 'OPEN TO ALL'}
          </Label>
        </div>

        {/* Event Sign Up Action (for Non-Granular Events) */}
        {!isGranular && (
          <div
            style={{
              paddingTop: '1rem',
              borderTop: '1px solid var(--color-border-default)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}
          >
            {!session?.session ? (
              <div>
                <Link
                  href={`/auth?redirect=${encodeURIComponent(`/events/${event.id}`)}`}
                  style={{ textDecoration: 'none' }}
                >
                  <Button variant="primary">SIGN IN TO JOIN</Button>
                </Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start' }}>
                <Button
                  variant={isMember ? 'danger' : 'primary'}
                  disabled={
                    isConcluded ||
                    event.signupsLocked ||
                    joinMutation.isPending ||
                    leaveMutation.isPending ||
                    (!isMember && event.participantLimit !== null && members.length >= event.participantLimit)
                  }
                  onClick={() => {
                    if (isConcluded) return
                    if (isMember) {
                      leaveMutation.mutate()
                    } else {
                      joinMutation.mutate()
                    }
                  }}
                >
                  {isMember
                    ? 'WITHDRAW FROM EVENT'
                    : event.participantLimit !== null && members.length >= event.participantLimit
                    ? 'EVENT FULL'
                    : 'SIGN UP FOR EVENT'}
                </Button>
                {event.signupsLocked && (
                  <Text style={{ fontSize: '12px', color: 'var(--color-fg-muted)' }}>
                    SIGNUPS ARE LOCKED FOR THIS EVENT
                  </Text>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Two Column Section: Participants & Schedule */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {/* Participants Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <Heading
            as="h3"
            style={{
              fontSize: '14px',
              fontWeight: 'bold',
              letterSpacing: '0.05em',
              color: 'var(--color-fg-muted)',
              margin: 0,
            }}
          >
            PARTICIPANTS ({members.length}
            {!isGranular && event.participantLimit !== null && event.participantLimit > 0
              ? ` / ${event.participantLimit}`
              : ''}
            )
          </Heading>
          <div
            style={{
              overflowX: 'auto',
              border: '1px solid var(--color-border-default)',
              borderRadius: '6px',
              backgroundColor: 'var(--color-canvas-default)',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr
                  style={{
                    backgroundColor: 'var(--color-canvas-subtle)',
                    borderBottom: '1px solid var(--color-border-default)',
                    color: 'var(--color-fg-muted)',
                  }}
                >
                  <th style={{ padding: '8px 12px' }}>NAME</th>
                  <th style={{ padding: '8px 12px', width: '120px' }}>CLASS TIER</th>
                </tr>
              </thead>
              <tbody>
                {members.length === 0 ? (
                  <tr>
                    <td
                      colSpan={2}
                      style={{
                        padding: '12px',
                        textAlign: 'center',
                        color: 'var(--color-fg-muted)',
                        fontSize: '12px',
                      }}
                    >
                      NO MEMBERS YET
                    </td>
                  </tr>
                ) : (
                  members.map((m) => (
                    <tr key={m.userId} style={{ borderBottom: '1px solid var(--color-border-muted)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 500, color: 'var(--color-fg-default)' }}>
                        {m.name}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        {m.classTier && m.classTier !== 'PRE_OP' && m.classTier !== 'OP' ? (
                          <Label variant="default">{CLASS_TIER_LABELS[m.classTier] ?? m.classTier}</Label>
                        ) : (
                          <span style={{ color: 'var(--color-fg-muted)' }}>-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Schedule Panel */}
        {schedules.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <Heading
              as="h3"
              style={{
                fontSize: '14px',
                fontWeight: 'bold',
                letterSpacing: '0.05em',
                color: 'var(--color-fg-muted)',
                margin: 0,
              }}
            >
              SCHEDULE
            </Heading>
            <div
              style={{
                border: '1px solid var(--color-border-default)',
                borderRadius: '6px',
                backgroundColor: 'var(--color-canvas-default)',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
              }}
            >
              {schedules.map((schedule, idx) => (
                <div
                  key={schedule.id || idx}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem',
                    borderBottom: idx < schedules.length - 1 ? '1px solid var(--color-border-muted)' : 'none',
                    paddingBottom: idx < schedules.length - 1 ? '0.75rem' : 0,
                  }}
                >
                  <Text style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--color-accent-fg)' }}>
                    {schedule.title || 'UNTITLED'}
                  </Text>
                  <Text style={{ fontSize: '12px', color: 'var(--color-fg-muted)' }}>
                    {formatLocalDateTime(schedule.startsAt)}
                  </Text>
                  {schedule.location && (
                    <div style={{ marginTop: '0.25rem' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          color: 'var(--color-fg-default)',
                          backgroundColor: 'var(--color-canvas-subtle)',
                          padding: '2px 8px',
                          border: '1px solid var(--color-border-default)',
                          borderRadius: '4px',
                          display: 'inline-block',
                        }}
                      >
                        📍 {schedule.location}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Standings (Points) Overview */}
      {pointsOverview && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Heading
              as="h3"
              style={{
                fontSize: '14px',
                fontWeight: 'bold',
                letterSpacing: '0.05em',
                color: 'var(--color-fg-muted)',
                margin: 0,
              }}
            >
              STANDINGS (POINTS)
            </Heading>
            <Label variant={event.status === 'OFFICIAL' || event.status === 'CONCLUDED' ? 'success' : 'attention'}>
              {event.status === 'OFFICIAL' || event.status === 'CONCLUDED' ? 'FINAL' : 'PROVISIONAL'}
            </Label>
          </div>
          <div
            style={{
              overflowX: 'auto',
              border: '1px solid var(--color-border-default)',
              borderRadius: '6px',
              backgroundColor: 'var(--color-canvas-default)',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr
                  style={{
                    backgroundColor: 'var(--color-canvas-subtle)',
                    borderBottom: '1px solid var(--color-border-default)',
                    color: 'var(--color-fg-muted)',
                  }}
                >
                  <th style={{ padding: '8px 12px', width: '64px' }}>#</th>
                  <th style={{ padding: '8px 12px' }}>PARTICIPANT</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', width: '128px' }}>TOTAL POINTS</th>
                </tr>
              </thead>
              <tbody>
                {pointsOverview.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      style={{
                        padding: '12px',
                        textAlign: 'center',
                        color: 'var(--color-fg-muted)',
                        fontSize: '12px',
                      }}
                    >
                      NO RESULTS RECORDED
                    </td>
                  </tr>
                ) : (
                  pointsOverview.map((e, idx) => (
                    <tr key={e.userId || idx} style={{ borderBottom: '1px solid var(--color-border-muted)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 'bold', color: 'var(--color-fg-default)' }}>
                        {idx + 1}
                      </td>
                      <td style={{ padding: '8px 12px', fontWeight: 500, color: 'var(--color-fg-default)' }}>
                        {e.name}
                      </td>
                      <td
                        style={{
                          padding: '8px 12px',
                          textAlign: 'right',
                          fontWeight: 'bold',
                          color: 'var(--color-accent-fg)',
                        }}
                      >
                        {e.points}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Standings (Ladder) Overview */}
      {ladderOverview && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Heading
              as="h3"
              style={{
                fontSize: '14px',
                fontWeight: 'bold',
                letterSpacing: '0.05em',
                color: 'var(--color-fg-muted)',
                margin: 0,
              }}
            >
              STANDINGS (LADDER)
            </Heading>
            <Label variant={event.status === 'OFFICIAL' || event.status === 'CONCLUDED' ? 'success' : 'attention'}>
              {event.status === 'OFFICIAL' || event.status === 'CONCLUDED' ? 'FINAL' : 'PROVISIONAL'}
            </Label>
          </div>
          <div
            style={{
              overflowX: 'auto',
              border: '1px solid var(--color-border-default)',
              borderRadius: '6px',
              backgroundColor: 'var(--color-canvas-default)',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr
                  style={{
                    backgroundColor: 'var(--color-canvas-subtle)',
                    borderBottom: '1px solid var(--color-border-default)',
                    color: 'var(--color-fg-muted)',
                  }}
                >
                  <th style={{ padding: '8px 12px', width: '64px' }}>RANK</th>
                  <th style={{ padding: '8px 12px' }}>PARTICIPANT</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', width: '96px' }}>ELO</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', width: '96px' }}>W-L</th>
                </tr>
              </thead>
              <tbody>
                {ladderOverview.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      style={{
                        padding: '12px',
                        textAlign: 'center',
                        color: 'var(--color-fg-muted)',
                        fontSize: '12px',
                      }}
                    >
                      NO LADDER RECORDS
                    </td>
                  </tr>
                ) : (
                  ladderOverview.map((e, idx) => (
                    <tr key={e.userId || idx} style={{ borderBottom: '1px solid var(--color-border-muted)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 'bold', color: 'var(--color-fg-default)' }}>
                        {e.rank}
                      </td>
                      <td style={{ padding: '8px 12px', fontWeight: 500, color: 'var(--color-fg-default)' }}>
                        {e.name}
                      </td>
                      <td
                        style={{
                          padding: '8px 12px',
                          textAlign: 'right',
                          fontWeight: 'bold',
                          color: 'var(--color-attention-fg)',
                        }}
                      >
                        {e.elo}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--color-fg-default)' }}>
                        {e.wins}-{e.losses}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RACES Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <Heading
          as="h3"
          style={{
            fontSize: '14px',
            fontWeight: 'bold',
            letterSpacing: '0.05em',
            color: 'var(--color-fg-muted)',
            margin: 0,
          }}
        >
          RACES
        </Heading>
        <EventRacesList event={event} />
      </div>
    </div>
  )
}
