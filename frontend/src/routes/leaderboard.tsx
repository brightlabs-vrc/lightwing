import React, { useEffect, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  PixelContainer,
  PixelStack,
  PixelCard,
  PixelBadge,
  PixelSectionHeader,
  PixelButton,
  PixelEmptyState,
} from '@pxlkit/ui-kit'
import {
  getLeaderboard,
  getTeamLeaderboard,
  LeaderboardEntry,
  LeaderboardResponse,
  TeamLeaderboardEntry,
  TeamLeaderboardResponse,
} from '../lib/public-api'
import { Pagination } from '../components/Pagination'
import { usePageHead } from '../hooks/usePageHead'
import { buildSeoMeta } from '../lib/seo'
import { PixelSkeletonTable } from '../components/LoadingSkeleton'

export const Route = createFileRoute('/leaderboard')({
  ssr: 'data-only',
  head: () => ({
    meta: buildSeoMeta({
      title: 'Leaderboard',
      description: 'Global individual and team standings leaderboard on UmaKeiba.',
    }),
  }),
  component: LeaderboardPage,
})

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-full bg-amber-400 text-slate-950 font-bold text-xs shadow whitespace-nowrap">
        <span>🥇</span>
        <span>1</span>
      </span>
    )
  }
  if (rank === 2) {
    return (
      <span className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-full bg-slate-300 text-slate-900 font-bold text-xs shadow whitespace-nowrap">
        <span>🥈</span>
        <span>2</span>
      </span>
    )
  }
  if (rank === 3) {
    return (
      <span className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-full bg-amber-700 text-amber-100 font-bold text-xs shadow whitespace-nowrap">
        <span>🥉</span>
        <span>3</span>
      </span>
    )
  }
  return <span className="text-retro-muted font-bold">#{rank}</span>
}

