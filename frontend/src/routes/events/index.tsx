import { useAuth } from '../../hooks/useAuth'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { listPublicEvents, joinEvent, leaveEvent } from '../../lib/public-api'
import { LoadingBox } from '../../components/LoadingBox'
import type { eventmanager } from '../../lib/client'

const CLASS_TIER_LABELS: Record<string, string> = {
  PRE_OP: 'PRE-OP',
  OP: 'OP',
  G3: 'G3',
  G2: 'G2',
  G1: 'G1',
}

const SCORING_LABELS: Record<number, string> = {
  1: 'points-based',
  2: 'ladder-elo',
}

const STATUS_LABELS: Record<eventmanager.EventStatus, string> = {
  DRAFT: 'Draft',
  UNOFFICIAL: 'Unofficial',
  OFFICIAL: 'Official',
  CONCLUDED: 'Concluded',
}

const STATUS_COLORS: Record<eventmanager.EventStatus, string> = {
  DRAFT: 'bg-retro-muted text-white',
  UNOFFICIAL: 'bg-retro-cyan text-white',
  OFFICIAL: 'bg-retro-green text-white',
  CONCLUDED: 'bg-retro-pink text-white',
}

export const Route = createFileRoute('/events/')({
  component: EventsPage,
})

function EventsPage() {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const navigate = useNavigate()

  const { data, isLoading, error } = useQuery({
    queryKey: ['public-events'],
    queryFn: () => listPublicEvents(),
  })

  const joinMutation = useMutation({
    mutationFn: (eventId: string) => joinEvent(eventId, `Bearer ${session?.session.token ?? ''}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public-events'] })
    },
  })

  const leaveMutation = useMutation({
    mutationFn: (eventId: string) => leaveEvent(eventId, `Bearer ${session?.session.token ?? ''}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public-events'] })
    },
  })

  if (isLoading) return <LoadingBox message="Loading events..." />
  if (error) return <div className="p-6 text-retro-red font-pixel text-xs">Error loading events.</div>

  // Filter events to exclude DRAFT
  const publicEvents = data?.events.filter((event) => event.status !== 'DRAFT') || []

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-pixel tracking-wider text-retro-primary">COMPETITIVE EVENTS</h1>
        <span className="font-pixel text-[10px] bg-retro-surface border-2 border-retro-border px-3 py-1 pxl-corner-sm">
          {publicEvents.length} ACTIVE
        </span>
      </div>

      <div className="space-y-6">
        {publicEvents.length === 0 ? (
          <div className="border-4 border-dashed border-retro-border bg-retro-surface p-8 text-center rounded-xl">
            <p className="font-pixel text-xs text-retro-muted">No public events active at this moment.</p>
          </div>
        ) : (
          publicEvents.map((event) => {
            const isMember = session && event.members.some((m) => m.userId === session.user.id)
            return (
              <div
                key={event.id}
                className="border-4 border-retro-border-strong bg-retro-surface p-6 pxl-corner-md pxl-shadow-hover hover:border-retro-primary transition-all duration-150"
              >
                <div className="flex justify-between items-start gap-4 flex-wrap">
                  <div>
                    <h2 className="text-lg font-pixel tracking-wide text-retro-text hover:text-retro-primary">
                      <Link to="/events/$eventId" params={{ eventId: event.id }} className="hover:underline">
                        {event.name}
                      </Link>
                    </h2>
                    {event.description && (
                      <p className="text-sm text-retro-muted mt-2 max-w-2xl font-sans leading-relaxed">
                        {event.description}
                      </p>
                    )}
                  </div>
                  <span
                    className={`font-pixel text-[10px] px-3 py-1.5 border-2 border-retro-border-strong pxl-corner-sm pxl-shadow ${
                      STATUS_COLORS[event.status]
                    }`}
                  >
                    {STATUS_LABELS[event.status].toUpperCase()}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-4 text-xs font-pixel text-[10px] text-retro-muted">
                  <span className="bg-retro-card px-2 py-1 border-2 border-retro-border pxl-corner-sm text-retro-text">
                    SCORING: {SCORING_LABELS[event.scoringType]?.toUpperCase() || 'UNKNOWN'}
                  </span>
                  <span className="bg-retro-card px-2 py-1 border-2 border-retro-border pxl-corner-sm text-retro-text">
                    CLASS: {event.classRestriction ? CLASS_TIER_LABELS[event.classRestriction as any] : 'OPEN'}
                  </span>
                  <span className="bg-retro-card px-2 py-1 border-2 border-retro-border pxl-corner-sm text-retro-text">
                    MEMBERS: {event.members.length}
                  </span>
                </div>

                <div className="mt-6 flex gap-3">
                  <Link
                    to="/events/$eventId"
                    params={{ eventId: event.id }}
                    className="font-pixel text-[11px] bg-retro-surface text-retro-text hover:bg-retro-card border-2 border-retro-border-strong pxl-corner-sm pxl-shadow-hover px-4 py-2 transition-all cursor-pointer text-center"
                  >
                    VIEW STANDINGS
                  </Link>

                  <button
                    className={`font-pixel text-[11px] px-4 py-2 border-2 border-retro-border-strong pxl-corner-sm pxl-shadow-hover transition-all cursor-pointer text-white ${
                      !session
                        ? 'bg-retro-primary hover:bg-indigo-700'
                        : isMember
                        ? 'bg-retro-red hover:bg-red-700'
                        : 'bg-retro-green hover:bg-green-700'
                    } disabled:opacity-50`}
                    disabled={joinMutation.isPending || leaveMutation.isPending}
                    onClick={() => {
                      if (!session) {
                        navigate({ to: '/auth', search: { redirect: '/events' } })
                      } else if (isMember) {
                        leaveMutation.mutate(event.id)
                      } else {
                        joinMutation.mutate(event.id)
                      }
                    }}
                  >
                    {!session ? 'SIGN IN TO JOIN' : isMember ? 'WITHDRAW' : 'SIGN UP'}
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
