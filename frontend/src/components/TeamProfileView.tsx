import React from 'react'
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
import { UserLink } from './UserLink'
import { MarkdownView } from './MarkdownView'
import { useAuth } from '../hooks/useAuth'

interface TeamProfileViewProps {
  team: teammanager.Team
}

export const TeamProfileView: React.FC<TeamProfileViewProps> = ({ team }) => {
  const { session } = useAuth()
  const currentUserId = session?.user?.id
  const currentSiteRole = session?.user?.siteRole

  const isTeamAdmin = Boolean(
    currentUserId && (
      currentSiteRole === 'SITE_ADMIN' ||
      currentSiteRole === 'EVENT_ADMIN' ||
      team.members?.some(
        (m) =>
          m.userId === currentUserId &&
          (m.role.toLowerCase() === 'administrator' || m.role.toLowerCase() === 'organizationadministrator')
      )
    )
  )

  const affiliatedOrganizations = (team.organizations || []).filter(
    (org) => org.id !== team.id
  )

  const isOrg = !team.primaryOrganizationId || team.primaryOrganizationId === team.id

  return (
    <PixelContainer maxWidth="full" padding="md">
      {/* Header Card */}
      <PixelCard className="bg-retro-surface mb-8 border-2 border-retro-border-strong">
        <PixelStack direction="row" gap={5} align="center" wrap justify="between">
          <PixelStack direction="row" gap={5} align="center" wrap>
            {team.logo ? (
              <img
                src={team.logo}
                alt={team.name}
                className="w-20 h-20 rounded border-2 border-retro-border bg-retro-bg object-cover shadow"
              />
            ) : (
              <div className="w-20 h-20 rounded border-2 border-retro-border bg-retro-primary/20 text-retro-primary font-pixel text-2xl font-bold flex items-center justify-center">
                {team.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <PixelStack gap={1}>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-pixel text-retro-text tracking-wide font-bold">
                  {team.name}
                </h1>
                <PixelBadge tone="purple">
                  {isOrg ? 'ORGANIZATION' : 'TEAM ORGANIZATION'}
                </PixelBadge>
              </div>
              <div className="font-sans text-sm text-retro-muted font-semibold">
                @{team.slug}
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

      {/* 2-Column Hugging Face Style Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Avatar Grid & Staff / Member List */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          {/* Dedicated Avatar Grid (Hugging Face style) */}
          <PixelCard className="bg-retro-surface border-2 border-retro-border-strong">
            <PixelSectionHeader
              title={`MEMBERS (${team.members?.length || 0})`}
              titleTone="cyan"
              size="sm"
            />
            <div className="grid grid-cols-5 sm:grid-cols-6 lg:grid-cols-4 gap-3 mt-4">
              {team.members && team.members.length > 0 ? (
                team.members.slice(0, 25).map((m) => (
                  <Link
                    key={m.userId}
                    to="/$user"
                    params={{ user: m.slug || m.userId }}
                    title={`${m.name} (@${m.slug || m.userId})`}
                    className="block group relative"
                  >
                    <img
                      src={m.image || '/fallback_avatar.jpg'}
                      alt={m.name}
                      onError={(e) => {
                        e.currentTarget.src = '/fallback_avatar.jpg'
                      }}
                      className="w-12 h-12 rounded-full object-cover border-2 border-retro-border group-hover:border-retro-primary transition-all shadow-sm"
                    />
                  </Link>
                ))
              ) : (
                <div className="col-span-full font-sans text-xs text-retro-muted py-2">
                  No members recorded.
                </div>
              )}
            </div>
          </PixelCard>

          {/* Staff / Member Directory List */}
          <PixelCard className="bg-retro-surface border-2 border-retro-border-strong">
            <PixelSectionHeader
              title={isOrg ? 'STAFF' : 'STAFF & MEMBERS'}
              titleTone="purple"
              size="sm"
            />
            <div className="mt-4 flex flex-col gap-3">
              {team.members && team.members.length > 0 ? (
                team.members.map((m) => (
                  <div
                    key={m.userId}
                    className="flex items-center justify-between p-2 rounded bg-retro-bg/60 border border-retro-border hover:border-retro-primary transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
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
                          className="w-10 h-10 rounded-full object-cover border border-retro-border"
                        />
                      </Link>
                      <div className="flex flex-col min-w-0">
                        <UserLink
                          userId={m.userId}
                          name={m.name}
                          slug={m.slug}
                          className="font-bold text-sm text-retro-text hover:text-retro-primary truncate"
                        />
                        <span className="text-xs text-retro-muted font-sans truncate">
                          @{m.slug || m.userId}
                        </span>
                      </div>
                    </div>
                    <PixelBadge
                      tone={
                        m.role.toLowerCase().includes('admin')
                          ? 'purple'
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

        {/* Right Column: Description Card, Statistics, and Affiliated Orgs */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Description Card with GitHub Flavoured Markdown */}
          <PixelCard className="bg-retro-surface border-2 border-retro-border-strong">
            <PixelSectionHeader title="ABOUT" titleTone="cyan" size="sm" />
            <div className="mt-4 font-sans text-sm leading-relaxed text-retro-text">
              <MarkdownView
                content={team.description}
                fallbackText="No description provided for this organization."
              />
            </div>
          </PixelCard>

          {/* Affiliated Organizations Section */}
          {affiliatedOrganizations.length > 0 && (
            <PixelCard className="bg-retro-surface border-2 border-retro-border-strong">
              <PixelSectionHeader
                title={`AFFILIATED ORGANIZATIONS (${affiliatedOrganizations.length})`}
                titleTone="cyan"
                size="sm"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
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
                          className="w-10 h-10 rounded border border-retro-border bg-retro-bg object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded border border-retro-border bg-retro-primary/10 text-retro-primary font-pixel text-sm font-bold flex items-center justify-center">
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

          {/* Team Aggregate Statistics - Excluded for governing bodies / standalone organizations */}
          {!isOrg && (
            <PixelCard className="bg-retro-surface border-2 border-retro-border-strong">
              <PixelSectionHeader
                title="TEAM STATISTICS"
                titleTone="purple"
                size="sm"
              />

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                <PixelCard className="bg-retro-bg text-center py-4 border border-retro-border">
                  <div className="font-pixel text-[10px] text-retro-muted mb-1">SEASON RANK</div>
                  <div className="font-pixel text-2xl text-retro-gold font-bold">
                    {team.stats?.seasonRank ? `#${team.stats.seasonRank}` : '—'}
                  </div>
                </PixelCard>

                <PixelCard className="bg-retro-bg text-center py-4 border border-retro-border">
                  <div className="font-pixel text-[10px] text-retro-muted mb-1">RANKING AVERAGE</div>
                  <div className="font-mono text-2xl text-retro-text font-bold">
                    {team.stats?.rankingAverage ? team.stats.rankingAverage.toFixed(1) : '—'}
                  </div>
                </PixelCard>

                <PixelCard className="bg-retro-bg text-center py-4 border border-retro-border">
                  <div className="font-pixel text-[10px] text-retro-muted mb-1">AVG PTS / EVENT</div>
                  <div className="font-mono text-2xl text-retro-text font-bold">
                    {team.stats?.averagePointsPerEvent ? team.stats.averagePointsPerEvent.toFixed(1) : '—'}
                  </div>
                </PixelCard>

                <PixelCard className="bg-retro-bg text-center py-4 border border-retro-border">
                  <div className="font-pixel text-[10px] text-retro-muted mb-1">POINTS AVERAGE</div>
                  <div className="font-mono text-2xl text-retro-green font-bold">
                    {team.stats?.pointsAverage ? team.stats.pointsAverage.toFixed(1) : '—'}
                  </div>
                </PixelCard>
              </div>
            </PixelCard>
          )}
        </div>
      </div>
    </PixelContainer>
  )
}
