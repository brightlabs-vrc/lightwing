import React, { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  PixelContainer,
  PixelStack,
  PixelCard,
  PixelBadge,
  PixelSectionHeader,
  PixelSpinner,
  PixelButton,
} from '@pxlkit/ui-kit'
import type { auth, eventmanager } from '../lib/client'
import { getLeaderboard, getUserRaceRecords, LeaderboardEntry } from '../lib/public-api'
import { useAuth } from '../hooks/useAuth'
import { Pagination } from './Pagination'

interface UserProfileViewProps {
  user: auth.UserProfile
}

export const UserProfileView: React.FC<UserProfileViewProps> = ({ user }) => {
  const { session } = useAuth()
  const [stats, setStats] = useState<LeaderboardEntry | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)
  const isSelf = session?.user.id === user.id

  // Race records pagination state
  const [records, setRecords] = useState<eventmanager.UserRaceRecordView[]>([])
  const [recordsTotal, setRecordsTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [loadingRecords, setLoadingRecords] = useState(true)

  useEffect(() => {
    async function loadUserStats() {
      try {
        setLoadingStats(true)
        const lb = await getLeaderboard({ Search: user.slug || user.name })
        const match = lb.entries.find((e) => e.userId === user.id || (user.slug && e.slug === user.slug))
        if (match) {
          setStats(match)
        }
      } catch {
        // ignore
      } finally {
        setLoadingStats(false)
      }
    }
    void loadUserStats()
  }, [user])

  useEffect(() => {
    async function loadRaceRecords() {
      try {
        setLoadingRecords(true)
        const offset = (page - 1) * pageSize
        const res = await getUserRaceRecords(user.id, pageSize, offset)
        setRecords(res.records)
        setRecordsTotal(res.total)
      } catch {
        setRecords([])
        setRecordsTotal(0)
      } finally {
        setLoadingRecords(false)
      }
    }
    void loadRaceRecords()
  }, [user.id, page, pageSize])

  const displayName = user.vrchatUsername || user.name

  return (
    <PixelContainer maxWidth="full" padding="md">
      {/* Header Banner & Profile Card */}
      <PixelCard className="bg-retro-surface mb-8 border-2 border-retro-border-strong">
        <PixelStack direction="row" gap={5} align="center" wrap justify="between">
          <PixelStack direction="row" gap={5} align="center" wrap>
            <img
              src={user.image || '/fallback_avatar.jpg'}
              alt={displayName}
              onError={(e) => {
                e.currentTarget.src = '/fallback_avatar.jpg'
              }}
              className="w-20 h-20 rounded-full border-4 border-retro-border bg-retro-bg object-cover shadow-md"
            />
            <PixelStack gap={1}>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-pixel text-retro-text tracking-wide font-bold">
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
                <div className="font-sans text-sm text-retro-muted font-semibold">
                  @{user.slug}
                </div>
              )}
            </PixelStack>
          </PixelStack>

          {isSelf && (
            <PixelStack direction="row" gap={2}>
              {(session?.user.siteRole === 'SITE_ADMIN' || (user.teams && user.teams.length > 0)) && (
                <PixelButton asChild variant="soft" tone="purple" size="sm">
                  <Link
                    to="/teams/manage/$id"
                    params={{ id: user.teams && user.teams.length > 0 ? user.teams[0].organizationId : 'org_mock_urs' }}
                  >
                    ORG ADMIN
                  </Link>
                </PixelButton>
              )}
              <PixelButton asChild variant="solid" tone="purple" size="sm">
                <Link to="/profile">EDIT PROFILE</Link>
              </PixelButton>
            </PixelStack>
          )}
        </PixelStack>
      </PixelCard>

      {/* Performance Summary Grid */}
      <PixelSectionHeader
        title="CAREER PERFORMANCE"
        titleTone="gold"
        size="md"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 mb-8">
        <PixelCard className="bg-retro-surface text-center py-5">
          <div className="font-pixel text-xs text-retro-muted mb-1">TOTAL POINTS</div>
          <div className="font-pixel text-3xl text-retro-gold font-bold">
            {stats ? stats.totalPoints.toLocaleString() : '0'}
          </div>
        </PixelCard>

        <PixelCard className="bg-retro-surface text-center py-5">
          <div className="font-pixel text-xs text-retro-muted mb-1">AVG POSITION</div>
          <div className="font-mono text-3xl text-retro-text font-bold">
            {stats && stats.averagePosition > 0 ? stats.averagePosition.toFixed(1) : '—'}
          </div>
        </PixelCard>

        <PixelCard className="bg-retro-surface text-center py-5">
          <div className="font-pixel text-xs text-retro-muted mb-1">AVG PTS / SEASON</div>
          <div className="font-mono text-3xl text-retro-text font-bold">
            {stats ? stats.averagePointsPerSeason.toFixed(1) : '0.0'}
          </div>
        </PixelCard>

        <PixelCard className="bg-retro-surface text-center py-5">
          <div className="font-pixel text-xs text-retro-muted mb-1">VICTORIES</div>
          <div className="font-pixel text-3xl text-retro-green font-bold">
            {stats ? stats.wins : 0}
          </div>
        </PixelCard>
      </div>

      {/* Details & Teams */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Biography & Career Records */}
        <div className="lg:col-span-2 space-y-6">
          <PixelCard className="bg-retro-surface">
            <h3 className="font-pixel text-sm text-retro-primary mb-3">BIOGRAPHY</h3>
            <p className="font-sans text-sm text-retro-muted leading-relaxed">
              {user.biography || 'No biography details provided yet.'}
            </p>
          </PixelCard>

          <PixelCard className="bg-retro-surface">
            <h3 className="font-pixel text-sm text-retro-primary mb-3">CAREER OVERVIEW</h3>

            {loadingRecords ? (
              <div className="flex justify-center items-center py-8">
                <PixelSpinner size="md" />
              </div>
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
                    <PixelStack direction="row" justify="between" align="center">
                      <div className="flex items-center gap-3">
                        {t.logo ? (
                          <img
                            src={t.logo}
                            alt={t.name}
                            className="w-10 h-10 rounded border border-retro-border bg-retro-bg object-cover shadow-sm flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded border border-retro-border bg-retro-primary/20 text-retro-primary font-pixel text-xs font-bold flex items-center justify-center flex-shrink-0">
                            {t.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="font-pixel text-sm text-retro-text font-bold">
                            {t.name}
                          </div>
                          <div className="font-sans text-xs text-retro-muted">
                            @{t.slug}
                          </div>
                        </div>
                      </div>
                      <PixelBadge tone={t.role === 'ADMINISTRATOR' ? 'purple' : 'neutral'}>
                        {t.role}
                      </PixelBadge>
                    </PixelStack>
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
