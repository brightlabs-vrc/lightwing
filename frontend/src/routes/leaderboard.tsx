import React, { useEffect, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  PixelContainer,
  PixelStack,
  PixelCard,
  PixelBadge,
  PixelSectionHeader,
  PixelButton,
  PixelSpinner,
  PixelEmptyState,
} from '@pxlkit/ui-kit'
import {
  getLeaderboard,
  recalculateLeaderboard,
  LeaderboardEntry,
  LeaderboardResponse,
} from '../lib/public-api'
import { Pagination } from '../components/Pagination'

export const Route = createFileRoute('/leaderboard')({
  component: LeaderboardPage,
})

export function LeaderboardPage() {
  const [sortBy, setSortBy] = useState<'points' | 'avgPosition' | 'avgPointsPerSeason'>('points')
  const [search, setSearch] = useState('')
  const [classTier, setClassTier] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [loading, setLoading] = useState(true)
  const [isRecalculating, setIsRecalculating] = useState(false)
  const [data, setData] = useState<LeaderboardResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchLeaderboard = async (forceRecalc = false) => {
    try {
      if (forceRecalc) {
        setIsRecalculating(true)
        const res = await recalculateLeaderboard()
        setData(res)
      } else {
        setLoading(true)
        const res = await getLeaderboard({
          SortBy: sortBy,
          Search: search.trim(),
          ClassTier: classTier,
          Limit: pageSize,
          Offset: (page - 1) * pageSize,
        })
        setData(res)
      }
      setError(null)
    } catch (err: any) {
      setError(err?.message || 'Failed to load leaderboard')
    } finally {
      setLoading(false)
      setIsRecalculating(false)
    }
  }

  useEffect(() => {
    void fetchLeaderboard()
  }, [sortBy, search, classTier, page, pageSize])

  const handleRecalculate = () => {
    void fetchLeaderboard(true)
  }

  const entries: LeaderboardEntry[] = data?.entries ?? []
  const total = data?.total ?? 0

  return (
    <PixelContainer maxWidth="full" padding="md">
      <PixelSectionHeader
        title="GLOBAL STANDINGS & LEADERBOARD"
        titleTone="gold"
        size="lg"
        actions={
          <PixelButton
            variant="soft"
            tone="purple"
            size="sm"
            onClick={handleRecalculate}
            disabled={isRecalculating || loading}
          >
            {isRecalculating ? 'RECALCULATING...' : 'REFRESH STANDINGS'}
          </PixelButton>
        }
      />

      {/* Filter Bar */}
      <PixelCard className="mt-6 mb-6 bg-retro-surface">
        <PixelStack direction="row" gap={4} align="center" justify="between" wrap>
          <PixelStack direction="row" gap={3} align="center" wrap>
            <input
              type="text"
              placeholder="Search driver or slug..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="px-3 py-1.5 bg-retro-bg border-2 border-retro-border rounded text-sm text-retro-text font-sans focus:outline-none focus:border-retro-primary min-w-[220px]"
            />

            <select
              value={classTier}
              onChange={(e) => {
                setClassTier(e.target.value)
                setPage(1)
              }}
              className="px-3 py-1.5 bg-retro-bg border-2 border-retro-border rounded text-sm text-retro-text font-sans focus:outline-none focus:border-retro-primary"
            >
              <option value="">All Class Tiers</option>
              <option value="G1">G1</option>
              <option value="G2">G2</option>
              <option value="G3">G3</option>
              <option value="OP">OP / Unrated</option>
            </select>
          </PixelStack>

          <PixelStack direction="row" gap={2} align="center">
            <span className="font-pixel text-xs text-retro-muted uppercase">SORT BY:</span>
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
          </PixelStack>
        </PixelStack>
      </PixelCard>

      {/* Main Table */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <PixelSpinner size="lg" />
        </div>
      ) : error ? (
        <PixelEmptyState title="Error loading leaderboard" description={error} />
      ) : entries.length === 0 ? (
        <PixelEmptyState
          title="No drivers found"
          description="No competitor match the search or filter criteria."
        />
      ) : (
        <PixelStack gap={6}>
          <div className="overflow-x-auto border-2 border-retro-border-strong rounded bg-retro-surface">
            <table className="w-full text-left font-sans text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-retro-border font-pixel text-xs text-retro-muted bg-retro-bg/60">
                  <th className="p-3 w-16">RANK</th>
                  <th className="p-3">DRIVER</th>
                  <th className="p-3 w-24">TIER</th>
                  <th className="p-3 text-right">TOTAL POINTS</th>
                  <th className="p-3 text-right">AVG POSITION</th>
                  <th className="p-3 text-right">AVG PTS / SEASON</th>
                  <th className="p-3 text-right">WINS</th>
                  <th className="p-3 text-right">EVENTS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-retro-border">
                {entries.map((e: LeaderboardEntry, idx: number) => {
                  const globalRank = (page - 1) * pageSize + idx + 1
                  const profilePath = e.slug ? `/${e.slug}` : `/u/${e.userId}`

                  return (
                    <tr
                      key={e.userId}
                      className="hover:bg-retro-bg/50 transition-colors duration-150"
                    >
                      <td className="p-3 font-pixel text-sm">
                        {globalRank === 1 ? (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-400 text-slate-950 font-bold text-xs shadow">
                            🥇 1
                          </span>
                        ) : globalRank === 2 ? (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-300 text-slate-900 font-bold text-xs shadow">
                            🥈 2
                          </span>
                        ) : globalRank === 3 ? (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-700 text-amber-100 font-bold text-xs shadow">
                            🥉 3
                          </span>
                        ) : (
                          <span className="text-retro-muted font-bold">#{globalRank}</span>
                        )}
                      </td>

                      <td className="p-3">
                        <Link
                          to={profilePath}
                          className="font-pixel text-sm text-retro-primary hover:underline font-bold"
                        >
                          {e.name}
                        </Link>
                        {e.slug && (
                          <div className="font-sans text-xs text-retro-muted">@{e.slug}</div>
                        )}
                      </td>

                      <td className="p-3">
                        {e.classTier ? (
                          <PixelBadge tone="purple">{e.classTier}</PixelBadge>
                        ) : (
                          <span className="text-xs text-retro-muted font-pixel">OPEN</span>
                        )}
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
            {data?.calculatedAt && (
              <span className="font-pixel text-[10px] text-retro-muted">
                CALCULATED: {new Date(data.calculatedAt).toLocaleString()}
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
