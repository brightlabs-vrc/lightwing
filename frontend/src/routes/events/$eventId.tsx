import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { usePageHead } from '../../hooks/usePageHead'
import { buildSeoMeta } from '../../lib/seo'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getPublicEvent,
  getPublicTeamProfile,
  joinEvent,
  leaveEvent,
  listPublicRaceEvents,
  getPublicRaceResults,
  joinRaceEvent,
  leaveRaceEvent,
} from '../../lib/public-api'
import { upsertEventTeamRoster, removeEventTeam } from '../../lib/admin-api'
import { formatLocalDateTime } from '../../lib/datetime'
import { computeRaceEffectiveResults } from '../../lib/standings'
import { MarkdownView } from '../../components/MarkdownView'
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
  PixelModal,
  PixelAlert,
  type PixelTableColumn,
  useToast,
} from '@pxlkit/ui-kit'
import type { eventmanager, teammanager } from '../../lib/client'
import type { EventStatus, EventTag } from '../../types'
import { PixelSkeletonDetail } from '../../components/LoadingSkeleton'

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

const STATUS_LABELS: Record<EventStatus, string> = {
  DRAFT: 'Draft',
  PENDING: 'Pending',
  ONGOING: 'Ongoing',
  CONCLUDED: 'Concluded',
  PENDING_DELETION: 'Pending Deletion',
}

const TAG_LABELS: Record<EventTag, string> = {
  OFFICIAL: 'Official',
  COMMUNITY: 'Community',
}

const STATUS_TONE: Record<EventStatus, 'neutral' | 'cyan' | 'green' | 'pink'> = {
  DRAFT: 'neutral',
  PENDING: 'cyan',
  ONGOING: 'green',
  CONCLUDED: 'pink',
  PENDING_DELETION: 'neutral',
}

const TAG_TONE: Record<EventTag, 'purple' | 'cyan'> = {
  OFFICIAL: 'purple',
  COMMUNITY: 'cyan',
}

export const Route = createFileRoute('/events/$eventId')({
  ssr: 'data-only',
  loader: async ({ params }) => {
    try {
      const event = await getPublicEvent(params.eventId)
      return { event }
    } catch {
      return { event: null }
    }
  },
  head: ({ loaderData }) => {
    const event = loaderData?.event
    return {
      meta: buildSeoMeta({
        title: event ? event.name : 'Event',
        description:
          event?.description ||
          (event ? `Event details for ${event.name} on UmaKeiba.` : undefined),
        image: event?.bannerUrl || undefined,
        type: 'website',
      }),
    }
  },
  pendingComponent: () => (
    <PixelContainer maxWidth="full" padding="md">
      <PixelSkeletonDetail />
    </PixelContainer>
  ),
  component: EventDetailPage,
})

