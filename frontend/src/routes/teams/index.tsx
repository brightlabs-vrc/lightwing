import { useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  PixelBadge,
  PixelButton,
  PixelCard,
  PixelContainer,
  PixelEmptyState,
  PixelSectionHeader,
  PixelStack,
} from '@pxlkit/ui-kit'
import { listPublicOrganizations, listPublicTeams } from '../../lib/public-api'
import { useAuth } from '../../hooks/useAuth'
import { usePageHead } from '../../hooks/usePageHead'
import { buildSeoMeta } from '../../lib/seo'
import { PixelSkeletonList } from '../../components/LoadingSkeleton'

export const Route = createFileRoute('/teams/')({
  ssr: 'data-only',
  head: () => ({
    meta: buildSeoMeta({
      title: 'Teams & Organizations',
      description: 'Browse competitive racing teams and approved organizations on UmaKeiba.',
    }),
  }),
  component: TeamsDirectoryPage,
})

interface DirectoryEntity {
  id: string
  name: string
  slug: string
  logo?: string | null
  description?: string | null
  kind: 'ORGANIZATION' | 'TEAM'
  memberCount: number
  primaryOrgName?: string | null
}

function TeamsDirectoryPage() {
  usePageHead({
    title: 'Teams & Organizations',
    description: 'Browse competitive racing teams and approved organizations on UmaKeiba.',
  })

  const { session } = useAuth()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'ALL' | 'ORGANIZATION' | 'TEAM'>('ALL')

  const {
    data: orgsData,
    isLoading: loadingOrgs,
    error: orgsError,
  } = useQuery({
    queryKey: ['public-organizations'],
    queryFn: () => listPublicOrganizations(),
  })

  const {
    data: teamsData,
    isLoading: loadingTeams,
    error: teamsError,
  } = useQuery({
    queryKey: ['public-teams'],
    queryFn: () => listPublicTeams('', 200, 0),
  })

  const isLoading = loadingOrgs || loadingTeams
  const error = orgsError || teamsError

  const entities = useMemo<DirectoryEntity[]>(() => {
    const orgs: DirectoryEntity[] = (orgsData?.organizations ?? []).map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      logo: o.logo,
      description: o.description,
      kind: 'ORGANIZATION',
      memberCount: o.memberCount ?? 0,
      primaryOrgName: null,
    }))

    const teams: DirectoryEntity[] = (teamsData?.teams ?? []).map((t) => {
      const primaryOrg = (t.organizations ?? []).find((o) => o.isPrimary) ?? t.organizations?.[0]
      return {
        id: t.id,
        name: t.name,
        slug: t.slug,
        logo: t.logo,
        description: t.description,
        kind: 'TEAM',
        memberCount: t.memberCount ?? 0,
        primaryOrgName: primaryOrg?.name ?? null,
      }
    })

    return [...orgs, ...teams]
  }, [orgsData, teamsData])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return entities.filter((item) => {
      if (filter !== 'ALL' && item.kind !== filter) return false
      if (!q) return true
      return (
        item.name.toLowerCase().includes(q) ||
        item.slug.toLowerCase().includes(q) ||
        (item.description ?? '').toLowerCase().includes(q) ||
        (item.primaryOrgName ?? '').toLowerCase().includes(q)
      )
    })
  }, [entities, filter, search])

  const orgCount = entities.filter((e) => e.kind === 'ORGANIZATION').length
  const teamCount = entities.filter((e) => e.kind === 'TEAM').length

  return (
    <PixelContainer maxWidth="full" padding="md">
      <PixelSectionHeader
        title="TEAMS & ORGANIZATIONS"
        titleTone="purple"
        size="lg"
        actions={
          <PixelStack direction="row" gap={2} align="center" wrap>
            <PixelBadge tone="neutral">{filtered.length} LISTED</PixelBadge>
            <PixelButton asChild variant="solid" tone="purple" size="sm">
              <Link to={session ? '/teams/new' : '/auth'}>+ REGISTER TEAM / ORG</Link>
            </PixelButton>
          </PixelStack>
        }
      />

      {/* Search & Filter Controls */}
      <div className="flex flex-col items-center gap-4 mt-6 mb-8">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search organizations or teams by name, @slug, or description..."
          className="w-full max-w-lg px-4 py-2 bg-retro-bg border-2 border-retro-border rounded text-sm text-retro-text font-sans focus:outline-none focus:border-retro-primary text-center shadow-sm"
        />

        <div className="flex items-center gap-2 flex-wrap justify-center">
          <PixelButton
            variant={filter === 'ALL' ? 'solid' : 'ghost'}
            tone={filter === 'ALL' ? 'purple' : 'neutral'}
            size="sm"
            onClick={() => setFilter('ALL')}
          >
            ALL ({entities.length})
          </PixelButton>
          <PixelButton
            variant={filter === 'ORGANIZATION' ? 'solid' : 'ghost'}
            tone={filter === 'ORGANIZATION' ? 'purple' : 'neutral'}
            size="sm"
            onClick={() => setFilter('ORGANIZATION')}
          >
            ORGANIZATIONS ({orgCount})
          </PixelButton>
          <PixelButton
            variant={filter === 'TEAM' ? 'solid' : 'ghost'}
            tone={filter === 'TEAM' ? 'cyan' : 'neutral'}
            size="sm"
            onClick={() => setFilter('TEAM')}
          >
            TEAMS ({teamCount})
          </PixelButton>
        </div>
      </div>

      {isLoading ? (
        <PixelSkeletonList count={4} />
      ) : error ? (
        <PixelEmptyState
          title="Unable to Load Directory"
          description={error instanceof Error ? error.message : 'Something went wrong while fetching teams.'}
        />
      ) : filtered.length === 0 ? (
        <PixelEmptyState
          title="No Teams or Organizations Found"
          description={
            search.trim()
              ? `No entries matched "${search}".`
              : 'No approved organizations or teams have been registered yet.'
          }
          action={
            <PixelButton asChild variant="solid" tone="purple" size="sm">
              <Link to={session ? '/teams/new' : '/auth'}>REGISTER A TEAM OR ORG</Link>
            </PixelButton>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((item) => (
            <Link
              key={`${item.kind}-${item.id}`}
              to="/t/$team"
              params={{ team: item.slug || item.id }}
              className="block group"
            >
              <PixelCard className="h-full bg-retro-surface border-2 border-retro-border-strong group-hover:border-retro-primary transition-colors flex flex-col">
                <div className="flex items-start gap-4">
                  {item.logo ? (
                    <img
                      src={item.logo}
                      alt={item.name}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                      className="w-14 h-14 rounded border-2 border-retro-border bg-retro-bg object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded border-2 border-retro-border bg-retro-primary/15 text-retro-primary font-pixel text-lg font-bold flex items-center justify-center shrink-0">
                      {item.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-pixel text-sm text-retro-text font-bold group-hover:text-retro-primary transition-colors truncate">
                        {item.name}
                      </h2>
                    </div>
                    <div className="font-sans text-xs text-retro-muted mt-0.5 truncate">
                      @{item.slug}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap mt-2">
                      <PixelBadge tone={item.kind === 'ORGANIZATION' ? 'purple' : 'cyan'}>
                        {item.kind}
                      </PixelBadge>
                      {item.primaryOrgName && (
                        <PixelBadge tone="neutral">{item.primaryOrgName}</PixelBadge>
                      )}
                    </div>
                  </div>
                </div>

                {item.description ? (
                  <p className="font-sans text-xs text-retro-muted mt-4 line-clamp-3 flex-1 leading-relaxed">
                    {item.description}
                  </p>
                ) : (
                  <p className="font-sans text-xs text-retro-muted/60 italic mt-4 flex-1">
                    No description provided.
                  </p>
                )}

                <div className="mt-4 pt-3 border-t border-retro-border flex items-center justify-between">
                  <span className="font-pixel text-[10px] text-retro-muted">
                    {item.memberCount} {item.memberCount === 1 ? 'MEMBER' : 'MEMBERS'}
                  </span>
                  <span className="font-pixel text-[10px] text-retro-primary group-hover:translate-x-0.5 transition-transform">
                    VIEW PROFILE →
                  </span>
                </div>
              </PixelCard>
            </Link>
          ))}
        </div>
      )}
    </PixelContainer>
  )
}
