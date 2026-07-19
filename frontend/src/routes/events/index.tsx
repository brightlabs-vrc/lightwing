import { useAuth } from '../../hooks/useAuth'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
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
  DRAFT: 'bg-slate-100 text-slate-600',
  UNOFFICIAL: 'bg-blue-100 text-blue-700',
  OFFICIAL: 'bg-green-100 text-green-700',
  CONCLUDED: 'bg-purple-100 text-purple-700',
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
  if (error) return <div className="p-6 text-red-600">Error loading events.</div>

  const authHeader = `Bearer ${session?.session.token ?? ''}`

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Events</h1>
      <div className="space-y-4">
        {data?.events.map((event) => {
          const isMember = session && event.members.some((m) => m.userId === session.user.id)
          return (
            <div key={event.id} className="border rounded-lg p-4 bg-white">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-semibold">{event.name}</h2>
                  <p className="text-slate-600 mt-1">{event.description}</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[event.status]}`}>
                  {STATUS_LABELS[event.status]}
                </span>
              </div>
              <div className="mt-3 flex gap-4 text-sm text-slate-500">
                <span>{SCORING_LABELS[event.scoringType] ?? 'Unknown'}</span>
                <span>
                  {event.classRestriction ? `Class: ${CLASS_TIER_LABELS[event.classRestriction as any]}` : 'Open class'}
                </span>
                <span>{event.members.length} participants</span>
              </div>
              <button
                className="mt-3 bg-blue-500 text-white px-4 py-2 rounded disabled:bg-gray-400"
                disabled={!session || joinMutation.isPending || leaveMutation.isPending}
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
                {!session ? 'Sign in to join' : isMember ? 'Withdraw' : 'Sign up'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
