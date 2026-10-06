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

  const isStandaloneOrg = affiliatedOrganizations.length === 0 || team.primaryOrganizationId === team.id

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
                  {isStandaloneOrg ? 'ORGANIZATION' : 'TEAM ORGANIZATION'}
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
                {isStandaloneOrg ? 'MANAGE ORG' : 'MANAGE TEAM'}
              </Link>
            </PixelButton>
          )}
        </PixelStack>
      </PixelCard>

      {/* Affiliated Organizations Section */}
      {affiliatedOrganizations.length > 0 && (
        <div className="mb-8">
          <PixelSectionHeader
            title={`AFFILIATED ORGANIZATIONS (${affiliatedOrganizations.length})`}
            titleTone="cyan"
            size="md"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {affiliatedOrganizations.map((org) => (
              <PixelCard key={org.id} className="bg-retro-surface p-4 border-2 border-retro-border hover:border-retro-primary transition-colors">
                <PixelStack direction="row" gap={3} align="center">
                  {org.logo ? (
                    <img
                      src={org.logo}
                      alt={org.name}
                      className="w-12 h-12 rounded border border-retro-border bg-retro-bg object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded border border-retro-border bg-retro-primary/10 text-retro-primary font-pixel text-lg font-bold flex items-center justify-center">
                      {org.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <PixelStack gap={1} className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        to="/t/$team"
                        params={{ team: org.slug || org.id }}
                        className="font-pixel text-sm text-retro-text hover:text-retro-primary font-bold truncate"
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
        </div>
      )}

      {/* Team Aggregate Statistics */}
      <PixelSectionHeader
        title="TEAM STATISTICS"
        titleTone="purple"
        size="md"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 mb-8">
        <PixelCard className="bg-retro-surface text-center py-5">
          <div className="font-pixel text-xs text-retro-muted mb-1">SEASON RANK</div>
          <div className="font-pixel text-3xl text-retro-gold font-bold">
            {team.stats?.seasonRank ? `#${team.stats.seasonRank}` : '—'}
          </div>
        </PixelCard>

        <PixelCard className="bg-retro-surface text-center py-5">
          <div className="font-pixel text-xs text-retro-muted mb-1">RANKING AVERAGE</div>
          <div className="font-mono text-3xl text-retro-text font-bold">
            {team.stats?.rankingAverage ? team.stats.rankingAverage.toFixed(1) : '—'}
          </div>
        </PixelCard>

        <PixelCard className="bg-retro-surface text-center py-5">
          <div className="font-pixel text-xs text-retro-muted mb-1">AVG POINTS / EVENT</div>
          <div className="font-mono text-3xl text-retro-text font-bold">
            {team.stats?.averagePointsPerEvent ? team.stats.averagePointsPerEvent.toFixed(1) : '—'}
          </div>
        </PixelCard>

        <PixelCard className="bg-retro-surface text-center py-5">
          <div className="font-pixel text-xs text-retro-muted mb-1">POINTS AVERAGE</div>
          <div className="font-mono text-3xl text-retro-green font-bold">
            {team.stats?.pointsAverage ? team.stats.pointsAverage.toFixed(1) : '—'}
          </div>
        </PixelCard>
      </div>

      {/* Team Roster Section */}
      <PixelCard className="bg-retro-surface">
        <PixelSectionHeader
          title={`ROSTER (${team.members?.length || 0} MEMBERS)`}
          titleTone="cyan"
          size="sm"
        />

        <div className="mt-4 overflow-x-auto border-2 border-retro-border rounded bg-retro-bg">
          <table className="w-full text-left font-sans text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-retro-border font-pixel text-xs text-retro-muted bg-retro-surface/80">
                <th className="p-3">MEMBER NAME</th>
                <th className="p-3 text-right">ROLE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-retro-border">
              {team.members && team.members.length > 0 ? (
                team.members.map((m) => (
                  <tr key={m.userId} className="hover:bg-retro-surface/50 transition-colors">
                    <td className="p-3">
                      <UserLink userId={m.userId} name={m.name} slug={m.slug} />
                    </td>
                    <td className="p-3 text-right">
                      <PixelBadge tone={m.role === 'ADMINISTRATOR' ? 'purple' : 'neutral'}>
                        {m.role}
                      </PixelBadge>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={2} className="p-4 text-center text-retro-muted font-sans text-xs">
                    No active team members recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </PixelCard>
    </PixelContainer>
  )
}
