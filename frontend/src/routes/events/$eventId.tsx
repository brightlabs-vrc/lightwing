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
  1: 'POINTS-BASED',
  2: 'LADDER-ELO',
}

const STATUS_COLORS: Record<eventmanager.EventStatus, string> = {
  DRAFT: 'bg-retro-muted text-white',
  UNOFFICIAL: 'bg-retro-cyan text-white',
  OFFICIAL: 'bg-retro-green text-white',
  CONCLUDED: 'bg-retro-pink text-white',
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
  if (error) return <div className="p-6 text-retro-red font-pixel text-sm">Error loading event details.</div>

  if (!event) return null

  const isMember = session && event.members.some((m) => m.userId === session.user.id)

  return (
    <div className="w-full">
      <Link
        to="/events"
        className="font-pixel text-xs bg-retro-surface text-retro-text border-2 border-retro-border-strong pxl-corner-sm pxl-shadow-hover px-3 py-1.5 mb-6 inline-block hover:bg-retro-card text-center"
      >
        &lt; BACK TO EVENTS
      </Link>

      {/* Main Info Card */}
      <div className="border-4 border-retro-border-strong bg-retro-surface p-6 pxl-corner-md pxl-shadow mb-6">
        <div className="flex justify-between items-start gap-4 flex-wrap mb-4">
          <h1 className="text-2xl font-pixel tracking-wider text-retro-primary">{event.name}</h1>
          <span className={`font-pixel text-xs px-3 py-1 border-2 border-retro-border-strong pxl-corner-sm pxl-shadow ${STATUS_COLORS[event.status]}`}>
            {event.status.toUpperCase()}
          </span>
        </div>

        {event.description && (
          <p className="text-retro-text mb-6 font-sans leading-relaxed text-sm">{event.description}</p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 font-pixel text-xs text-retro-muted">
          <div className="bg-retro-card p-3 border-2 border-retro-border pxl-corner-sm flex justify-between items-center text-retro-text">
            <span>SCORING TYPE:</span>
            <span className="font-semibold text-retro-primary">{SCORING_LABELS[event.scoringType] ?? 'UNKNOWN'}</span>
          </div>
          <div className="bg-retro-card p-3 border-2 border-retro-border pxl-corner-sm flex justify-between items-center text-retro-text">
            <span>CLASS RESTRICTION:</span>
            <span className="font-semibold text-retro-pink">
              {event.classRestriction ? CLASS_TIER_LABELS[event.classRestriction as any] : 'OPEN TO ALL'}
            </span>
          </div>
        </div>

        <div className="pt-4 border-t-2 border-retro-border flex gap-4">
          {!session ? (
            <Link
              to="/auth"
              search={{ redirect: `/events/${eventId}` }}
              className="font-pixel text-sm bg-retro-primary text-white border-2 border-retro-border-strong pxl-corner-sm pxl-shadow-hover px-5 py-2.5 transition-all text-center"
            >
              SIGN IN TO JOIN
            </Link>
          ) : (
            <button
              className={`font-pixel text-sm border-2 border-retro-border-strong pxl-corner-sm pxl-shadow-hover px-5 py-2.5 transition-all text-white ${
                event.status === 'CONCLUDED'
                  ? 'bg-retro-muted cursor-not-allowed'
                  : isMember
                  ? 'bg-retro-red hover:bg-red-700 cursor-pointer'
                  : 'bg-retro-green hover:bg-green-700 cursor-pointer'
              } disabled:opacity-50`}
              disabled={event.status === 'CONCLUDED' || joinMutation.isPending || leaveMutation.isPending}
              onClick={() => {
                if (event.status === 'CONCLUDED') return
                if (isMember) {
                  leaveMutation.mutate(eventId)
                } else {
                  joinMutation.mutate(eventId)
                }
              }}
            >
              {isMember ? 'WITHDRAW FROM EVENT' : 'SIGN UP FOR EVENT'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        {/* Participants Panel */}
        <div>
          <h2 className="text-sm font-pixel tracking-wider text-retro-primary mb-3">
            PARTICIPANTS ({event.members.length})
          </h2>
          <div className="border-4 border-retro-border-strong bg-retro-card pxl-corner-sm pxl-shadow">
            <table className="w-full text-xs">
              <thead className="bg-retro-surface">
                <tr>
                  <th className="text-left px-4 py-2 font-pixel text-xs text-retro-text border-b-4 border-retro-border-strong">
                    NAME
                  </th>
                  <th className="text-left px-4 py-2 font-pixel text-xs text-retro-text border-b-4 border-retro-border-strong">
                    CLASS TIER
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-retro-border">
                {event.members.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-8 py-4 text-center font-pixel text-xs text-retro-muted">
                      NO MEMBERS YET
                    </td>
                  </tr>
                ) : (
                  event.members.map((member) => (
                    <tr key={member.userId} className="hover:bg-retro-surface/30">
                      <td className="px-4 py-2 font-medium text-retro-text">{member.name}</td>
                      <td className="px-4 py-2">
                        <span className="font-pixel text-[11px] bg-retro-surface px-1.5 py-0.5 border border-retro-border pxl-corner-sm">
                          {member.classTier ? CLASS_TIER_LABELS[member.classTier as any] : '-'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Schedule Panel */}
        {event.schedules && event.schedules.length > 0 && (
          <div>
            <h2 className="text-sm font-pixel tracking-wider text-retro-primary mb-3">SCHEDULE</h2>
            <div className="border-4 border-retro-border-strong bg-retro-card p-4 pxl-corner-sm pxl-shadow space-y-4">
              {event.schedules.map((schedule) => (
                <div key={schedule.id} className="border-b-2 border-retro-border last:border-b-0 pb-3 last:pb-0">
                  <div className="font-pixel text-xs text-retro-primary">{schedule.title || 'UNTITLED'}</div>
                  <div className="text-xs text-retro-muted mt-2 font-sans">
                    {new Date(schedule.startsAt).toLocaleString()}
                    {schedule.location && (
                      <span className="block mt-1 font-pixel text-[11px] text-retro-text bg-retro-surface px-2 py-0.5 border border-retro-border pxl-corner-sm inline-block">
                        📍 {schedule.location}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Standings (Points) */}
      {event.pointsOverview && (
        <div className="mt-8">
          <div className="flex items-center mb-3 flex-wrap gap-2">
            <h2 className="text-sm font-pixel tracking-wider text-retro-primary">
              STANDINGS (POINTS)
            </h2>
            {event.status !== 'CONCLUDED' && (
              <span className="font-pixel text-[11px] bg-retro-gold text-retro-text px-2.5 py-0.5 border-2 border-retro-border-strong pxl-corner-sm pxl-shadow">
                PROVISIONAL
              </span>
            )}
          </div>
          <div className="border-4 border-retro-border-strong bg-retro-card pxl-corner-sm pxl-shadow">
            <table className="w-full text-xs">
              <thead className="bg-retro-surface">
                <tr>
                  <th className="text-left px-4 py-2 font-pixel text-xs text-retro-text border-b-4 border-retro-border-strong w-16">
                    #
                  </th>
                  <th className="text-left px-4 py-2 font-pixel text-xs text-retro-text border-b-4 border-retro-border-strong">
                    PARTICIPANT
                  </th>
                  <th className="text-right px-4 py-2 font-pixel text-xs text-retro-text border-b-4 border-retro-border-strong w-32">
                    TOTAL POINTS
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-retro-border">
                {event.pointsOverview.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-8 py-4 text-center font-pixel text-xs text-retro-muted">
                      NO RESULTS RECORDED
                    </td>
                  </tr>
                ) : (
                  event.pointsOverview.map((entry, index) => (
                    <tr key={entry.userId} className="hover:bg-retro-surface/30">
                      <td className="px-4 py-2 font-pixel text-xs text-retro-muted">{index + 1}</td>
                      <td className="px-4 py-2 font-medium text-retro-text">{entry.name}</td>
                      <td className="px-4 py-2 text-right font-pixel text-xs text-retro-primary">{entry.points}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Standings (Ladder) */}
      {event.ladderOverview && (
        <div className="mt-8">
          <div className="flex items-center mb-3 flex-wrap gap-2">
            <h2 className="text-sm font-pixel tracking-wider text-retro-primary">
              STANDINGS (LADDER)
            </h2>
            {event.status !== 'CONCLUDED' && (
              <span className="font-pixel text-[11px] bg-retro-gold text-retro-text px-2.5 py-0.5 border-2 border-retro-border-strong pxl-corner-sm pxl-shadow">
                PROVISIONAL
              </span>
            )}
          </div>
          <div className="border-4 border-retro-border-strong bg-retro-card pxl-corner-sm pxl-shadow">
            <table className="w-full text-xs">
              <thead className="bg-retro-surface">
                <tr>
                  <th className="text-left px-4 py-2 font-pixel text-xs text-retro-text border-b-4 border-retro-border-strong w-16">
                    RANK
                  </th>
                  <th className="text-left px-4 py-2 font-pixel text-xs text-retro-text border-b-4 border-retro-border-strong">
                    PARTICIPANT
                  </th>
                  <th className="text-right px-4 py-2 font-pixel text-xs text-retro-text border-b-4 border-retro-border-strong w-24">
                    ELO
                  </th>
                  <th className="text-right px-4 py-2 font-pixel text-xs text-retro-text border-b-4 border-retro-border-strong w-24">
                    W-L
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-retro-border">
                {event.ladderOverview.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-8 py-4 text-center font-pixel text-xs text-retro-muted">
                      NO LADDER RECORDS
                    </td>
                  </tr>
                ) : (
                  event.ladderOverview.map((entry) => (
                    <tr key={entry.userId} className="hover:bg-retro-surface/30">
                      <td className="px-4 py-2 font-pixel text-xs text-retro-muted">{entry.rank}</td>
                      <td className="px-4 py-2 font-medium text-retro-text">{entry.name}</td>
                      <td className="px-4 py-2 text-right font-pixel text-xs text-retro-gold">{entry.elo}</td>
                      <td className="px-4 py-2 text-right font-pixel text-xs text-retro-text">{entry.wins}-{entry.losses}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
