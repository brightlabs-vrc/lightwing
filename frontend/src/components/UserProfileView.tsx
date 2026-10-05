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
import type { auth } from '../lib/client'
import { getLeaderboard, LeaderboardEntry } from '../lib/public-api'

interface UserProfileViewProps {
  user: auth.UserProfile
}

export const UserProfileView: React.FC<UserProfileViewProps> = ({ user }) => {
  const [stats, setStats] = useState<LeaderboardEntry | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)

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

  const displayName = user.vrchatUsername || user.name

  return (
    <PixelContainer maxWidth="full" padding="md">
      {/* Header Banner & Profile Card */}
      <PixelCard className="bg-retro-surface mb-8 border-2 border-retro-border-strong">
        <PixelStack direction="row" gap={6} align="center" wrap justify="between">
          <PixelStack direction="row" gap={5} align="center" wrap>
            <img
              src={user.image || `https://avatar.vercel.sh/${user.id}`}
              alt={displayName}
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
              {user.email && (
                <div className="font-sans text-xs text-retro-muted opacity-80">
                  {user.email}
                </div>
              )}
            </PixelStack>
          </PixelStack>

          <PixelButton asChild variant="soft" tone="neutral" size="sm">
            <Link to="/leaderboard">BACK TO LEADERBOARD</Link>
          </PixelButton>
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
        {/* Left Column: Biography & Career */}
        <div className="lg:col-span-2 space-y-6">
          <PixelCard className="bg-retro-surface">
            <h3 className="font-pixel text-sm text-retro-primary mb-3">BIOGRAPHY</h3>
            <p className="font-sans text-sm text-retro-muted leading-relaxed">
              {user.biography || 'No biography details provided yet.'}
            </p>
          </PixelCard>

          <PixelCard className="bg-retro-surface">
            <h3 className="font-pixel text-sm text-retro-primary mb-3">CAREER OVERVIEW</h3>
            <p className="font-sans text-sm text-retro-muted leading-relaxed">
              {user.careerOverview || 'No career overview recorded yet.'}
            </p>
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
                      <div>
                        <div className="font-pixel text-sm text-retro-text font-bold">
                          {t.name}
                        </div>
                        <div className="font-sans text-xs text-retro-muted">
                          @{t.slug}
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
