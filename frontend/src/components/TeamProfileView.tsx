import React, { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  PixelContainer,
  PixelStack,
  PixelCard,
  PixelBadge,
  PixelSectionHeader,
  PixelButton,
} from '@pxlkit/ui-kit'
import type { teammanager } from '../lib/client'
import { getTeamStats, listPublicNewsletters } from '../lib/public-api'
import { formatLocalDateTime } from '../lib/datetime'
import { UserLink } from './UserLink'
import { MarkdownView } from './MarkdownView'
import { PixelSkeletonInlineRows } from './LoadingSkeleton'
import { useAuth } from '../hooks/useAuth'
import { usePageHead } from '../hooks/usePageHead'

interface TeamProfileViewProps {
  team: teammanager.Team
}

export const TeamProfileView: React.FC<TeamProfileViewProps> = ({ team }) => {
  const { session } = useAuth()
  const currentUserId = session?.user?.id
  const currentSiteRole = session?.user?.siteRole

  const isOrg =
    team.isOrganization ??
    (!team.primaryOrganizationId || team.primaryOrganizationId === team.id)

  const currentYear = new Date().getUTCFullYear()
  const initialStatsYear = team.stats?.year ?? currentYear
  const [selectedStatsYear, setSelectedStatsYear] = useState<number>(initialStatsYear)
  const [displayStats, setDisplayStats] = useState<teammanager.TeamStats>(team.stats)
  const [loadingStats, setLoadingStats] = useState(false)

  useEffect(() => {
    setDisplayStats(team.stats)
    setSelectedStatsYear(team.stats?.year ?? currentYear)
  }, [team.id, team.stats, currentYear])

  const handleStatsYearChange = async (nextYear: number) => {
    setSelectedStatsYear(nextYear)
    setLoadingStats(true)
    try {
      const fresh = await getTeamStats(team.id, {
        year: nextYear === 0 ? 0 : nextYear,
        allTime: nextYear === 0,
      })
      setDisplayStats(fresh)
    } catch {
      // keep existing stats on error
    } finally {
      setLoadingStats(false)
    }
  }

  const [orgNewsletters, setOrgNewsletters] = useState<teammanager.Newsletter[]>([])
  const [loadingNewsletters, setLoadingNewsletters] = useState(false)

  useEffect(() => {
    if (!isOrg) return
    let active = true
    setLoadingNewsletters(true)
    listPublicNewsletters({ OrganizationID: team.id, Search: '', Limit: 5, Offset: 0 })
      .then((res) => {
        if (active) setOrgNewsletters(res.newsletters)
      })
      .catch(() => {
        if (active) setOrgNewsletters([])
      })
      .finally(() => {
        if (active) setLoadingNewsletters(false)
      })
    return () => {
      active = false
    }
  }, [isOrg, team.id])

  usePageHead({
    title: team.name,
    description:
      team.description ||
      `${isOrg ? 'Organization' : 'Team'} profile for ${team.name} on UmaKeiba.`,
    image: team.logo || undefined,
    type: 'website',
  })

  const isTeamAdmin = Boolean(
    currentUserId &&
      (currentSiteRole === 'SITE_ADMIN' ||
        currentSiteRole === 'EVENT_ADMIN' ||
        team.members?.some(
          (m) =>
            m.userId === currentUserId &&
            (m.role.toLowerCase() === 'administrator' ||
              m.role.toLowerCase() === 'organizationadministrator')
        ))
  )

  const affiliatedOrganizations = (team.organizations || []).filter(
    (org) => org.id !== team.id
  )
  const affiliatedTeams = team.teams || []
  const allMembers = team.members || []
  const memberCount = allMembers.length
  const isStaffRole = (role: string) => {
    const normalized = (role || '').trim().toLowerCase()
    return normalized !== '' && normalized !== 'member'
  }
  const staffMembers = allMembers.filter((m) => isStaffRole(m.role))
  const regularMembers = allMembers.filter((m) => !isStaffRole(m.role))

  return (
    <PixelContainer maxWidth="full" padding="none" className="max-w-6xl mx-auto">
      <div>
        {/* Compact Hugging Face-Inspired Header Card */}
        <PixelCard className="bg-retro-surface mb-5 border-2 border-retro-border-strong">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
              {team.logo ? (
                <img
                  src={team.logo}
                  alt={team.name}
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded border-2 border-retro-border bg-retro-bg object-cover shadow shrink-0"
                />
              ) : (
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded border-2 border-retro-border bg-retro-primary/20 text-retro-primary font-pixel text-lg sm:text-xl font-bold flex items-center justify-center shrink-0">
                  {team.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
                  <h1 className="text-lg sm:text-2xl font-pixel text-retro-text tracking-wide font-bold truncate max-w-full">
                    {team.name}
                  </h1>
                  <PixelBadge tone={isOrg ? 'purple' : 'cyan'}>
                    {isOrg ? 'ORGANIZATION' : 'TEAM'}
                  </PixelBadge>
                </div>
                <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap font-sans text-xs sm:text-sm text-retro-muted font-semibold mt-0.5">
                  <span>@{team.slug}</span>
                  <span>•</span>
                  <span className="font-pixel text-[10px] text-retro-muted">
                    {memberCount} {memberCount === 1 ? 'MEMBER' : 'MEMBERS'}
                  </span>
                </div>
              </div>
            </div>

            {isTeamAdmin && (
              <div className="pt-3 sm:pt-0 border-t sm:border-t-0 border-retro-border w-full sm:w-auto shrink-0">
                <PixelButton asChild variant="solid" tone="purple" size="sm" className="w-full sm:w-auto justify-center">
                  <Link to="/teams/manage/$id" params={{ id: team.id }}>
                    {isOrg ? 'MANAGE ORG' : 'MANAGE TEAM'}
                  </Link>
                </PixelButton>
              </div>
            )}
          </div>
        </PixelCard>

        {/* Tight 2-Column Hugging Face Style Layout (Content-first on mobile) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Sidebar on Desktop / Second on Mobile: Compact Avatar Cluster & Staff Directory */}
          <div className="order-2 lg:order-1 lg:col-span-4 xl:col-span-3 flex flex-col gap-4">
            {/* Compact Avatar Cluster (Hugging Face Organization Members style) */}
            <PixelCard className="bg-retro-surface border-2 border-retro-border-strong">
              <PixelSectionHeader
                title={`MEMBERS (${memberCount})`}
                titleTone="cyan"
                size="sm"
              />
              {team.members && team.members.length > 0 ? (
                <div
                  data-testid="members-avatar-cluster"
                  className="flex flex-wrap gap-1.5 mt-3"
                >
                  {team.members.slice(0, 36).map((m) => (
                    <Link
                      key={m.userId}
                      to="/$user"
                      params={{ user: m.slug || m.userId }}
                      title={`${m.name} (@${m.slug || m.userId})`}
                      className="block group relative shrink-0"
                    >
                      <img
                        src={m.image || '/fallback_avatar.jpg'}
                        alt={m.name}
                        onError={(e) => {
                          e.currentTarget.src = '/fallback_avatar.jpg'
                        }}
                        className="w-10 h-10 rounded-full object-cover border-2 border-retro-border group-hover:border-retro-primary group-hover:scale-105 transition-all shadow-sm bg-retro-bg"
                      />
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="font-sans text-xs text-retro-muted py-2 mt-2">
                  No members recorded.
                </div>
              )}
            </PixelCard>

            {/* Staff Directory List (strictly staff roles; never mixed with regular members or affiliated team rosters) */}
            <PixelCard className="bg-retro-surface border-2 border-retro-border-strong">
              <PixelSectionHeader
                title="STAFF"
                titleTone="purple"
                size="sm"
              />
              <div data-testid="staff-directory" className="mt-3 flex flex-col gap-2">
                {staffMembers.length > 0 ? (
                  staffMembers.map((m) => (
                    <div
                      key={m.userId}
                      className="flex items-center justify-between gap-2 p-2 rounded bg-retro-bg/60 border border-retro-border hover:border-retro-primary transition-all"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Link
                          to="/$user"
                          params={{ user: m.slug || m.userId }}
                          className="shrink-0"
                        >
                          <img
                            src={m.image || '/fallback_avatar.jpg'}
                            alt={m.name}
                            onError={(e) => {
                              e.currentTarget.src = '/fallback_avatar.jpg'
                            }}
                            className="w-8 h-8 rounded-full object-cover border border-retro-border bg-retro-bg"
                          />
                        </Link>
                        <div className="flex flex-col min-w-0">
                          <UserLink
                            userId={m.userId}
                            name={m.name}
                            slug={m.slug}
                            className="font-bold text-xs text-retro-text hover:text-retro-primary truncate"
                          />
                          <span className="text-[11px] text-retro-muted font-sans truncate">
                            @{m.slug || m.userId}
                          </span>
                        </div>
                      </div>
                      <PixelBadge
                        tone={
                          m.role.toLowerCase().includes('admin')
                            ? 'purple'
                            : m.role.toLowerCase().includes('event')
                              ? 'cyan'
                              : 'neutral'
                        }
                      >
                        {m.role}
                      </PixelBadge>
                    </div>
                  ))
                ) : (
                  <div className="font-sans text-xs text-retro-muted py-2">
                    No staff recorded.
                  </div>
                )}
              </div>
            </PixelCard>

            {/* Regular Members Directory List (separate from staff) */}
            {regularMembers.length > 0 && (
              <PixelCard className="bg-retro-surface border-2 border-retro-border-strong">
                <PixelSectionHeader
                  title="MEMBERS"
                  titleTone="cyan"
                  size="sm"
                />
                <div data-testid="members-directory" className="mt-3 flex flex-col gap-2">
                  {regularMembers.map((m) => (
                    <div
                      key={m.userId}
                      className="flex items-center justify-between gap-2 p-2 rounded bg-retro-bg/60 border border-retro-border hover:border-retro-primary transition-all"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Link
                          to="/$user"
                          params={{ user: m.slug || m.userId }}
                          className="shrink-0"
                        >
                          <img
                            src={m.image || '/fallback_avatar.jpg'}
                            alt={m.name}
                            onError={(e) => {
                              e.currentTarget.src = '/fallback_avatar.jpg'
                            }}
                            className="w-8 h-8 rounded-full object-cover border border-retro-border bg-retro-bg"
                          />
                        </Link>
                        <div className="flex flex-col min-w-0">
                          <UserLink
                            userId={m.userId}
                            name={m.name}
                            slug={m.slug}
                            className="font-bold text-xs text-retro-text hover:text-retro-primary truncate"
                          />
                          <span className="text-[11px] text-retro-muted font-sans truncate">
                            @{m.slug || m.userId}
                          </span>
                        </div>
                      </div>
                      <PixelBadge tone="neutral">{m.role}</PixelBadge>
                    </div>
                  ))}
                </div>
              </PixelCard>
            )}
          </div>

          {/* Right Main Content on Desktop / First on Mobile: About, Team Statistics, Affiliated Orgs/Teams, Newsletters */}
          <div className="order-1 lg:order-2 lg:col-span-8 xl:col-span-9 flex flex-col gap-5">
            {/* About / Description Card with GitHub Flavoured Markdown */}
            <PixelCard className="bg-retro-surface border-2 border-retro-border-strong">
              <PixelSectionHeader title="ABOUT" titleTone="cyan" size="sm" />
              <div className="mt-3 font-sans text-sm leading-relaxed text-retro-text">
                <MarkdownView
                  content={team.description}
                  fallbackText={`No description provided for this ${isOrg ? 'organization' : 'team'}.`}
                />
              </div>
            </PixelCard>

            {/* Team Aggregate Statistics - Competitive teams */}
            {!isOrg && (
              <PixelCard className="bg-retro-surface border-2 border-retro-border-strong">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <PixelSectionHeader
                      title="TEAM STATISTICS"
                      titleTone="purple"
                      size="sm"
                    />
                    {displayStats?.seasonRankSource && (
                      <PixelBadge tone={displayStats.seasonRankSource === 'TEAM_EVENTS' ? 'cyan' : 'neutral'}>
                        {displayStats.seasonRankSource === 'TEAM_EVENTS' ? 'TEAM EVENTS' : 'MEMBER AVG'}
                      </PixelBadge>
                    )}
                  </div>
                  <select
                    aria-label="Filter team stats by season"
                    value={selectedStatsYear}
                    disabled={loadingStats}
                    onChange={(e) => void handleStatsYearChange(Number(e.target.value))}
                    className="px-2.5 py-1 bg-retro-bg border-2 border-retro-border rounded text-xs text-retro-text font-sans focus:outline-none focus:border-retro-primary"
                  >
                    <option value={0}>All-Time</option>
                    {(displayStats?.availableYears && displayStats.availableYears.length > 0
                      ? displayStats.availableYears
                      : [currentYear]
                    ).map((y) => (
                      <option key={y} value={y}>
                        {y} Season
                      </option>
                    ))}
                  </select>
                </div>

                {/* Official Team Competition Record */}
                <div className="mt-3">
                  <div className="font-pixel text-[10px] text-retro-cyan uppercase tracking-wider mb-2">
                    TEAM COMPETITION RECORD
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <PixelCard className="bg-retro-bg text-center py-3.5 border border-retro-border">
                      <div className="font-pixel text-[10px] text-retro-muted mb-1">
                        SEASON RANK
                      </div>
                      <div className="font-pixel text-2xl text-retro-gold font-bold">
                        {displayStats?.seasonRank != null && displayStats.seasonRank > 0
                          ? `#${displayStats.seasonRank}`
                          : '—'}
                      </div>
                    </PixelCard>

                    <PixelCard className="bg-retro-bg text-center py-3.5 border border-retro-border">
                      <div className="font-pixel text-[10px] text-retro-muted mb-1">
                        TEAM POINTS
                      </div>
                      <div className="font-mono text-2xl text-retro-green font-bold">
                        {(displayStats?.teamEventsParticipated ?? 0) > 0
                          ? displayStats.teamTotalPoints.toLocaleString()
                          : '—'}
                      </div>
                    </PixelCard>

                    <PixelCard className="bg-retro-bg text-center py-3.5 border border-retro-border">
                      <div className="font-pixel text-[10px] text-retro-muted mb-1">
                        TEAM EVENTS
                      </div>
                      <div className="font-mono text-2xl text-retro-text font-bold">
                        {displayStats?.teamEventsParticipated ?? 0}
                      </div>
                    </PixelCard>

                    <PixelCard className="bg-retro-bg text-center py-3.5 border border-retro-border">
                      <div className="font-pixel text-[10px] text-retro-muted mb-1">
                        AVG TEAM PLACE
                      </div>
                      <div className="font-mono text-2xl text-retro-text font-bold">
                        {displayStats?.teamEventRankAverage != null && displayStats.teamEventRankAverage > 0
                          ? `#${displayStats.teamEventRankAverage.toFixed(1)}`
                          : '—'}
                      </div>
                    </PixelCard>
                  </div>
                </div>

                {/* Member Roster Averages */}
                <div className="mt-4 pt-3 border-t border-retro-border">
                  <div className="font-pixel text-[10px] text-retro-muted uppercase tracking-wider mb-2">
                    MEMBER ROSTER AVERAGES
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <PixelCard className="bg-retro-bg text-center py-3 border border-retro-border">
                      <div className="font-pixel text-[10px] text-retro-muted mb-1">
                        RANKING AVERAGE
                      </div>
                      <div className="font-mono text-xl text-retro-text font-bold">
                        {displayStats?.rankingAverage != null && displayStats.rankingAverage > 0
                          ? displayStats.rankingAverage.toFixed(1)
                          : '—'}
                      </div>
                    </PixelCard>

                    <PixelCard className="bg-retro-bg text-center py-3 border border-retro-border">
                      <div className="font-pixel text-[10px] text-retro-muted mb-1">
                        AVG PTS / EVENT
                      </div>
                      <div className="font-mono text-xl text-retro-text font-bold">
                        {displayStats?.averagePointsPerEvent != null &&
                        displayStats.averagePointsPerEvent > 0
                          ? displayStats.averagePointsPerEvent.toFixed(1)
                          : '—'}
                      </div>
                    </PixelCard>

                    <PixelCard className="bg-retro-bg text-center py-3 border border-retro-border">
                      <div className="font-pixel text-[10px] text-retro-muted mb-1">
                        POINTS AVERAGE
                      </div>
                      <div className="font-mono text-xl text-retro-green font-bold">
                        {displayStats?.pointsAverage != null && displayStats.pointsAverage > 0
                          ? displayStats.pointsAverage.toFixed(1)
                          : '—'}
                      </div>
                    </PixelCard>
                  </div>
                </div>
              </PixelCard>
            )}

            {/* Affiliated Organizations Section (on Team pages) */}
            {affiliatedOrganizations.length > 0 && (
              <PixelCard className="bg-retro-surface border-2 border-retro-border-strong">
                <PixelSectionHeader
                  title={`AFFILIATED ORGANIZATIONS (${affiliatedOrganizations.length})`}
                  titleTone="cyan"
                  size="sm"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  {affiliatedOrganizations.map((org) => (
                    <PixelCard
                      key={org.id}
                      className="bg-retro-bg p-3 border border-retro-border hover:border-retro-primary transition-colors"
                    >
                      <PixelStack direction="row" gap={3} align="center">
                        {org.logo ? (
                          <img
                            src={org.logo}
                            alt={org.name}
                            className="w-10 h-10 rounded border border-retro-border bg-retro-bg object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded border border-retro-border bg-retro-primary/10 text-retro-primary font-pixel text-sm font-bold flex items-center justify-center shrink-0">
                            {org.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <PixelStack gap={1} className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link
                              to="/$user"
                              params={{ user: org.slug || org.id }}
                              className="font-pixel text-xs text-retro-text hover:text-retro-primary font-bold truncate"
                              title={org.name}
                            >
                              {org.name}
                            </Link>
                            <PixelBadge tone={org.isPrimary ? 'green' : 'purple'}>
                              {org.isPrimary ? 'PRIMARY' : 'SECONDARY'}
                            </PixelBadge>
                          </div>
                          <div className="font-sans text-xs text-retro-muted font-semibold truncate">
                            @{org.slug}
                          </div>
                        </PixelStack>
                      </PixelStack>
                    </PixelCard>
                  ))}
                </div>
              </PixelCard>
            )}

            {/* Affiliated Teams Section (on Organization pages for visual consistency) */}
            {isOrg && affiliatedTeams.length > 0 && (
              <PixelCard className="bg-retro-surface border-2 border-retro-border-strong">
                <PixelSectionHeader
                  title={`AFFILIATED TEAMS (${affiliatedTeams.length})`}
                  titleTone="cyan"
                  size="sm"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  {affiliatedTeams.map((t) => (
                    <PixelCard
                      key={t.id}
                      className="bg-retro-bg p-3 border border-retro-border hover:border-retro-primary transition-colors"
                    >
                      <PixelStack direction="row" gap={3} align="center">
                        {t.logo ? (
                          <img
                            src={t.logo}
                            alt={t.name}
                            className="w-10 h-10 rounded border border-retro-border bg-retro-bg object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded border border-retro-border bg-retro-primary/10 text-retro-primary font-pixel text-sm font-bold flex items-center justify-center shrink-0">
                            {t.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <PixelStack gap={1} className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link
                              to="/$user"
                              params={{ user: t.slug || t.id }}
                              className="font-pixel text-xs text-retro-text hover:text-retro-primary font-bold truncate"
                              title={t.name}
                            >
                              {t.name}
                            </Link>
                            <PixelBadge tone={t.isPrimary ? 'cyan' : 'purple'}>
                              {t.isPrimary ? 'PRIMARY' : 'AFFILIATED'}
                            </PixelBadge>
                          </div>
                          <div className="flex items-center gap-2 font-sans text-xs text-retro-muted font-semibold truncate">
                            <span>@{t.slug}</span>
                            {t.memberCount != null && (
                              <>
                                <span>•</span>
                                <span>
                                  {t.memberCount} {t.memberCount === 1 ? 'member' : 'members'}
                                </span>
                              </>
                            )}
                          </div>
                        </PixelStack>
                      </PixelStack>
                    </PixelCard>
                  ))}
                </div>
              </PixelCard>
            )}

            {/* Organization Newsletters */}
            {isOrg && (
              <PixelCard className="bg-retro-surface border-2 border-retro-border-strong">
                <div className="flex items-center justify-between gap-2">
                  <PixelSectionHeader
                    title="NEWSLETTERS"
                    titleTone="purple"
                    size="sm"
                  />
                  <PixelButton asChild variant="ghost" tone="cyan" size="sm">
                    <Link to="/newsletters">ALL NEWSLETTERS</Link>
                  </PixelButton>
                </div>
                {loadingNewsletters ? (
                  <div className="mt-3">
                    <PixelSkeletonInlineRows rows={3} />
                  </div>
                ) : orgNewsletters.length > 0 ? (
                  <div className="mt-3 flex flex-col gap-3">
                    {orgNewsletters.map((nl) => (
                      <Link
                        key={nl.id}
                        to="/newsletters/$newsletterId"
                        params={{ newsletterId: nl.id }}
                        className="block p-3 rounded bg-retro-bg/70 border border-retro-border hover:border-retro-primary transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          {nl.thumbnailUrl && (
                            <img
                              src={nl.thumbnailUrl}
                              alt={nl.title}
                              className="w-20 h-14 rounded border border-retro-border object-cover bg-retro-bg shrink-0"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none'
                              }}
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="font-pixel text-xs text-retro-text font-bold truncate">
                              {nl.title}
                            </div>
                            {nl.summary && (
                              <p className="font-sans text-xs text-retro-muted mt-1 line-clamp-2">
                                {nl.summary}
                              </p>
                            )}
                            <div className="font-sans text-[11px] text-retro-muted mt-1.5">
                              By {nl.authorName} •{' '}
                              {nl.publishedAt
                                ? formatLocalDateTime(nl.publishedAt)
                                : formatLocalDateTime(nl.createdAt)}
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 font-sans text-xs text-retro-muted italic">
                    No newsletters published yet.
                  </div>
                )}
              </PixelCard>
            )}
          </div>
        </div>
      </div>
    </PixelContainer>
  )
}