export function LeaderboardPage() {
  usePageHead({
    title: 'Leaderboard',
    description: 'Global individual and team standings leaderboard on UmaKeiba.',
  })
  const currentYear = new Date().getUTCFullYear()
  const [boardType, setBoardType] = useState<'individual' | 'teams'>('individual')
  const [sortBy, setSortBy] = useState<'points' | 'rating' | 'avgPosition' | 'avgPointsPerSeason'>('points')
  const [teamSortBy, setTeamSortBy] = useState<'points' | 'avgRank' | 'avgPoints'>('points')
  const [search, setSearch] = useState('')
  const [classTier, setClassTier] = useState('')
  // year === 0 means All-Time
  const [year, setYear] = useState<number>(currentYear)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<LeaderboardResponse | null>(null)
  const [teamData, setTeamData] = useState<TeamLeaderboardResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const fetchLeaderboard = async () => {
      try {
        setLoading(true)
        if (boardType === 'individual') {
          const res = await getLeaderboard({
            SortBy: sortBy,
            Search: search.trim(),
            ClassTier: classTier,
            Year: year === 0 ? 0 : year,
            AllTime: year === 0,
            Limit: pageSize,
            Offset: (page - 1) * pageSize,
          })
          if (active) {
            setData(res)
            setError(null)
          }
        } else {
          const res = await getTeamLeaderboard({
            SortBy: teamSortBy,
            Search: search.trim(),
            Year: year === 0 ? 0 : year,
            AllTime: year === 0,
            Limit: pageSize,
            Offset: (page - 1) * pageSize,
          })
          if (active) {
            setTeamData(res)
            setError(null)
          }
        }
      } catch (err: any) {
        if (active) {
          setError(err?.message || 'Failed to load leaderboard')
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }
    void fetchLeaderboard()
    return () => {
      active = false
    }
  }, [boardType, sortBy, teamSortBy, search, classTier, year, page, pageSize])

  const entries: LeaderboardEntry[] = data?.entries ?? []
  const teamEntries: TeamLeaderboardEntry[] = teamData?.entries ?? []
  const total = boardType === 'individual' ? (data?.total ?? 0) : (teamData?.total ?? 0)
  const availableYears: number[] =
    (boardType === 'individual' ? data?.availableYears : teamData?.availableYears)?.length
      ? (boardType === 'individual' ? data!.availableYears : teamData!.availableYears)
      : [currentYear]
  const calculatedAt = boardType === 'individual' ? data?.calculatedAt : teamData?.calculatedAt

  return (
    <PixelContainer maxWidth="full" padding="md">
      <PixelStack direction="row" gap={4} align="center" justify="between" wrap>
        <PixelSectionHeader
          title="GLOBAL STANDINGS & LEADERBOARD"
          titleTone="gold"
          size="lg"
        />

        {/* Individual vs Teams Switcher */}
        <div className="flex items-center gap-2">
          <PixelButton
            variant={boardType === 'individual' ? 'solid' : 'ghost'}
            tone={boardType === 'individual' ? 'purple' : 'neutral'}
            size="sm"
            onClick={() => {
              setBoardType('individual')
              setPage(1)
            }}
          >
            INDIVIDUAL
          </PixelButton>
          <PixelButton
            variant={boardType === 'teams' ? 'solid' : 'ghost'}
            tone={boardType === 'teams' ? 'cyan' : 'neutral'}
            size="sm"
            onClick={() => {
              setBoardType('teams')
              setPage(1)
            }}
          >
            TEAMS
          </PixelButton>
        </div>
      </PixelStack>

      {/* Filter Bar */}
      <PixelCard className="mt-6 mb-6 bg-retro-surface">
        <PixelStack direction="row" gap={4} align="center" justify="between" wrap>
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <input
              type="text"
              placeholder={
                boardType === 'individual'
                  ? 'Search participant or @username...'
                  : 'Search team or @slug...'
              }
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="px-3 py-1.5 bg-retro-bg border-2 border-retro-border rounded text-sm text-retro-text font-sans focus:outline-none focus:border-retro-primary w-full sm:w-64"
            />

            {boardType === 'individual' && (
              <select
                value={classTier}
                onChange={(e) => {
                  setClassTier(e.target.value)
                  setPage(1)
                }}
                className="px-3 py-1.5 bg-retro-bg border-2 border-retro-border rounded text-sm text-retro-text font-sans focus:outline-none focus:border-retro-primary flex-1 sm:flex-initial"
              >
                <option value="">All Class Tiers</option>
                <option value="G1">G1</option>
                <option value="G2">G2</option>
                <option value="G3">G3</option>
              </select>
            )}

            <select
              aria-label="Season Year"
              value={year}
              onChange={(e) => {
                setYear(Number(e.target.value))
                setPage(1)
              }}
              className="px-3 py-1.5 bg-retro-bg border-2 border-retro-border rounded text-sm text-retro-text font-sans focus:outline-none focus:border-retro-primary flex-1 sm:flex-initial"
            >
              <option value={0}>All-Time</option>
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y} Season
                </option>
              ))}
            </select>
          </div>

          <PixelStack direction="row" gap={2} align="center" wrap>
            <span className="font-pixel text-xs text-retro-muted uppercase">SORT BY:</span>
            {boardType === 'individual' ? (
              <>
                <PixelButton
                  variant={sortBy === 'points' ? 'solid' : 'ghost'}
                  tone={sortBy === 'points' ? 'gold' : 'neutral'}
                  size="sm"
                  onClick={() => {
                    setSortBy('points')
                    setPage(1)
                  }}
                >
                  TOTAL POINTS
                </PixelButton>
                <PixelButton
                  variant={sortBy === 'rating' ? 'solid' : 'ghost'}
                  tone={sortBy === 'rating' ? 'gold' : 'neutral'}
                  size="sm"
                  onClick={() => {
                    setSortBy('rating')
                    setPage(1)
                  }}
                >
                  RATING
                </PixelButton>
                <PixelButton
                  variant={sortBy === 'avgPosition' ? 'solid' : 'ghost'}
                  tone={sortBy === 'avgPosition' ? 'gold' : 'neutral'}
                  size="sm"
                  onClick={() => {
                    setSortBy('avgPosition')
                    setPage(1)
                  }}
                >
                  AVG POSITION
                </PixelButton>
                <PixelButton
                  variant={sortBy === 'avgPointsPerSeason' ? 'solid' : 'ghost'}
                  tone={sortBy === 'avgPointsPerSeason' ? 'gold' : 'neutral'}
                  size="sm"
                  onClick={() => {
                    setSortBy('avgPointsPerSeason')
                    setPage(1)
                  }}
                >
                  AVG PTS / SEASON
                </PixelButton>
              </>
            ) : (
              <>
                <PixelButton
                  variant={teamSortBy === 'points' ? 'solid' : 'ghost'}
                  tone={teamSortBy === 'points' ? 'gold' : 'neutral'}
                  size="sm"
                  onClick={() => {
                    setTeamSortBy('points')
                    setPage(1)
                  }}
                >
                  TEAM POINTS
                </PixelButton>
                <PixelButton
                  variant={teamSortBy === 'avgRank' ? 'solid' : 'ghost'}
                  tone={teamSortBy === 'avgRank' ? 'gold' : 'neutral'}
                  size="sm"
                  onClick={() => {
                    setTeamSortBy('avgRank')
                    setPage(1)
                  }}
                >
                  AVG PLACEMENT
                </PixelButton>
                <PixelButton
                  variant={teamSortBy === 'avgPoints' ? 'solid' : 'ghost'}
                  tone={teamSortBy === 'avgPoints' ? 'gold' : 'neutral'}
                  size="sm"
                  onClick={() => {
                    setTeamSortBy('avgPoints')
                    setPage(1)
                  }}
                >
                  AVG PTS / EVENT
                </PixelButton>
              </>
            )}
          </PixelStack>
        </PixelStack>
      </PixelCard>

      {/* Main Table */}
      {loading ? (
        <PixelSkeletonTable rows={8} />
      ) : error ? (
        <PixelEmptyState title="Error loading leaderboard" description={error} />
      ) : boardType === 'individual' ? (
        entries.length === 0 ? (
          <PixelEmptyState
            title="No participants found"
            description="No participants match the search or filter criteria."
          />
        ) : (
          <PixelStack gap={6}>
            <div className="overflow-x-auto border-2 border-retro-border-strong rounded bg-retro-surface">
              <table className="w-full text-left font-sans text-sm border-collapse">
                <thead>
                  <tr className="border-b-2 border-retro-border font-pixel text-xs text-retro-muted bg-retro-bg/60">
                    <th className="p-3 w-20 text-center">RANK</th>
                    <th className="p-3">PARTICIPANT</th>
                    <th className="p-3 w-24 text-center">TIER</th>
                    <th className="p-3 text-right">
                      <span className="inline-flex items-center justify-end gap-1.5">
                        <span>RATING</span>
                        <span
                          className="relative group inline-flex items-center justify-center w-4 h-4 rounded-full border border-retro-border text-[10px] text-retro-muted hover:text-retro-primary hover:border-retro-primary cursor-help"
                          tabIndex={0}
                          aria-label="We use Glicko-2 to calculate your rankings"
                          title="We use Glicko-2 to calculate your rankings"
                        >
                          ?
                          <span className="pointer-events-none opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity absolute right-0 top-full mt-2 z-20 w-56 p-2 rounded border-2 border-retro-border-strong bg-retro-bg text-retro-text font-sans text-xs font-normal text-left shadow-lg normal-case">
                            We use Glicko-2 to calculate your rankings.
                          </span>
                        </span>
                      </span>
                    </th>
                    <th className="p-3 text-right">TOTAL POINTS</th>
                    <th className="p-3 text-right">AVG POSITION</th>
                    <th className="p-3 text-right">AVG PTS / SEASON</th>
                    <th className="p-3 text-right">WINS</th>
                    <th className="p-3 text-right">EVENTS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-retro-border">
                  {entries.map((e: LeaderboardEntry, idx: number) => {
                    const displayRank = e.rank || (page - 1) * pageSize + idx + 1
                    const targetSlug = e.slug || e.userId
                    const ratingValue = e.rating ?? 1500
                    const rdValue = e.ratingDeviation ?? 350
                    const seasonDelta = e.seasonRatingDelta ?? 0

                    return (
                      <tr
                        key={e.userId}
                        className="hover:bg-retro-bg/50 transition-colors duration-150"
                      >
                        <td className="p-3 font-pixel text-sm text-center">
                          <RankBadge rank={displayRank} />
                        </td>

                        <td className="p-3">
                          <Link
                            to="/$user"
                            params={{ user: targetSlug }}
                            className="font-pixel text-sm text-retro-primary hover:underline font-bold"
                          >
                            {e.name}
                          </Link>
                          {e.slug && (
                            <div className="font-sans text-xs text-retro-muted">@{e.slug}</div>
                          )}
                        </td>

                        <td className="p-3 text-center">
                          {e.classTier ? (
                            <PixelBadge tone="purple">{e.classTier}</PixelBadge>
                          ) : (
                            <span className="text-xs text-retro-muted font-pixel">OPEN</span>
                          )}
                        </td>

                        <td className="p-3 text-right">
                          <div className="inline-flex items-baseline justify-end gap-1">
                            <span className="font-pixel text-base text-retro-primary font-bold">
                              {ratingValue}
                            </span>
                            {e.isProvisional && (
                              <span
                                className="font-pixel text-[9px] text-retro-muted"
                                title="Provisional rating (fewer than 5 rated races or high RD)"
                              >
                                ?
                              </span>
                            )}
                          </div>
                          <div className="font-mono text-[11px] text-retro-muted flex items-center justify-end gap-1.5">
                            <span>±{rdValue}</span>
                            {seasonDelta !== 0 && (
                              <span className={seasonDelta > 0 ? 'text-retro-green font-semibold' : 'text-retro-pink font-semibold'}>
                                {seasonDelta > 0 ? `+${seasonDelta}` : seasonDelta}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="p-3 text-right font-pixel text-base text-retro-gold font-bold">
                          {e.totalPoints.toLocaleString()}
                        </td>

                        <td className="p-3 text-right font-mono font-semibold text-retro-text">
                          {e.averagePosition > 0 ? e.averagePosition.toFixed(1) : '—'}
                        </td>

                        <td className="p-3 text-right font-mono font-semibold text-retro-text">
                          {e.averagePointsPerSeason.toFixed(1)}
                        </td>

                        <td className="p-3 text-right font-pixel text-retro-green font-bold">
                          {e.wins}
                        </td>

                        <td className="p-3 text-right text-xs text-retro-muted font-sans">
                          {e.eventsParticipated} ({e.racesParticipated} races)
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center flex-wrap gap-4">
              {calculatedAt && (
                <span className="font-pixel text-[10px] text-retro-muted">
                  CALCULATED: {new Date(calculatedAt).toLocaleString()}
                </span>
              )}

              <Pagination
                page={page}
                pageSize={pageSize}
                total={total}
                onPageChange={setPage}
                onPageSizeChange={(sz) => {
                  setPageSize(sz)
                  setPage(1)
                }}
                variant="pixel"
              />
            </div>
          </PixelStack>
        )
      ) : teamEntries.length === 0 ? (
        <PixelEmptyState
          title="No teams found"
          description="No approved teams match the selected season or search criteria."
        />
      ) : (
        <PixelStack gap={6}>
          {teamData?.rankingSource && (
            <div className="flex items-center gap-2">
              <PixelBadge tone={teamData.rankingSource === 'TEAM_EVENTS' ? 'cyan' : 'neutral'}>
                {teamData.rankingSource === 'TEAM_EVENTS'
                  ? 'RANKED BY TEAM EVENTS'
                  : 'RANKED BY MEMBER AVERAGES (NO TEAM EVENTS YET)'}
              </PixelBadge>
            </div>
          )}

          <div className="overflow-x-auto border-2 border-retro-border-strong rounded bg-retro-surface">
            <table className="w-full text-left font-sans text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-retro-border font-pixel text-xs text-retro-muted bg-retro-bg/60">
                  <th className="p-3 w-20 text-center">RANK</th>
                  <th className="p-3">TEAM</th>
                  <th className="p-3 text-right">TEAM POINTS</th>
                  <th className="p-3 text-right">TEAM EVENTS</th>
                  <th className="p-3 text-right">AVG TEAM PLACE</th>
                  <th className="p-3 text-right">AVG TEAM PTS</th>
                  <th className="p-3 text-right">MEMBER AVG PTS</th>
                  <th className="p-3 text-right">ROSTER</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-retro-border">
                {teamEntries.map((t: TeamLeaderboardEntry, idx: number) => {
                  const displayRank = t.rank || (page - 1) * pageSize + idx + 1
                  return (
                    <tr
                      key={t.teamId}
                      className="hover:bg-retro-bg/50 transition-colors duration-150"
                    >
                      <td className="p-3 font-pixel text-sm text-center">
                        <RankBadge rank={displayRank} />
                      </td>

                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          {t.logo ? (
                            <img
                              src={t.logo}
                              alt={t.name}
                              className="w-8 h-8 rounded border border-retro-border object-cover shrink-0 bg-retro-bg"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded border border-retro-border bg-retro-primary/15 text-retro-primary font-pixel text-[10px] font-bold flex items-center justify-center shrink-0">
                              {t.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <Link
                              to="/t/$team"
                              params={{ team: t.slug || t.teamId }}
                              className="font-pixel text-sm text-retro-primary hover:underline font-bold block truncate"
                            >
                              {t.name}
                            </Link>
                            <div className="font-sans text-xs text-retro-muted">@{t.slug}</div>
                          </div>
                        </div>
                      </td>

                      <td className="p-3 text-right font-pixel text-base text-retro-gold font-bold">
                        {t.teamEventsParticipated > 0 ? t.teamTotalPoints.toLocaleString() : '—'}
                      </td>

                      <td className="p-3 text-right font-mono font-semibold text-retro-text">
                        {t.teamEventsParticipated}
                      </td>

                      <td className="p-3 text-right font-mono font-semibold text-retro-text">
                        {t.teamEventRankAverage > 0 ? `#${t.teamEventRankAverage.toFixed(1)}` : '—'}
                      </td>

                      <td className="p-3 text-right font-mono font-semibold text-retro-green">
                        {t.teamEventsParticipated > 0 ? t.teamAveragePoints.toFixed(1) : '—'}
                      </td>

                      <td className="p-3 text-right font-mono text-xs text-retro-muted">
                        {t.memberPointsAverage > 0 ? t.memberPointsAverage.toFixed(1) : '—'}
                      </td>

                      <td className="p-3 text-right text-xs text-retro-muted font-sans">
                        {t.memberCount}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center flex-wrap gap-4">
            {calculatedAt && (
              <span className="font-pixel text-[10px] text-retro-muted">
                CALCULATED: {new Date(calculatedAt).toLocaleString()}
              </span>
            )}

            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={(sz) => {
                setPageSize(sz)
                setPage(1)
              }}
              variant="pixel"
            />
          </div>
        </PixelStack>
      )}
    </PixelContainer>
  )
}
