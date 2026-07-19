import { createFileRoute, Link } from '@tanstack/react-router'
import { useAuth } from '../../hooks/useAuth'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getPublicEvent, joinEvent, leaveEvent } from '../../lib/public-api'
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

  if (isLoading) return <LoadingBox message="Loading event..." />
  if (error) return <div className="p-6 text-red-600">Error loading event.</div>

  if (!event) return null

  const isMember = session && event.members.some((m) => m.userId === session.user.id)

  return (
    <div className="p-6">
      <Link to="/events" className="text-sm text-slate-600 hover:text-slate-900 mb-4 inline-block">
        ← Back to Events
      </Link>
      
      <div className="border rounded-lg p-6 bg-white">
        <div className="flex justify-between items-start mb-4">
          <h1 className="text-3xl font-bold">{event.name}</h1>
          <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
            {event.status}
          </span>
        </div>
        
        {event.description && (
          <p className="text-slate-700 mb-4">{event.description}</p>
        )}
        
        <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
          <div>
            <span className="text-slate-500">Scoring:</span>
            <span className="ml-2 font-medium">{SCORING_LABELS[event.scoringType] ?? 'Unknown'}</span>
          </div>
          <div>
            <span className="text-slate-500">Class:</span>
            <span className="ml-2 font-medium">
              {event.classRestriction ? CLASS_TIER_LABELS[event.classRestriction as any] : 'Open to all'}
            </span>
          </div>
        </div>

        {!session ? (
          <Link
            to="/auth"
            search={{ redirect: `/events/\${eventId}` }}
            className="inline-block bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600"
          >
            Sign in to join
          </Link>
        ) : (
          <button
            className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
            disabled={joinMutation.isPending || leaveMutation.isPending}
            onClick={() => {
              if (isMember) {
                leaveMutation.mutate(eventId)
              } else {
                joinMutation.mutate(eventId)
              }
            }}
          >
            {isMember ? 'Withdraw from Event' : 'Sign Up for Event'}
          </button>
        )}
      </div>

      <div className="mt-6">
        <h2 className="text-xl font-semibold mb-3">Participants ({event.members.length})</h2>
        <div className="border rounded-lg bg-white">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left p-3 text-sm font-medium text-slate-600">Name</th>
                <th className="text-left p-3 text-sm font-medium text-slate-600">Class Tier</th>
              </tr>
            </thead>
            <tbody>
              {event.members.map((member) => (
                <tr key={member.userId} className="border-t">
                  <td className="p-3">{member.name}</td>
                  <td className="p-3">{member.classTier ? CLASS_TIER_LABELS[member.classTier as any] : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {event.schedules && event.schedules.length > 0 && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-3">Schedule</h2>
          <div className="border rounded-lg bg-white divide-y">
            {event.schedules.map((schedule) => (
              <div key={schedule.id} className="p-4">
                <div className="font-medium">{schedule.title || 'Untitled'}</div>
                <div className="text-sm text-slate-600 mt-1">
                  {new Date(schedule.startsAt).toLocaleString()}
                  {schedule.location && ` • ${schedule.location}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {event.pointsOverview && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-3">Standings (Points)</h2>
          <div className="border rounded-lg bg-white">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left p-3 text-sm font-medium text-slate-600">#</th>
                  <th className="text-left p-3 text-sm font-medium text-slate-600">Name</th>
                  <th className="text-right p-3 text-sm font-medium text-slate-600">Points</th>
                </tr>
              </thead>
              <tbody>
                {event.pointsOverview.map((entry, index) => (
                  <tr key={entry.userId} className="border-t">
                    <td className="p-3">{index + 1}</td>
                    <td className="p-3">{entry.name}</td>
                    <td className="p-3 text-right">{entry.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {event.ladderOverview && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-3">Standings (Ladder)</h2>
          <div className="border rounded-lg bg-white">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left p-3 text-sm font-medium text-slate-600">#</th>
                  <th className="text-left p-3 text-sm font-medium text-slate-600">Name</th>
                  <th className="text-right p-3 text-sm font-medium text-slate-600">ELO</th>
                  <th className="text-right p-3 text-sm font-medium text-slate-600">W-L</th>
                </tr>
              </thead>
              <tbody>
                {event.ladderOverview.map((entry) => (
                  <tr key={entry.userId} className="border-t">
                    <td className="p-3">{entry.rank}</td>
                    <td className="p-3">{entry.name}</td>
                    <td className="p-3 text-right">{entry.elo}</td>
                    <td className="p-3 text-right">{entry.wins}-{entry.losses}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
