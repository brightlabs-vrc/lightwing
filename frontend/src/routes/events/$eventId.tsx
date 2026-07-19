import { createFileRoute, Link } from '@tanstack/react-router'
import { useAuth } from '../../hooks/useAuth'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getPublicEvent, joinEvent, leaveEvent } from '../../lib/public-api'
import {
  PixelContainer,
  PixelStack,
  PixelCard,
  PixelButton,
  PixelBadge,
  PixelTable,
  PixelSpinner,
  PixelSectionHeader,
  PixelEmptyState,
  type PixelTableColumn,
} from '@pxlkit/ui-kit'
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

const STATUS_TONE: Record<eventmanager.EventStatus, 'neutral' | 'cyan' | 'green' | 'pink'> = {
  DRAFT: 'neutral',
  UNOFFICIAL: 'cyan',
  OFFICIAL: 'green',
  CONCLUDED: 'pink',
}

export const Route = createFileRoute('/events/$eventId')({
  component: EventDetailPage,
})

function EventDetailPage() {
  const { eventId } = Route.useParams()
  const queryClient = useQueryClient()
  const { session } = useAuth()

  const { data: event, isLoading, error } = useQuery({
    queryKey: ['public-event', eventId],
    queryFn: () => getPublicEvent(eventId),
  })

  const joinMutation = useMutation({
    mutationFn: (id: string) => joinEvent(id, `Bearer ${session?.session.token ?? ''}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public-event', eventId] })
    },
  })

  const leaveMutation = useMutation({
    mutationFn: (id: string) => leaveEvent(id, `Bearer ${session?.session.token ?? ''}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public-event', eventId] })
    },
  })

  if (isLoading) {
    return (
      <PixelStack align="center" justify="center" gap={4} className="py-20">
        <PixelSpinner size="lg" label="Loading event..." />
      </PixelStack>
    )
  }
  if (error) {
    return (
      <PixelContainer maxWidth="md" padding="md">
        <PixelEmptyState
          title="Error loading event"
          description="Something went wrong while fetching the event details."

        />
      </PixelContainer>
    )
  }

  if (!event) return null

  const isMember = session && event.members.some((m) => m.userId === session.user.id)
  const isConcluded = event.status === 'CONCLUDED'

  const participantColumns: PixelTableColumn<eventmanager.EventMemberView>[] = [
    { key: 'name', header: 'NAME', render: (m) => <span className="font-medium">{m.name}</span> },
    {
      key: 'classTier',
      header: 'CLASS TIER',
      render: (m) =>
        m.classTier ? (
          <PixelBadge tone="neutral">{CLASS_TIER_LABELS[m.classTier as any]}</PixelBadge>
        ) : (
          <span className="text-retro-muted">-</span>
        ),
    },
  ]

  const pointsColumns: PixelTableColumn<eventmanager.PointsEntryView>[] = [
    { key: 'rank', header: '#', width: 64, render: (_e, idx) => idx + 1 },
    { key: 'name', header: 'PARTICIPANT', render: (e) => <span className="font-medium">{e.name}</span> },
    {
      key: 'points',
      header: 'TOTAL POINTS',
      align: 'right',
      width: 128,
      render: (e) => <span className="text-retro-primary">{e.points}</span>,
    },
  ]

  const ladderColumns: PixelTableColumn<eventmanager.LadderEntryView>[] = [
    { key: 'rank', header: 'RANK', width: 64, render: (e) => e.rank },
    { key: 'name', header: 'PARTICIPANT', render: (e) => <span className="font-medium">{e.name}</span> },
    {
      key: 'elo',
      header: 'ELO',
      align: 'right',
      width: 96,
      render: (e) => <span className="text-retro-gold">{e.elo}</span>,
    },
    {
      key: 'wl',
      header: 'W-L',
      align: 'right',
      width: 96,
      render: (e) => `${e.wins}-${e.losses}`,
    },
  ]

  return (
    <PixelContainer maxWidth="full" padding="md">
      <PixelButton asChild variant="ghost" tone="neutral" size="sm" className="mb-6">
        <Link to="/events">&lt; BACK TO EVENTS</Link>
      </PixelButton>

      {/* Main Info Card */}
      <PixelCard className="mb-6">
        <PixelStack gap={4}>
          <PixelStack direction="row" gap={4} align="start" justify="between" wrap>
            <h1 className="text-2xl font-pixel tracking-wider text-retro-primary">{event.name}</h1>
            <PixelBadge tone={STATUS_TONE[event.status]}>{event.status.toUpperCase()}</PixelBadge>
          </PixelStack>

          {event.description && (
            <p className="text-retro-text font-sans leading-relaxed text-sm">{event.description}</p>
          )}

          <PixelStack direction="row" gap={4} wrap>
            <PixelBadge tone="neutral">
              SCORING TYPE: {SCORING_LABELS[event.scoringType] ?? 'UNKNOWN'}
            </PixelBadge>
            <PixelBadge tone="neutral">
              CLASS RESTRICTION:{' '}
              {event.classRestriction ? CLASS_TIER_LABELS[event.classRestriction as any] : 'OPEN TO ALL'}
            </PixelBadge>
          </PixelStack>

          <div className="pt-4 border-t-2 border-retro-border">
            {!session ? (
              <PixelButton asChild variant="solid" tone="purple" className="pxl-btn-flat">
                <Link to="/auth" search={{ redirect: `/events/${eventId}` }}>
                  SIGN IN TO JOIN
                </Link>
              </PixelButton>
            ) : (
              <PixelButton
                variant="solid"
                tone={isMember ? 'red' : 'green'}
                className="pxl-btn-flat"
                disabled={isConcluded || joinMutation.isPending || leaveMutation.isPending}
                loading={joinMutation.isPending || leaveMutation.isPending}
                onClick={() => {
                  if (isConcluded) return
                  if (isMember) {
                    leaveMutation.mutate(eventId)
                  } else {
                    joinMutation.mutate(eventId)
                  }
                }}
              >
                {isMember ? 'WITHDRAW FROM EVENT' : 'SIGN UP FOR EVENT'}
              </PixelButton>
            )}
          </div>
        </PixelStack>
      </PixelCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        {/* Participants Panel */}
        <div>
          <PixelSectionHeader title={`PARTICIPANTS (${event.members.length})`} size="sm" spacing="tight" />
          <PixelTable
            columns={participantColumns}
            data={event.members}
            emptyState={<span className="font-pixel text-xs text-retro-muted">NO MEMBERS YET</span>}
          />
        </div>

        {/* Schedule Panel */}
        {event.schedules && event.schedules.length > 0 && (
          <div>
            <PixelSectionHeader title="SCHEDULE" size="sm" spacing="tight" />
            <PixelCard className="">
              <PixelStack gap={4}>
                {event.schedules.map((schedule) => (
                  <PixelStack
                    key={schedule.id}
                    gap={2}
                    className="border-b-2 border-retro-border last:border-b-0 pb-3 last:pb-0"
                  >
                    <div className="font-pixel text-xs text-retro-primary">
                      {schedule.title || 'UNTITLED'}
                    </div>
                    <div className="text-xs text-retro-muted font-sans">
                      {new Date(schedule.startsAt).toLocaleString()}
                      {schedule.location && (
                        <span className="block mt-1 font-pixel text-[11px] text-retro-text bg-retro-surface px-2 py-0.5 border border-retro-border pxl-corner-sm inline-block">
                          📍 {schedule.location}
                        </span>
                      )}
                    </div>
                  </PixelStack>
                ))}
              </PixelStack>
            </PixelCard>
          </div>
        )}
      </div>

      {/* Standings (Points) */}
      {event.pointsOverview && (
        <div className="mt-8">
          <PixelStack direction="row" gap={3} align="center" wrap className="mb-4">
            <h2 className="font-pixel text-sm tracking-wider text-retro-text">
              STANDINGS (POINTS)
            </h2>
            {!isConcluded ? <PixelBadge tone="gold">PROVISIONAL</PixelBadge> : null}
          </PixelStack>
          <PixelTable
            columns={pointsColumns}
            data={event.pointsOverview}
            emptyState={
              <span className="font-pixel text-xs text-retro-muted">NO RESULTS RECORDED</span>
            }
          />
        </div>
      )}

      {/* Standings (Ladder) */}
      {event.ladderOverview && (
        <div className="mt-8">
          <PixelStack direction="row" gap={3} align="center" wrap className="mb-4">
            <h2 className="font-pixel text-sm tracking-wider text-retro-text">
              STANDINGS (LADDER)
            </h2>
            {!isConcluded ? <PixelBadge tone="gold">PROVISIONAL</PixelBadge> : null}
          </PixelStack>
          <PixelTable
            columns={ladderColumns}
            data={event.ladderOverview}
            emptyState={
              <span className="font-pixel text-xs text-retro-muted">NO LADDER RECORDS</span>
            }
          />
        </div>
      )}
    </PixelContainer>
  )
}