function EventDetailPage() {
  const { eventId } = Route.useParams()
  const loaderData = Route.useLoaderData()
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const { toast } = useToast()

  const { data: event, isLoading, error } = useQuery({
    queryKey: ['public-event', eventId],
    queryFn: () => getPublicEvent(eventId),
    initialData: loaderData?.event ?? undefined,
  })

  usePageHead({
    title: event ? event.name : 'Event',
    description: event?.description || (event ? `Event details for ${event.name} on UmaKeiba.` : undefined),
    image: event?.bannerUrl || undefined,
    type: 'website',
  })

  // Team Admin self-service roster modal state
  const [showTeamModal, setShowTeamModal] = useState(false)
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [selectedTeamDetail, setSelectedTeamDetail] = useState<teammanager.Team | null>(null)
  const [loadingTeamDetail, setLoadingTeamDetail] = useState(false)
  const [primaryUserIds, setPrimaryUserIds] = useState<string[]>([])
  const [backupUserIds, setBackupUserIds] = useState<string[]>([])
  const [teamRosterError, setTeamRosterError] = useState<string | null>(null)

  const adminTeams = (session?.user.teams ?? []).filter((t) => {
    const role = (t.role || '').toLowerCase()
    return role === 'administrator' || role === 'admin' || role === 'owner'
  })

  useEffect(() => {
    if (!showTeamModal) return
    if (!selectedTeamId && adminTeams.length > 0) {
      setSelectedTeamId(adminTeams[0].organizationId)
    }
  }, [showTeamModal, selectedTeamId, adminTeams.length])

  useEffect(() => {
    if (!showTeamModal || !selectedTeamId) {
      setSelectedTeamDetail(null)
      return
    }
    let cancelled = false
    setLoadingTeamDetail(true)
    setTeamRosterError(null)
    void getPublicTeamProfile(selectedTeamId)
      .then((detail) => {
        if (cancelled) return
        setSelectedTeamDetail(detail)
        const existing = (event?.teams ?? []).find((t) => t.teamId === selectedTeamId)
        if (existing) {
          setPrimaryUserIds((existing.primaryRoster ?? []).map((m) => m.userId))
          setBackupUserIds((existing.backupRoster ?? []).map((m) => m.userId))
        } else {
          setPrimaryUserIds([])
          setBackupUserIds([])
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setSelectedTeamDetail(null)
          setTeamRosterError(err instanceof Error ? err.message : 'Unable to load team details.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingTeamDetail(false)
      })
    return () => {
      cancelled = true
    }
  }, [showTeamModal, selectedTeamId, event?.teams])

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

  const saveTeamRosterMutation = useMutation({
    mutationFn: () =>
      upsertEventTeamRoster(
        eventId,
        selectedTeamId,
        primaryUserIds,
        backupUserIds,
        `Bearer ${session?.session.token ?? ''}`,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public-event', eventId] })
      queryClient.invalidateQueries({ queryKey: ['public-event-races', eventId] })
      toast({ tone: 'green', title: 'Team roster saved!' })
      setShowTeamModal(false)
    },
    onError: (err: any) => {
      setTeamRosterError(err?.message || 'Failed to save team roster.')
    },
  })

  const withdrawTeamMutation = useMutation({
    mutationFn: (teamId: string) =>
      removeEventTeam(eventId, teamId, `Bearer ${session?.session.token ?? ''}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public-event', eventId] })
      queryClient.invalidateQueries({ queryKey: ['public-event-races', eventId] })
      toast({ tone: 'neutral', title: 'Team withdrawn from event.' })
      setShowTeamModal(false)
    },
    onError: (err: any) => {
      setTeamRosterError(err?.message || 'Failed to withdraw team.')
    },
  })

  if (isLoading) {
    return (
      <PixelContainer maxWidth="full" padding="md">
        <PixelSkeletonDetail />
      </PixelContainer>
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
  const isGranular = event.granularParticipation
  const registeredTeams = event.teams ?? []
  const teamLimitReached =
    event.isTeamEvent &&
    !isGranular &&
    event.participantLimit !== null &&
    registeredTeams.length >= event.participantLimit

  const toggleTeamMemberRole = (userId: string, role: 'NONE' | 'PRIMARY' | 'BACKUP') => {
    setTeamRosterError(null)
    if (role === 'NONE') {
      setPrimaryUserIds((prev) => prev.filter((id) => id !== userId))
      setBackupUserIds((prev) => prev.filter((id) => id !== userId))
      return
    }
    if (role === 'PRIMARY') {
      if (
        !primaryUserIds.includes(userId) &&
        event.maxPrimaryRosterSize !== null &&
        event.maxPrimaryRosterSize > 0 &&
        primaryUserIds.length >= event.maxPrimaryRosterSize
      ) {
        setTeamRosterError(`Primary roster limit is ${event.maxPrimaryRosterSize} per team.`)
        return
      }
      setBackupUserIds((prev) => prev.filter((id) => id !== userId))
      setPrimaryUserIds((prev) => (prev.includes(userId) ? prev : [...prev, userId]))
      return
    }
    if (role === 'BACKUP') {
      if (
        !backupUserIds.includes(userId) &&
        event.maxBackupRosterSize !== null &&
        backupUserIds.length >= event.maxBackupRosterSize
      ) {
        setTeamRosterError(`Backup roster limit is ${event.maxBackupRosterSize} per team.`)
        return
      }
      setPrimaryUserIds((prev) => prev.filter((id) => id !== userId))
      setBackupUserIds((prev) => (prev.includes(userId) ? prev : [...prev, userId]))
    }
  }

  const participantColumns: PixelTableColumn<eventmanager.EventMemberView>[] = [
    {
      key: 'name',
      header: 'NAME',
      width: '35%',
      render: (m) => (
        <div className="truncate font-medium max-w-[200px]" title={m.name}>
          {m.name}
        </div>
      ),
    },
    {
      key: 'classTier',
      header: 'CLASS TIER',
      width: 120,
      render: (m) =>
        m.classTier ? (
          <PixelBadge tone="neutral">{CLASS_TIER_LABELS[m.classTier as any]}</PixelBadge>
        ) : (
          <span className="text-retro-muted">-</span>
        ),
    },
    ...(isGranular
      ? [
          {
            key: 'registeredRaces',
            header: 'REGISTERED RACES',
            render: (m: eventmanager.EventMemberView) => {
              const userRaces = (event.raceEvents ?? []).filter((r) =>
                (r.members ?? []).some((rm) => rm.userId === m.userId)
              )
              if (userRaces.length === 0) {
                return <span className="text-retro-muted text-xs">NONE</span>
              }
              return (
                <div className="flex gap-1 flex-wrap max-h-20 overflow-y-auto">
                  {userRaces.map((r) => (
                    <PixelBadge key={r.id} tone="neutral" title={`#${r.sequence} ${r.name}`}>
                      #{r.sequence} {r.name}
                    </PixelBadge>
                  ))}
                </div>
              )
            },
          },
        ]
      : []),
  ]

  const teamStandingsColumns: PixelTableColumn<eventmanager.TeamPointsEntryView>[] = [
    { key: 'rank', header: '#', width: 64, render: (_t, idx) => idx + 1 },
    {
      key: 'team',
      header: 'TEAM',
      render: (t) => (
        <Link
          to="/$user"
          params={{ user: t.slug || t.teamId }}
          className="font-medium text-retro-text hover:text-retro-primary transition-colors inline-flex items-center gap-2"
        >
          {t.logo && (
            <img
              src={t.logo}
              alt={t.name}
              className="w-5 h-5 rounded border border-retro-border object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          )}
          <span>{t.name}</span>
        </Link>
      ),
    },
    {
      key: 'memberCount',
      header: 'SCORING RACERS',
      align: 'right',
      width: 140,
      render: (t) => <span className="text-retro-muted">{t.memberCount}</span>,
    },
    {
      key: 'points',
      header: 'TEAM POINTS',
      align: 'right',
      width: 128,
      render: (t) => <span className="text-retro-gold font-bold">{t.points}</span>,
    },
  ]

  const pointsColumns: PixelTableColumn<eventmanager.PointsEntryView>[] = [
    { key: 'rank', header: '#', width: 64, render: (_e, idx) => idx + 1 },
    {
      key: 'name',
      header: 'PARTICIPANT',
      render: (e) => (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="truncate font-medium max-w-[200px]" title={e.name}>
            {e.name}
          </span>
          {event.isTeamEvent && e.teamName && (
            <PixelBadge tone="purple">{e.teamName}</PixelBadge>
          )}
        </div>
      ),
    },
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
    {
      key: 'name',
      header: 'PARTICIPANT',
      render: (e) => (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="truncate font-medium max-w-[200px]" title={e.name}>
            {e.name}
          </span>
          {event.isTeamEvent && e.teamName && (
            <PixelBadge tone="purple">{e.teamName}</PixelBadge>
          )}
        </div>
      ),
    },
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

  const selectedTeamAlreadyRegistered = registeredTeams.some((t) => t.teamId === selectedTeamId)
  const isSelectedTeamApprovedTeam = Boolean(selectedTeamDetail && selectedTeamDetail.status === 'APPROVED')

  return (
    <PixelContainer maxWidth="full" padding="md">
      <PixelButton asChild variant="ghost" tone="neutral" size="sm" className="mb-6">
        <Link to="/events">&lt; BACK TO EVENTS</Link>
      </PixelButton>

      {/* Main Info Card */}
      <PixelCard className="mb-6 overflow-hidden">
        {event.bannerUrl && (
          <div className="-mx-4 -mt-4 mb-5 border-b-2 border-retro-border-strong bg-retro-bg">
            <img
              src={event.bannerUrl}
              alt={event.name}
              className="w-full max-h-72 object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          </div>
        )}
        <PixelStack gap={4}>
          <PixelStack direction="row" gap={4} align="start" justify="between" wrap>
            <PixelStack gap={1}>
              <h1 className="text-2xl font-pixel tracking-wider text-retro-primary">{event.name}</h1>
              {event.scheduledAt && (
                <div className="font-pixel text-xs text-retro-gold">
                  SCHEDULED: <time dateTime={event.scheduledAt}>{formatLocalDateTime(event.scheduledAt)}</time>
                </div>
              )}
            </PixelStack>
            <PixelStack direction="row" gap={2} wrap>
              {event.isTeamEvent && <PixelBadge tone="purple">TEAM EVENT</PixelBadge>}
              <PixelBadge tone={TAG_TONE[(event.tag as EventTag) || 'COMMUNITY']}>
                {(TAG_LABELS[(event.tag as EventTag) || 'COMMUNITY']).toUpperCase()}
              </PixelBadge>
              <PixelBadge tone={STATUS_TONE[event.status as EventStatus] || 'neutral'}>
                {(STATUS_LABELS[event.status as EventStatus] || event.status).toUpperCase()}
              </PixelBadge>
            </PixelStack>
          </PixelStack>

          <PixelStack direction="row" gap={4} wrap>
            <PixelBadge tone="neutral">
              SCORING TYPE: {SCORING_LABELS[event.scoringType] ?? 'UNKNOWN'}
            </PixelBadge>
            <PixelBadge tone="neutral">
              CLASS RESTRICTION:{' '}
              {event.classRestriction && event.classRestriction !== 'PRE_OP' && event.classRestriction !== 'OP' ? CLASS_TIER_LABELS[event.classRestriction as any] : 'OPEN TO ALL'}
            </PixelBadge>
            {event.isTeamEvent && (
              <PixelBadge tone="cyan">
                ROSTER LIMITS: PRIMARY {event.maxPrimaryRosterSize ?? '∞'} · BACKUP {event.maxBackupRosterSize ?? '∞'}
              </PixelBadge>
            )}
          </PixelStack>

          {event.isTeamEvent ? (
            <div className="pt-4 border-t-2 border-retro-border">
              {!session ? (
                <PixelButton asChild variant="solid" tone="purple" className="pxl-btn-flat">
                  <Link to="/auth" search={{ redirect: `/events/${eventId}` }}>
                    SIGN IN TO REGISTER TEAM
                  </Link>
                </PixelButton>
              ) : adminTeams.length > 0 ? (
                <PixelStack gap={2}>
                  <div>
                    <PixelButton
                      variant="solid"
                      tone="green"
                      className="pxl-btn-flat"
                      disabled={isConcluded || event.status === 'DRAFT' || event.status === 'PENDING_DELETION' || event.signupsLocked}
                      onClick={() => {
                        setTeamRosterError(null)
                        setShowTeamModal(true)
                      }}
                    >
                      REGISTER / MANAGE TEAM ROSTER
                    </PixelButton>
                  </div>
                  {event.signupsLocked && (
                    <div className="text-retro-muted font-pixel text-xs">
                      SIGNUPS ARE LOCKED FOR THIS EVENT
                    </div>
                  )}
                </PixelStack>
              ) : (
                <div className="text-retro-muted font-sans text-xs">
                  This is a team-based event. Approved Team Admins can register their team and assign Primary &amp; Backup rosters here while signups are open.
                </div>
              )}
            </div>
          ) : (
            !isGranular && (
              <div className="pt-4 border-t-2 border-retro-border">
                {!session ? (
                  <PixelButton asChild variant="solid" tone="purple" className="pxl-btn-flat">
                    <Link to="/auth" search={{ redirect: `/events/${eventId}` }}>
                      SIGN IN TO JOIN
                    </Link>
                  </PixelButton>
                ) : (
                  <PixelStack gap={2}>
                    <PixelButton
                      variant="solid"
                      tone={isMember ? 'red' : 'green'}
                      className="pxl-btn-flat"
                      disabled={isConcluded || event.status === 'DRAFT' || event.status === 'PENDING_DELETION' || event.signupsLocked || joinMutation.isPending || leaveMutation.isPending || (!isMember && event.participantLimit !== null && event.members.length >= event.participantLimit)}
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
                      {isMember ? 'WITHDRAW FROM EVENT' : (event.participantLimit !== null && event.members.length >= event.participantLimit) ? 'EVENT FULL' : 'SIGN UP FOR EVENT'}
                    </PixelButton>
                    {event.signupsLocked && (
                      <div className="text-retro-muted font-pixel text-xs mt-2">
                        SIGNUPS ARE LOCKED FOR THIS EVENT
                      </div>
                    )}
                  </PixelStack>
                )}
              </div>
            )
          )}
        </PixelStack>
      </PixelCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        {/* Left Column: Participants or Registered Teams Panel */}
        <div>
          {event.isTeamEvent ? (
            <>
              <PixelSectionHeader
                title={`REGISTERED TEAMS (${registeredTeams.length}${!event.granularParticipation && event.participantLimit !== null && event.participantLimit > 0 ? ` / ${event.participantLimit}` : ''})`}
                size="sm"
                spacing="tight"
              />
              {registeredTeams.length === 0 ? (
                <PixelCard>
                  <div className="font-pixel text-xs text-retro-muted text-center py-4">
                    NO TEAMS REGISTERED YET
                  </div>
                </PixelCard>
              ) : (
                <PixelStack gap={3}>
                  {registeredTeams.map((team) => (
                    <PixelCard key={team.teamId}>
                      <PixelStack gap={3}>
                        <PixelStack direction="row" justify="between" align="center" wrap>
                          <Link
                            to="/$user"
                            params={{ user: team.slug || team.teamId }}
                            className="flex items-center gap-2 font-pixel text-sm text-retro-text hover:text-retro-primary transition-colors"
                          >
                            {team.logo ? (
                              <img
                                src={team.logo}
                                alt={team.name}
                                className="w-7 h-7 rounded border border-retro-border object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none'
                                }}
                              />
                            ) : (
                              <div className="w-7 h-7 rounded border border-retro-border bg-retro-primary/20 text-retro-primary text-[10px] font-bold flex items-center justify-center">
                                {team.name.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <span>{team.name}</span>
                          </Link>
                          <div className="flex gap-1">
                            <PixelBadge tone="green">PRIMARY: {(team.primaryRoster ?? []).length}</PixelBadge>
                            <PixelBadge tone="neutral">BACKUP: {(team.backupRoster ?? []).length}</PixelBadge>
                          </div>
                        </PixelStack>

                        <div>
                          <div className="font-pixel text-[10px] text-retro-muted mb-1">PRIMARY ROSTER</div>
                          <div className="flex flex-wrap gap-1.5">
                            {(team.primaryRoster ?? []).map((m) => (
                              <PixelBadge key={m.userId} tone="green">
                                {m.name}
                              </PixelBadge>
                            ))}
                          </div>
                        </div>

                        {(team.backupRoster ?? []).length > 0 && (
                          <div>
                            <div className="font-pixel text-[10px] text-retro-muted mb-1">BACKUP ROSTER</div>
                            <div className="flex flex-wrap gap-1.5">
                              {(team.backupRoster ?? []).map((m) => (
                                <PixelBadge key={m.userId} tone="neutral">
                                  {m.name}
                                </PixelBadge>
                              ))}
                            </div>
                          </div>
                        )}
                      </PixelStack>
                    </PixelCard>
                  ))}
                </PixelStack>
              )}
            </>
          ) : (
            <>
              <PixelSectionHeader
                title={`PARTICIPANTS (${event.members.length}${!event.granularParticipation && event.participantLimit !== null && event.participantLimit > 0 ? ` / ${event.participantLimit}` : ''})`}
                size="sm"
                spacing="tight"
              />
              <div className="public-table">
                <PixelTable
                  columns={participantColumns}
                  data={event.members}
                  emptyState={<span className="font-pixel text-xs text-retro-muted">NO MEMBERS YET</span>}
                />
              </div>
            </>
          )}
        </div>

        {/* Right Column: Event Description & Schedule Panel */}
        <div className="flex flex-col gap-6">
          {event.ownerName && (
            <div>
              <PixelSectionHeader title="ORGANIZER" size="sm" spacing="tight" />
              <PixelCard className="bg-retro-surface">
                {(() => {
                  const targetSlug = event.ownerSlug || event.organizationId || event.ownerUserId || ''
                  const ownerName = event.ownerName
                  const ownerLogo = event.ownerLogo
                  const ownerTypeLabel = event.ownerType === 'USER' ? 'ORGANIZER' : 'ORGANIZATION'

                  const cardInner = (
                    <PixelStack direction="row" justify="between" align="center">
                      <div className="flex items-center gap-3">
                        {ownerLogo ? (
                          <img
                            src={ownerLogo}
                            alt={ownerName}
                            onError={(e) => {
                              e.currentTarget.src = '/fallback_avatar.jpg'
                            }}
                            className="w-10 h-10 rounded border border-retro-border bg-retro-bg object-cover shadow-sm flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded border border-retro-border bg-retro-primary/20 text-retro-primary font-pixel text-xs font-bold flex items-center justify-center flex-shrink-0">
                            {ownerName.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="font-pixel text-sm text-retro-text font-bold">
                            {ownerName}
                          </div>
                          {(event.ownerSlug || targetSlug) && (
                            <div className="font-sans text-xs text-retro-muted">
                              @{event.ownerSlug || targetSlug}
                            </div>
                          )}
                        </div>
                      </div>
                      <PixelBadge tone="purple">
                        {ownerTypeLabel}
                      </PixelBadge>
                    </PixelStack>
                  )

                  if (targetSlug) {
                    return (
                      <Link
                        to="/$user"
                        params={{ user: targetSlug }}
                        className="block p-3 border-2 border-retro-border rounded hover:border-retro-primary transition-colors bg-retro-bg"
                      >
                        {cardInner}
                      </Link>
                    )
                  }

                  return (
                    <div className="p-3 border-2 border-retro-border rounded bg-retro-bg">
                      {cardInner}
                    </div>
                  )
                })()}
              </PixelCard>
            </div>
          )}

          {event.description && (
            <div>
              <PixelSectionHeader title="ABOUT EVENT" size="sm" spacing="tight" />
              <PixelCard>
                <div className="text-sm text-retro-text leading-relaxed font-sans">
                  <MarkdownView content={event.description} />
                </div>
              </PixelCard>
            </div>
          )}

          {event.schedules && event.schedules.length > 0 && (
            <div>
              <PixelSectionHeader title="SCHEDULE" size="sm" spacing="tight" />
              <PixelCard>
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
                          <span className="block mt-1 font-pixel text-[11px] text-retro-text bg-retro-surface px-2 py-0.5 border border-retro-border pxl-corner-sm inline-flex items-center gap-1">
                            <i className="hn hn-location-pin-solid text-xs text-retro-primary" aria-hidden="true" />
                            <span>{schedule.location}</span>
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
      </div>

      {/* Team Standings (Constructors) */}
      {event.isTeamEvent && event.scoringType === 1 && (
        <div className="mt-8">
          <PixelStack direction="row" gap={3} align="center" wrap className="mb-4">
            <h2 className="font-pixel text-sm tracking-wider text-retro-gold">
              TEAM STANDINGS (CONSTRUCTORS)
            </h2>
            {event.status === 'OFFICIAL' || event.status === 'CONCLUDED' ? (
              <PixelBadge tone="green">FINAL</PixelBadge>
            ) : (
              <PixelBadge tone="gold">PROVISIONAL</PixelBadge>
            )}
          </PixelStack>
          <div className="public-table">
            <PixelTable
              columns={teamStandingsColumns}
              data={event.teamPointsOverview ?? []}
              emptyState={
                <span className="font-pixel text-xs text-retro-muted">NO TEAM RESULTS RECORDED</span>
              }
            />
          </div>
        </div>
      )}

      {/* Standings (Points) */}
      {event.pointsOverview && (
        <div className="mt-8">
          <PixelStack direction="row" gap={3} align="center" wrap className="mb-4">
            <h2 className="font-pixel text-sm tracking-wider text-retro-text">
              {event.isTeamEvent ? 'INDIVIDUAL STANDINGS (POINTS)' : 'STANDINGS (POINTS)'}
            </h2>
            {event.status === 'OFFICIAL' || event.status === 'CONCLUDED' ? (
              <PixelBadge tone="green">FINAL</PixelBadge>
            ) : (
              <PixelBadge tone="gold">PROVISIONAL</PixelBadge>
            )}
          </PixelStack>
          <div className="public-table">
            <PixelTable
              columns={pointsColumns}
              data={event.pointsOverview}
              emptyState={
                <span className="font-pixel text-xs text-retro-muted">NO RESULTS RECORDED</span>
              }
            />
          </div>
        </div>
      )}

      {/* Standings (Ladder) */}
      {event.ladderOverview && (
        <div className="mt-8">
          <PixelStack direction="row" gap={3} align="center" wrap className="mb-4">
            <h2 className="font-pixel text-sm tracking-wider text-retro-text">
              STANDINGS (LADDER)
            </h2>
            {event.status === 'OFFICIAL' || event.status === 'CONCLUDED' ? (
              <PixelBadge tone="green">FINAL</PixelBadge>
            ) : (
              <PixelBadge tone="gold">PROVISIONAL</PixelBadge>
            )}
          </PixelStack>
          <div className="public-table">
            <PixelTable
              columns={ladderColumns}
              data={event.ladderOverview}
              emptyState={
                <span className="font-pixel text-xs text-retro-muted">NO LADDER RECORDS</span>
              }
            />
          </div>
        </div>
      )}

      {/* RACES SECTION */}
      <div className="mt-8">
        <PixelSectionHeader title="RACES" size="sm" spacing="tight" />
        <EventRacesList event={event} />
      </div>

      {/* Team Admin Self-Service Roster Modal */}
      {showTeamModal && (
        <PixelModal
          open={showTeamModal}
          onClose={() => setShowTeamModal(false)}
          title="MANAGE TEAM ROSTER"
        >
          <div className="space-y-4">
            {teamRosterError && <PixelAlert tone="red" message={teamRosterError} />}

            <div>
              <label className="block font-pixel text-xs text-retro-muted mb-1">SELECT TEAM</label>
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="w-full px-3 py-2 bg-retro-bg border-2 border-retro-border text-retro-text font-sans text-sm"
              >
                {adminTeams.map((t) => (
                  <option key={t.organizationId} value={t.organizationId}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {loadingTeamDetail ? (
              <PixelSpinner size="sm" label="Loading team members..." />
            ) : selectedTeamDetail && !isSelectedTeamApprovedTeam ? (
              <PixelAlert
                tone="gold"
                message="Only approved Teams can register for team events."
              />
            ) : selectedTeamDetail ? (
              <>
                <div className="flex gap-2 flex-wrap">
                  <PixelBadge tone="green">
                    PRIMARY: {primaryUserIds.length} / {event.maxPrimaryRosterSize ?? '∞'}
                  </PixelBadge>
                  <PixelBadge tone="neutral">
                    BACKUP: {backupUserIds.length} / {event.maxBackupRosterSize ?? '∞'}
                  </PixelBadge>
                </div>

                {!selectedTeamAlreadyRegistered && teamLimitReached && (
                  <PixelAlert
                    tone="red"
                    message={`This event has reached its maximum team capacity (${event.participantLimit} teams).`}
                  />
                )}

                <div className="max-h-64 overflow-y-auto space-y-2 border-2 border-retro-border p-2 bg-retro-bg">
                  {(selectedTeamDetail.members ?? []).map((m) => {
                    const isPrimary = primaryUserIds.includes(m.userId)
                    const isBackup = backupUserIds.includes(m.userId)
                    return (
                      <div
                        key={m.userId}
                        className="flex items-center justify-between gap-2 p-2 border border-retro-border bg-retro-surface"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-retro-text truncate">{m.name}</div>
                          <div className="text-xs text-retro-muted truncate">{m.role}</div>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <PixelButton
                            type="button"
                            size="sm"
                            variant={isPrimary ? 'solid' : 'ghost'}
                            tone={isPrimary ? 'green' : 'neutral'}
                            onClick={() => toggleTeamMemberRole(m.userId, isPrimary ? 'NONE' : 'PRIMARY')}
                          >
                            PRIMARY
                          </PixelButton>
                          <PixelButton
                            type="button"
                            size="sm"
                            variant={isBackup ? 'solid' : 'ghost'}
                            tone={isBackup ? 'cyan' : 'neutral'}
                            onClick={() => toggleTeamMemberRole(m.userId, isBackup ? 'NONE' : 'BACKUP')}
                          >
                            BACKUP
                          </PixelButton>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="flex justify-between items-center gap-2 pt-2 border-t-2 border-retro-border">
                  {selectedTeamAlreadyRegistered ? (
                    <PixelButton
                      type="button"
                      variant="ghost"
                      tone="red"
                      size="sm"
                      loading={withdrawTeamMutation.isPending}
                      onClick={() => {
                        if (window.confirm('Withdraw this team and its roster from the event?')) {
                          withdrawTeamMutation.mutate(selectedTeamId)
                        }
                      }}
                    >
                      WITHDRAW TEAM
                    </PixelButton>
                  ) : (
                    <span />
                  )}
                  <div className="flex gap-2">
                    <PixelButton type="button" variant="ghost" tone="neutral" onClick={() => setShowTeamModal(false)}>
                      CANCEL
                    </PixelButton>
                    <PixelButton
                      type="button"
                      variant="solid"
                      tone="green"
                      loading={saveTeamRosterMutation.isPending}
                      disabled={
                        primaryUserIds.length === 0 ||
                        (!selectedTeamAlreadyRegistered && teamLimitReached)
                      }
                      onClick={() => saveTeamRosterMutation.mutate()}
                    >
                      SAVE ROSTER
                    </PixelButton>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </PixelModal>
      )}
    </PixelContainer>
  )
}

function RaceStandingsTable({
  eventId,
  raceId,
  members,
  raceGrade,
  scoringRulesMode,
  customScoringTables,
}: {
  eventId: string
  raceId: string
  members: eventmanager.EventMemberView[]
  raceGrade?: string | null
  scoringRulesMode?: string | null
  customScoringTables?: any | null
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['public-race-results', eventId, raceId],
    queryFn: () => getPublicRaceResults(eventId, raceId),
  })

  if (isLoading) {
    return (
      <PixelStack align="center" justify="center" gap={2} className="py-4">
        <PixelSpinner size="sm" label="Loading standings..." />
      </PixelStack>
    )
  }

  if (error || !data) {
    return (
      <div className="text-retro-muted font-pixel text-xs py-2">
        ERROR LOADING STANDINGS
      </div>
    )
  }

  const rawResults = data.results
  const detailsMap = computeRaceEffectiveResults(
    rawResults,
    raceGrade,
    scoringRulesMode,
    customScoringTables
  )

  const sortedResults = [...rawResults].sort((a, b) => {
    const detailsA = detailsMap.get(a)
    const detailsB = detailsMap.get(b)
    const posA = detailsA?.effectivePosition
    const posB = detailsB?.effectivePosition

    if (posA !== null && posA !== undefined && posB !== null && posB !== undefined) {
      return posA - posB
    }
    if (posA !== null && posA !== undefined) return -1
    if (posB !== null && posB !== undefined) return 1

    const physA = detailsA?.physicalPosition ?? 999
    const physB = detailsB?.physicalPosition ?? 999
    return physA - physB
  })

  const columns: PixelTableColumn<eventmanager.RaceResultView>[] = [
    {
      key: 'position',
      header: 'POS',
      width: 75,
      render: (r) => {
        const details = detailsMap.get(r)
        if (details?.penaltyType === 'POS' && details.effectivePosition !== null) {
          return (
            <span className="font-pixel text-red-600 font-bold" title={`Original finish position: ${r.position}`}>
              {details.effectivePosition} <span className="text-[10px] text-retro-muted font-normal">({r.position})</span>
            </span>
          )
        }
        return <span className="font-pixel">{details?.effectivePosition ?? r.position ?? '-'}</span>
      },
    },
    {
      key: 'gateNumber',
      header: 'DRAW',
      width: 60,
      render: (r) => <span>{r.gateNumber ?? '-'}</span>,
    },
    {
      key: 'participant',
      header: 'PARTICIPANT',
      width: 210,
      render: (r) => {
        const member = members.find((m) => m.userId === r.userId)
        const name = member?.name ?? r.userId
        return (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="truncate font-medium max-w-[140px]" title={name}>
              {name}
            </span>
            {member?.teamName && (
              <PixelBadge tone="purple">{member.teamName}</PixelBadge>
            )}
          </div>
        )
      },
    },
    {
      key: 'points',
      header: 'POINTS',
      align: 'right',
      width: 110,
      render: (r) => {
        const details = detailsMap.get(r)
        if (details?.hasPenalty && details.basePoints > 0 && details.basePoints !== r.points) {
          return (
            <div className="text-right">
              <span className="text-retro-primary font-bold">{r.points}</span>{' '}
              <span className="text-retro-muted text-[10px] font-normal" title={`Original base points: ${details.basePoints}`}>
                ({details.basePoints})
              </span>
            </div>
          )
        }
        return <span className="text-retro-primary font-bold">{r.points}</span>
      },
    },
    {
      key: 'finishTime',
      header: 'FINISH TIME',
      width: 100,
      render: (r) => <span>{r.finishTime ?? '-'}</span>,
    },
    {
      key: 'margin',
      header: 'MARGIN',
      width: 90,
      render: (r) => <span>{r.margin ?? '-'}</span>,
    },
    {
      key: 'passingOrder',
      header: 'PASSING ORDER',
      width: 120,
      render: (r) => <span>{r.passingOrder ?? '-'}</span>,
    },
    {
      key: 'final3F',
      header: 'FINAL 3F',
      width: 90,
      render: (r) => <span>{r.final3F ?? '-'}</span>,
    },
    {
      key: 'resultStatus',
      header: 'RESULT',
      width: 110,
      render: (r) => {
        const rawStatus = r.resultStatus ?? ''
        const status = rawStatus.toUpperCase()
        if (status === 'DSQ') return <span className="text-red-600 font-bold">DSQ</span>
        if (status === 'DNF') return <span className="text-orange-600 font-bold">DNF</span>
        if (status === 'DNS') return <span className="text-amber-600 font-bold">DNS</span>
        if (status === 'DEFERRED') return <span className="text-slate-500 font-bold" title="Deferred">DEFERRED</span>
        if (status.startsWith('PEN (POS-') || status.startsWith('PEN (PTS-')) {
          return <span className="text-red-600 font-bold">{rawStatus}</span>
        }
        return <span className="text-retro-muted">-</span>
      },
    },
  ]

  return (
    <div className="public-table">
      <PixelTable
        columns={columns}
        data={sortedResults}
        emptyState={
          <span className="font-pixel text-xs text-retro-muted">NO STANDINGS RECORDED</span>
        }
      />
    </div>
  )
}

function EventRacesList({ event }: { event: eventmanager.EventDetail }) {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const { toast } = useToast()
  const currentMember = session ? event.members.find((m) => m.userId === session.user.id) : undefined
  const isMember = Boolean(currentMember)
  const isEligiblePrimary = !event.isTeamEvent || currentMember?.rosterRole === 'PRIMARY'
  const isBackupOnly = Boolean(event.isTeamEvent && currentMember && currentMember.rosterRole !== 'PRIMARY')

  const joinRaceMutation = useMutation({
    mutationFn: ({ raceId }: { raceId: string }) =>
      joinRaceEvent(event.id, raceId, `Bearer ${session?.session.token ?? ''}`),
    onSuccess: (_, { raceId }) => {
      queryClient.invalidateQueries({ queryKey: ['public-event', event.id] })
      queryClient.invalidateQueries({ queryKey: ['public-event-races', event.id] })
      queryClient.invalidateQueries({ queryKey: ['public-race-results', event.id, raceId] })
    },
    onError: (err: any) => {
      const msg = err?.message || err?.toString() || 'Unknown error'
      toast({
        tone: 'red',
        title: `Could not sign up for this race: ${msg}`,
      })
    },
  })

  const leaveRaceMutation = useMutation({
    mutationFn: ({ raceId }: { raceId: string }) =>
      leaveRaceEvent(event.id, raceId, `Bearer ${session?.session.token ?? ''}`),
    onSuccess: (_, { raceId }) => {
      queryClient.invalidateQueries({ queryKey: ['public-event', event.id] })
      queryClient.invalidateQueries({ queryKey: ['public-event-races', event.id] })
      queryClient.invalidateQueries({ queryKey: ['public-race-results', event.id, raceId] })
    },
    onError: (err: any) => {
      const msg = err?.message || err?.toString() || 'Unknown error'
      toast({
        tone: 'red',
        title: `Could not withdraw from this race: ${msg}`,
      })
    },
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['public-event-races', event.id],
    queryFn: () => listPublicRaceEvents(event.id),
  })

  if (isLoading) {
    return (
      <PixelStack align="center" justify="center" gap={4} className="py-8">
        <PixelSpinner size="md" label="Loading races..." />
      </PixelStack>
    )
  }

  if (error || !data) {
    return (
      <PixelEmptyState
        title="Error loading races"
        description="Something went wrong while fetching the race events list."
      />
    )
  }

  const races = data.races

  if (races.length === 0) {
    return (
      <PixelEmptyState
        title="No races scheduled"
        description="There are no individual race events configured for this competition."
      />
    )
  }

  return (
    <PixelStack gap={6} className="mt-4">
      {races.map((race) => {
        const isRaceMember = session && (race.members ?? []).some((rm) => rm.userId === session.user.id)

        return (
          <PixelCard key={race.id}>
            <PixelStack gap={4}>
              {/* Race Header Info */}
              <PixelStack direction="row" gap={4} align="start" justify="between" wrap>
                <PixelStack gap={2}>
                  <h3 className="text-lg font-pixel tracking-wide text-retro-text">
                    #{race.sequence}. {race.name}
                  </h3>
                  <div className="text-xs text-retro-muted font-sans flex flex-wrap gap-x-4 gap-y-1">
                    <span>TRACK: <strong>{race.trackType}</strong> ({race.distanceMeters}m)</span>
                    <span>LOCATION: <strong>{race.location}</strong></span>
                  </div>
                </PixelStack>
                <PixelStack direction="row" gap={2} align="center" wrap>
                  <PixelBadge tone="neutral">
                    CLASS:{' '}
                    {race.classRestriction && race.classRestriction !== 'PRE_OP' && race.classRestriction !== 'OP' ? CLASS_TIER_LABELS[race.classRestriction] ?? race.classRestriction : 'OPEN'}
                  </PixelBadge>
                    {race.participantLimit !== null && (
                      <PixelBadge tone="neutral">
                        CAPACITY: {(race.members ?? []).length} / {race.participantLimit}
                      </PixelBadge>
                    )}
                  {event.granularParticipation && (
                    <>
                      {!session ? (
                        <PixelButton asChild variant="solid" tone="purple" size="sm" className="pxl-btn-flat font-pixel text-[10px]">
                          <Link to="/auth" search={{ redirect: `/events/${event.id}` }}>
                            SIGN IN
                          </Link>
                        </PixelButton>
                      ) : event.isTeamEvent && !isEligiblePrimary && !isRaceMember ? (
                        <PixelBadge tone="neutral">
                          {isBackupOnly ? 'BACKUP ONLY' : 'PRIMARY ROSTER ONLY'}
                        </PixelBadge>
                      ) : (
                        <PixelButton
                          variant="solid"
                          tone={isRaceMember ? 'red' : 'green'}
                          size="sm"
                          className="pxl-btn-flat font-pixel text-[10px]"
                          disabled={event.signupsLocked || joinRaceMutation.isPending || leaveRaceMutation.isPending || (!isRaceMember && race.participantLimit !== null && (race.members ?? []).length >= race.participantLimit)}
                          onClick={() => {
                            if (isRaceMember) {
                              leaveRaceMutation.mutate({ raceId: race.id })
                            } else {
                              joinRaceMutation.mutate({ raceId: race.id })
                            }
                          }}
                        >
                          {isRaceMember ? 'WITHDRAW' : (race.participantLimit !== null && (race.members ?? []).length >= race.participantLimit) ? 'FULL' : 'SIGN UP'}
                        </PixelButton>
                      )}
                    </>
                  )}
                  {!event.granularParticipation && isMember && (
                    isBackupOnly && !isRaceMember ? (
                      <PixelBadge tone="neutral">BACKUP ONLY</PixelBadge>
                    ) : (
                      <PixelButton
                        variant="solid"
                        tone={isRaceMember ? 'red' : 'green'}
                        size="sm"
                        className="pxl-btn-flat font-pixel text-[10px]"
                        disabled={event.signupsLocked || joinRaceMutation.isPending || leaveRaceMutation.isPending}
                        onClick={() => {
                          if (isRaceMember) {
                            leaveRaceMutation.mutate({ raceId: race.id })
                          } else {
                            joinRaceMutation.mutate({ raceId: race.id })
                          }
                        }}
                      >
                        {isRaceMember ? 'WITHDRAW' : 'SIGN UP'}
                      </PixelButton>
                    )
                  )}
                </PixelStack>
              </PixelStack>

            {/* Standings Table */}
            <div className="mt-2">
              <div className="font-pixel text-[11px] text-retro-text mb-2">RACE STANDINGS</div>
              <RaceStandingsTable
                eventId={event.id}
                raceId={race.id}
                members={event.members}
                raceGrade={race.grade}
                scoringRulesMode={event.scoringRulesMode}
                customScoringTables={event.customScoringTables}
              />
            </div>
          </PixelStack>
        </PixelCard>
        )
      })}
    </PixelStack>
  )
}
