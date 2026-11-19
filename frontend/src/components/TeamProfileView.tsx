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
import { listPublicNewsletters } from '../lib/public-api'
import { formatLocalDateTime } from '../lib/datetime'
import { UserLink } from './UserLink'
import { MarkdownView } from './MarkdownView'
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

  const [orgNewsletters, setOrgNewsletters] = useState<teammanager.Newsletter[]>([])
  const [loadingNewsletters, setLoadingNewsletters] = useState(false)

  useEffect(() => {
    if (!isOrg) return
    let active = true
    setLoadingNewsletters(true)
    listPublicNewsletters({ organizationId: team.id, limit: 5, offset: 0 })
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
  const memberCount = team.members?.length || 0

  return (
    <PixelContainer maxWidth="full" padding="md">
      <div className="max-w-6xl mx-auto">
        {/* Compact Hugging Face-Inspired Header Card */}
        <PixelCard className="bg-retro-surface mb-5 border-2 border-retro-border-strong">
          <PixelStack direction="row" gap={4} align="center" wrap justify="between">
            <PixelStack direction="row" gap={4} align="center" wrap>
              {team.logo ? (
                <img
                  src={team.logo}
                  alt={team.name}
                  className="w-16 h-16 rounded border-2 border-retro-border bg-retro-bg object-cover shadow shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded border-2 border-retro-border bg-retro-primary/20 text-retro-primary font-pixel text-xl font-bold flex items-center justify-center shrink-0">
                  {team.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <PixelStack gap={1}>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-pixel text-retro-text tracking-wide font-bold">
                    {team.name}
                  </h1>
                  <PixelBadge tone={isOrg ? 'purple' : 'cyan'}>
                    {isOrg ? 'ORGANIZATION' : 'TEAM'}
                  </PixelBadge>
                </div>
                <div className="flex items-center gap-2.5 flex-wrap font-sans text-xs sm:text-sm text-retro-muted font-semibold">
                  <span>@{team.slug}</span>
                  <span>•</span>
                  <span className="font-pixel text-[10px] text-retro-muted">
                    {memberCount} {memberCount === 1 ? 'MEMBER' : 'MEMBERS'}
                  </span>
                </div>
              </PixelStack>
            </PixelStack>

            {isTeamAdmin && (
              <PixelButton asChild variant="solid" tone="purple" size="sm">
                <Link to="/teams/manage/$id" params={{ id: team.id }}>
                  {isOrg ? 'MANAGE ORG' : 'MANAGE TEAM'}
                </Link>
              </PixelButton>
            )}
          </PixelStack>
        </PixelCard>

        {/* Tight 2-Column Hugging Face Style Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Sidebar: Compact Avatar Cluster & Staff / Member Directory */}
          <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-4">
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

            {/* Staff / Member Directory List */}
            <PixelCard className="bg-retro-surface border-2 border-retro-border-strong">
              <PixelSectionHeader
                title={isOrg ? 'STAFF' : 'STAFF & MEMBERS'}
                titleTone="purple"
                size="sm"
              />
              <div className="mt-3 flex flex-col gap-2">
                {team.members && team.members.length > 0 ? (
                  team.members.map((m) => (
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
                    No active team members recorded.
                  </div>
                )}
              </div>
            </PixelCard>
          </div>

          {/* Right Main Content: About, Team Statistics, Affiliated Orgs/Teams, Newsletters */}
          <div className="lg:col-span-8 xl:col-span-9 flex flex-col gap-5">
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
                <PixelSectionHeader
                  title="TEAM STATISTICS"
                  titleTone="purple"
                  size="sm"
                />

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                  <PixelCard className="bg-retro-bg text-center py-3.5 border border-retro-border">
                    <div className="font-pixel text-[10px] text-retro-muted mb-1">
                      SEASON RANK
                    </div>
                    <div className="font-pixel text-2xl text-retro-gold font-bold">
                      {team.stats?.seasonRank != null && team.stats.seasonRank > 0
                        ? `#${team.stats.seasonRank}`
                        : '—'}
                    </div>
                  </PixelCard>

                  <PixelCard className="bg-retro-bg text-center py-3.5 border border-retro-border">
                    <div className="font-pixel text-[10px] text-retro-muted mb-1">
                      RANKING AVERAGE
                    </div>
                    <div className="font-mono text-2xl text-retro-text font-bold">
                      {team.stats?.rankingAverage != null && team.stats.rankingAverage > 0
                        ? team.stats.rankingAverage.toFixed(1)
                        : '—'}
                    </div>
                  </PixelCard>

                  <PixelCard className="bg-retro-bg text-center py-3.5 border border-retro-border">
                    <div className="font-pixel text-[10px] text-retro-muted mb-1">
                      AVG PTS / EVENT
                    </div>
                    <div className="font-mono text-2xl text-retro-text font-bold">
                      {team.stats?.averagePointsPerEvent != null &&
                      team.stats.averagePointsPerEvent > 0
                        ? team.stats.averagePointsPerEvent.toFixed(1)
                        : '—'}
                    </div>
                  </PixelCard>

                  <PixelCard className="bg-retro-bg text-center py-3.5 border border-retro-border">
                    <div className="font-pixel text-[10px] text-retro-muted mb-1">
                      POINTS AVERAGE
                    </div>
                    <div className="font-mono text-2xl text-retro-green font-bold">
                      {team.stats?.pointsAverage != null && team.stats.pointsAverage > 0
                        ? team.stats.pointsAverage.toFixed(1)
                        : '—'}
                    </div>
                  </PixelCard>
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
                  <div className="mt-3 font-sans text-xs text-retro-muted">
                    Loading newsletters...
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
