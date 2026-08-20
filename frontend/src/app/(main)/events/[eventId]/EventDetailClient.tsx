'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getPublicEvent, joinEvent, leaveEvent, getPublicRaceResults, listPublicRaceEvents } from '@/lib/public-api'
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

interface EventDetailClientProps {
  event: eventmanager.EventDetail
}

function RaceStandingsTable({ eventId, raceId, members }: { eventId: string; raceId: string; members: eventmanager.EventMemberView[] }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['public-race-results', eventId, raceId],
    queryFn: () => getPublicRaceResults(eventId, raceId),
  })

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem', gap: '0.5rem', color: 'var(--color-fg-muted)' }}>
        <Spinner size="small" /><span>Loading standings...</span>
      </div>
    )
  }

  if (error || !data) {
    return <span style={{ fontSize: '12px', color: 'var(--color-danger-fg)' }}>ERROR LOADING STANDINGS</span>
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
          </tr>
        </thead>
        <tbody>
          {results.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ padding: '12px', textAlign: 'center', color: 'var(--color-fg-muted)', fontStyle: 'italic' }}>
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
                  <td style={{ padding: '8px' }}>{r.finishTime ? formatLocalDateTime(r.finishTime) : '-'}</td>
                  <td style={{ padding: '8px' }}>{r.margin ?? '-'}</td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}

export function EventDetailClient({ event }: EventDetailClientProps) {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const { addToast } = useNotification()
  const [activeRaceId, setActiveRaceId] = useState<string | null>(null)

  const isCreator = session?.user.id === event.ownerUserId
  const canJoin = session?.session && !isCreator && event.status !== 'CONCLUDED' && event.participantLimit === null
  const isMember = session?.session && event.members?.some((m) => m.userId === session.user.id)

  const { data: racesData, isLoading: racesLoading } = useQuery({
    queryKey: ['public-race-events', event.id],
    queryFn: () => listPublicRaceEvents(event.id),
    enabled: !!event.id,
  })

  const joinMutation = useMutation({
    mutationFn: () => joinEvent(event.id, session?.session?.token ?? ''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public-event', event.id] })
      addToast({ message: 'Joined event successfully', severity: 'success' })
    },
    onError: (error: Error) => {
      addToast({ message: error.message || 'Failed to join event', severity: 'error' })
    },
  })

  const leaveMutation = useMutation({
    mutationFn: () => leaveEvent(event.id, session?.session?.token ?? ''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public-event', event.id] })
      addToast({ message: 'Left event successfully', severity: 'success' })
    },
    onError: (error: Error) => {
      addToast({ message: error.message || 'Failed to leave event', severity: 'error' })
    },
  })

  const races = racesData?.races ?? []
  const members = event.members ?? []
  const selectedRace = races.find((r) => r.id === activeRaceId)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        {!session?.session ? (
          <Link href={`/auth?redirect=${encodeURIComponent(`/events/${event.id}`)}`} style={{ textDecoration: 'none' }}>
            <Button variant="primary">Sign in to Join</Button>
          </Link>
        ) : canJoin && !isMember ? (
          <Button
            variant="primary"
            onClick={() => joinMutation.mutate()}
            disabled={joinMutation.isPending}
          >
            {joinMutation.isPending ? 'Joining...' : 'Join Event'}
          </Button>
        ) : isMember ? (
          <Button
            variant="danger"
            onClick={() => leaveMutation.mutate()}
            disabled={leaveMutation.isPending}
          >
            {leaveMutation.isPending ? 'Leaving...' : 'Leave Event'}
          </Button>
        ) : null}
        {isCreator && (
          <Link href={`/admin/events/${event.id}`} style={{ textDecoration: 'none' }}>
            <Button>Admin</Button>
          </Link>
        )}
      </div>

      {/* Race List */}
      <div style={{ border: '1px solid var(--color-border-default)', borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid var(--color-border-default)', backgroundColor: 'var(--color-canvas-subtle)' }}>
          <Heading as="h3" style={{ fontSize: '16px', margin: 0 }}>Races ({races.length})</Heading>
        </div>
        {racesLoading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-fg-muted)' }}>
            <Spinner size="medium" />
          </div>
        ) : races.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-fg-muted)' }}>
            No races created yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {races.map((race, idx) => (
              <button
                key={race.id}
                onClick={() => setActiveRaceId(race.id)}
                style={{
                  width: '100%',
                  padding: '1rem',
                  textAlign: 'left',
                  border: 'none',
                  borderBottom: '1px solid var(--color-border-default)',
                  background: 'none',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                  fontSize: '14px',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-canvas-subtle)' }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>
                    <strong>#{race.sequence}</strong> {race.name}
                    <span style={{ marginLeft: '0.5rem', color: 'var(--color-fg-muted)', fontSize: '12px' }}>
                      {race.distanceMeters}m • {race.trackType}
                    </span>
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--color-fg-muted)' }}>
                    {race.startsAt ? formatLocalDateTime(race.startsAt) : 'Not started'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Race Standings */}
      {selectedRace && (
        <div style={{ border: '1px solid var(--color-border-default)', borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--color-border-default)', backgroundColor: 'var(--color-canvas-subtle)' }}>
            <Heading as="h3" style={{ fontSize: '16px', margin: 0 }}>
              #{selectedRace.sequence} {selectedRace.name} — Standings
            </Heading>
          </div>
          <RaceStandingsTable eventId={event.id} raceId={selectedRace.id} members={members} />
        </div>
      )}

      {/* Members */}
      <div style={{ border: '1px solid var(--color-border-default)', borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid var(--color-border-default)', backgroundColor: 'var(--color-canvas-subtle)' }}>
          <Heading as="h3" style={{ fontSize: '16px', margin: 0 }}>Participants ({members.length})</Heading>
        </div>
        {members.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-fg-muted)' }}>
            No participants yet.
          </div>
        ) : (
          <div style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {members.map((member) => (
                <span
                  key={member.userId}
                  style={{
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    backgroundColor: 'var(--color-canvas-subtle)',
                    fontSize: '13px',
                    border: '1px solid var(--color-border-default)',
                  }}
                >
                  {member.name} {member.classTier && member.classTier !== 'PRE_OP' && member.classTier !== 'OP' ? `(${member.classTier})` : ''}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
