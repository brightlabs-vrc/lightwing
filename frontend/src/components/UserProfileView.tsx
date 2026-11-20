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
import type { auth, eventmanager } from '../lib/client'
import { getLeaderboard, getUserRaceRecords, LeaderboardEntry } from '../lib/public-api'
import { useAuth } from '../hooks/useAuth'
import { usePageHead } from '../hooks/usePageHead'
import { Pagination } from './Pagination'
import { MarkdownView } from './MarkdownView'
import { PixelSkeletonTable } from './LoadingSkeleton'

interface UserProfileViewProps {
  user: auth.UserProfile
}

export const UserProfileView: React.FC<UserProfileViewProps> = ({ user }) => {
  const { session } = useAuth()
  const [stats, setStats] = useState<LeaderboardEntry | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)
  const isSelf = session?.user.id === user.id

  const displayName = user.vrchatUsername || user.name

  usePageHead({
    title: displayName,
    description: user.biography || `User profile for ${displayName} on UmaKeiba.`,
    image: user.image || undefined,
    type: 'profile',
  })

  // Race records pagination state
  const [records, setRecords] = useState<eventmanager.UserRaceRecordView[]>([])
  const [recordsTotal, setRecordsTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [loadingRecords, setLoadingRecords] = useState(true)

  useEffect(() => {
    let active = true
    async function loadUserStats() {
      try {
        setLoadingStats(true)
        setStats(null)
        const lb = await getLeaderboard({ Search: user.slug || user.name })
        const match = lb.entries.find((e) => e.userId === user.id || (user.slug && e.slug === user.slug))
        if (active && match) {
          setStats(match)
        }
      } catch {
        // ignore
      } finally {
        if (active) {
          setLoadingStats(false)
        }
      }
    }
    void loadUserStats()
    return () => {
      active = false
    }
  }, [user.id, user.slug, user.name])

  useEffect(() => {
    let active = true
    async function loadRaceRecords() {
      try {
        setLoadingRecords(true)
        const offset = (page - 1) * pageSize
        const res = await getUserRaceRecords(user.id, pageSize, offset)
        if (active) {
          setRecords(res.records)
          setRecordsTotal(res.total)
        }
      } catch {
        if (active) {
          setRecords([])
          setRecordsTotal(0)
        }
      } finally {
        if (active) {
          setLoadingRecords(false)
        }
      }
    }
    void loadRaceRecords()
    return () => {
      active = false
    }
  }, [user.id, page, pageSize])

  return (
    <PixelContainer maxWidth="full" padding="none" className="max-w-6xl mx-auto">
      {/* Header Banner & Profile Card (Hugging Face Mobile Style) */}
      <PixelCard className="bg-retro-surface mb-6 sm:mb-8 border-2 border-retro-border-strong">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 sm:gap-5 min-w-0">
            <img
              src={user.image || '/fallback_avatar.jpg'}
              alt={displayName}
              onError={(e) => {
                e.currentTarget.src = '/fallback_avatar.jpg'
              }}
              className="w-14 h-14 sm:w-20 sm:h-20 rounded-full border-4 border-retro-border bg-retro-bg object-cover shadow-md shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <h1 className="text-lg sm:text-2xl font-pixel text-retro-text tracking-wide font-bold truncate max-w-full">
                  {displayName}
                </h1>
                {user.classTier && user.classTier !== 'PRE_OP' && user.classTier !== 'OP' ? (
                  <PixelBadge tone="purple">{user.classTier}</PixelBadge>
                ) : (
                  <PixelBadge tone="cyan">OPEN CLASS</PixelBadge>
                )}
                {user.siteRole === 'SITE_ADMIN' && (
                  <PixelBadge tone="pink">SITE ADMIN</PixelBadge>
                )}
              </div>
              {user.slug && (
                <div className="font-sans text-xs sm:text-sm text-retro-muted font-semibold mt-0.5 truncate">
                  @{user.slug}
                </div>
              )}
            </div>
          </div>

          {isSelf && (
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 pt-3 sm:pt-0 border-t sm:border-t-0 border-retro-border w-full sm:w-auto shrink-0">
              {(session?.user.siteRole === 'SITE_ADMIN' || (user.teams && user.teams.length > 0)) && (
                <PixelButton asChild variant="soft" tone="purple" size="sm" className="flex-1 sm:flex-initial justify-center">
                  <Link
                    to="/teams/manage/$id"
                    params={{ id: user.teams && user.teams.length > 0 ? user.teams[0].organizationId : 'org_mock_urs' }}
                  >
                    ORG ADMIN
                  </Link>
                </PixelButton>
              )}
              <PixelButton asChild variant="solid" tone="purple" size="sm" className="flex-1 sm:flex-initial justify-center">
                <Link to="/profile">EDIT PROFILE</Link>
              </PixelButton>
            </div>
          )}
        </div>
      </PixelCard>

      {/* Performance Summary Grid */}
      <PixelSectionHeader
        title="CAREER PERFORMANCE"
        titleTone="gold"
        size="md"
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mt-4 mb-6 sm:mb-8">
        <PixelCard className="bg-retro-surface text-center py-3.5 sm:py-5">
          <div className="font-pixel text-[10px] sm:text-xs text-retro-muted mb-1 flex items-center justify-center gap-1.5">
            <span>RATING</span>
            <span
              className="relative group inline-flex items-center justify-center w-4 h-4 rounded-full border border-retro-border text-[10px] text-retro-muted hover:text-retro-primary hover:border-retro-primary cursor-help"
              tabIndex={0}
              aria-label="We use Glicko-2 to calculate your rankings"
              title="We use Glicko-2 to calculate your rankings"
            >
              ?
              <span className="pointer-events-none opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity absolute left-0 sm:left-1/2 sm:-translate-x-1/2 top-full mt-2 z-20 w-52 p-2 rounded border-2 border-retro-border-strong bg-retro-bg text-retro-text font-sans text-xs font-normal text-left shadow-lg">
                We use Glicko-2 to calculate your rankings.
              </span>
            </span>
          </div>
          {loadingStats ? (
            <div className="animate-pulse space-y-1.5 py-1">
              <div className="h-7 bg-retro-bg rounded w-16 mx-auto" />
              <div className="h-3 bg-retro-bg rounded w-20 mx-auto" />
            </div>
          ) : (
            <>
              <div className="font-pixel text-2xl sm:text-3xl text-retro-primary font-bold">
                {stats ? stats.rating : 1500}
              </div>
              <div className="font-mono text-[11px] sm:text-xs text-retro-muted mt-1">
                ±{stats ? stats.ratingDeviation : 350} RD
                {stats && stats.peakRating > 0 && (
                  <span className="ml-2 text-retro-gold">PEAK {stats.peakRating}</span>
                )}
              </div>
            </>
          )}
        </PixelCard>

        <PixelCard className="bg-retro-surface text-center py-3.5 sm:py-5">
          <div className="font-pixel text-[10px] sm:text-xs text-retro-muted mb-1">TOTAL POINTS</div>
          {loadingStats ? (
            <div className="animate-pulse py-1">
              <div className="h-7 bg-retro-bg rounded w-14 mx-auto" />
            </div>
          ) : (
            <div className="font-pixel text-2xl sm:text-3xl text-retro-gold font-bold">
              {stats ? stats.totalPoints.toLocaleString() : '0'}
            </div>
          )}
        </PixelCard>

        <PixelCard className="bg-retro-surface text-center py-3.5 sm:py-5">
          <div className="font-pixel text-[10px] sm:text-xs text-retro-muted mb-1">AVG POSITION</div>
          {loadingStats ? (
            <div className="animate-pulse py-1">
              <div className="h-7 bg-retro-bg rounded w-12 mx-auto" />
            </div>
          ) : (
            <div className="font-mono text-2xl sm:text-3xl text-retro-text font-bold">
              {stats && stats.averagePosition > 0 ? stats.averagePosition.toFixed(1) : '—'}
            </div>
          )}
        </PixelCard>

        <PixelCard className="bg-retro-surface text-center py-3.5 sm:py-5">
          <div className="font-pixel text-[10px] sm:text-xs text-retro-muted mb-1">AVG PTS / SEASON</div>
          {loadingStats ? (
            <div className="animate-pulse py-1">
              <div className="h-7 bg-retro-bg rounded w-14 mx-auto" />
            </div>
          ) : (
            <div className="font-mono text-2xl sm:text-3xl text-retro-text font-bold">
              {stats ? stats.averagePointsPerSeason.toFixed(1) : '0.0'}
            </div>
          )}
        </PixelCard>

        <PixelCard className="bg-retro-surface text-center py-3.5 sm:py-5 col-span-2 sm:col-span-1">
          <div className="font-pixel text-[10px] sm:text-xs text-retro-muted mb-1">VICTORIES</div>
          {loadingStats ? (
            <div className="animate-pulse py-1">
              <div className="h-7 bg-retro-bg rounded w-10 mx-auto" />
            </div>
          ) : (
            <div className="font-pixel text-2xl sm:text-3xl text-retro-green font-bold">
              {stats ? stats.wins : 0}
            </div>
          )}
        </PixelCard>
      </div>

      {/* Details & Teams */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Biography & Career Records */}
        <div className="lg:col-span-2 space-y-6 min-w-0">
          <PixelCard className="bg-retro-surface">
            <h3 className="font-pixel text-sm text-retro-primary mb-3">BIOGRAPHY</h3>
            <div className="font-sans text-sm text-retro-text leading-relaxed break-words">
              <MarkdownView
                content={user.biography}
                fallbackText="No biography details provided yet."
              />
            </div>
          </PixelCard>

          <PixelCard className="bg-retro-surface">
            <h3 className="font-pixel text-sm text-retro-primary mb-3">CAREER OVERVIEW</h3>

            {loadingRecords ? (
              <PixelSkeletonTable rows={4} />
            ) : records.length > 0 ? (
              <>
                <div className="overflow-x-auto border-2 border-retro-border rounded bg-retro-bg">
                  <table className="w-full text-left font-sans text-sm border-collapse">
                    <thead>
                      <tr className="border-b-2 border-retro-border font-pixel text-xs text-retro-muted bg-retro-surface/80">
                        <th className="p-3">EVENT / RACE</th>
                        <th className="p-3">GRADE</th>
                        <th className="p-3 text-center">POS / STATUS</th>
                        <th className="p-3 text-center">FINISH TIME</th>
                        <th className="p-3 text-right">RATING Δ</th>
                        <th className="p-3 text-right">POINTS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-retro-border">
                      {records.map((r) => (
                        <tr key={r.resultId} className="hover:bg-retro-surface/50 transition-colors">
                          <td className="p-3">
                            <Link
                              to="/events/$eventId"
                              params={{ eventId: r.eventId }}
                              className="font-pixel text-xs text-retro-primary hover:underline font-bold block"
                            >
                              {r.eventName}
                            </Link>
                            <span className="text-xs text-retro-muted font-sans block">
                              Race #{r.raceSequence}: {r.raceName}
                            </span>
                          </td>
                          <td className="p-3">
                            {r.raceGrade ? (
                              <PixelBadge tone="purple">{r.raceGrade}</PixelBadge>
                            ) : (
                              <span className="text-xs text-retro-muted">—</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {r.resultStatus ? (
                              <PixelBadge tone="pink">{r.resultStatus}</PixelBadge>
                            ) : r.position !== null ? (
                              <span className="font-pixel text-sm font-bold text-retro-text">
                                #{r.position}
                              </span>
                            ) : (
                              <span className="text-xs text-retro-muted">—</span>
                            )}
                          </td>
                          <td className="p-3 text-center font-mono text-xs">
                            {r.finishTime || '—'}
                          </td>
                          <td className="p-3 text-right font-mono text-xs whitespace-nowrap">
                            {r.ratingAfter != null ? (
                              <span>
                                <span className="text-retro-text font-semibold">{r.ratingAfter}</span>
                                {r.ratingDelta != null && r.ratingDelta !== 0 && (
                                  <span
                                    className={
                                      r.ratingDelta > 0
                                        ? 'ml-1 text-retro-green font-bold'
                                        : 'ml-1 text-retro-pink font-bold'
                                    }
                                  >
                                    ({r.ratingDelta > 0 ? `+${r.ratingDelta}` : r.ratingDelta})
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="text-retro-muted">—</span>
                            )}
                          </td>
                          <td className="p-3 text-right font-pixel text-sm font-bold text-retro-gold">
                            {r.points}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <Pagination
                  page={page}
                  pageSize={pageSize}
                  total={recordsTotal}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                  variant="pixel"
                />
              </>
            ) : (
              <p className="font-sans text-xs text-retro-muted">
                No career race records registered yet.
              </p>
            )}
          </PixelCard>
        </div>

        {/* Right Column: Affiliated Teams */}
        <div>
          <PixelCard className="bg-retro-surface">
            <h3 className="font-pixel text-sm text-retro-primary mb-4">AFFILIATED TEAMS</h3>
            {user.teams && user.teams.length > 0 ? (
              <PixelStack gap={3}>
                {user.teams.map((t) => (
                  <Link
                    key={t.organizationId}
                    to="/$user"
                    params={{ user: t.slug }}
                    className="block p-3 border-2 border-retro-border rounded hover:border-retro-primary transition-colors bg-retro-bg"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {t.logo ? (
                          <img
                            src={t.logo}
                            alt={t.name}
                            className="w-10 h-10 rounded border border-retro-border bg-retro-bg object-cover shadow-sm shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded border border-retro-border bg-retro-primary/20 text-retro-primary font-pixel text-xs font-bold flex items-center justify-center shrink-0">
                            {t.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-pixel text-sm text-retro-text font-bold truncate">
                            {t.name}
                          </div>
                          <div className="font-sans text-xs text-retro-muted truncate">
                            @{t.slug}
                          </div>
                        </div>
                      </div>
                      <PixelBadge tone={t.role === 'ADMINISTRATOR' ? 'purple' : 'neutral'}>
                        {t.role}
                      </PixelBadge>
                    </div>
                  </Link>
                ))}
              </PixelStack>
            ) : (
              <p className="font-sans text-xs text-retro-muted">
                No active team affiliations.
              </p>
            )}
          </PixelCard>
        </div>
      </div>
    </PixelContainer>
  )
}
