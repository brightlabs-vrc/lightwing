import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  PixelBadge,
  PixelButton,
  PixelCard,
  PixelContainer,
  PixelEmptyState,
  PixelStack,
} from '@pxlkit/ui-kit'
import {
  getLeaderboard,
  listPublicEvents,
  listPublicNewsletters,
} from '../lib/public-api'
import type { eventmanager } from '../lib/client'
import { formatLocalDateTime } from '../lib/datetime'
import { usePageHead } from '../hooks/usePageHead'
import { buildSeoMeta } from '../lib/seo'
import { EventBanner } from '../components/EventBanner'
import { PixelSkeletonInlineRows } from '../components/LoadingSkeleton'

export const Route = createFileRoute('/')({
  ssr: 'data-only',
  head: () => ({
    meta: buildSeoMeta({
      title: 'Home',
      description: 'UmaKeiba — Competitive VR Racing events, seasonal standings, and community dispatches.',
    }),
  }),
  component: HomePage,
})

function getCurrentSeasonLabel(): string {
  const now = new Date()
  const month = now.getMonth()
  const year = now.getFullYear()
  const season =
    month >= 2 && month <= 4
      ? 'Spring'
      : month >= 5 && month <= 7
        ? 'Summer'
        : month >= 8 && month <= 10
          ? 'Autumn'
          : 'Winter'
  return `${season} ${year}`
}

function formatClassBadge(classRestriction?: string | null): string | null {
  if (!classRestriction) return null
  if (classRestriction === 'PRE_OP') return 'Pre-OP'
  if (classRestriction === 'OP') return 'OP'
  return classRestriction
}

function selectFeaturedEvents(
  events: eventmanager.EventListItem[],
): eventmanager.EventListItem[] {
  const active = events.filter((e) => e.status === 'ONGOING' || e.status === 'PENDING')
  return [...active]
    .sort((a, b) => {
      // 1. ONGOING before PENDING
      if (a.status !== b.status) {
        return a.status === 'ONGOING' ? -1 : 1
      }
      // 2. OFFICIAL before COMMUNITY
      const aOfficial = a.tag === 'OFFICIAL' ? 1 : 0
      const bOfficial = b.tag === 'OFFICIAL' ? 1 : 0
      if (aOfficial !== bOfficial) return bOfficial - aOfficial
      // 3. Events with bannerUrl first
      const aHasBanner = a.bannerUrl ? 1 : 0
      const bHasBanner = b.bannerUrl ? 1 : 0
      if (aHasBanner !== bHasBanner) return bHasBanner - aHasBanner
      // 4. Soonest scheduledAt first, else newest createdAt
      if (a.scheduledAt && b.scheduledAt) {
        return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
    .slice(0, 5)
}

const NEWS_PAGE_SIZE = 5

function HomePage() {
  usePageHead({
    title: 'Home',
    description: 'UmaKeiba — Competitive VR Racing events, seasonal standings, and community dispatches.',
  })

  const seasonLabel = useMemo(() => getCurrentSeasonLabel(), [])
  const currentYear = new Date().getUTCFullYear()

  const [slideIndex, setSlideIndex] = useState(0)
  const [carouselPaused, setCarouselPaused] = useState(false)
  const [newsPage, setNewsPage] = useState(1)
  const [lbSort, setLbSort] = useState<'rating' | 'points'>('rating')

  const { data: eventsData, isLoading: loadingEvents } = useQuery({
    queryKey: ['home-public-events'],
    queryFn: () => listPublicEvents(100, 0),
  })

  const { data: newslettersData, isLoading: loadingNewsletters } = useQuery({
    queryKey: ['home-public-newsletters', newsPage],
    queryFn: () =>
      listPublicNewsletters({
        OrganizationID: '',
        Search: '',
        Limit: NEWS_PAGE_SIZE,
        Offset: (newsPage - 1) * NEWS_PAGE_SIZE,
      }),
  })

  const { data: leaderboardData, isLoading: loadingLeaderboard } = useQuery({
    queryKey: ['home-leaderboard', lbSort, currentYear],
    queryFn: () =>
      getLeaderboard({
        SortBy: lbSort,
        Year: currentYear,
        Limit: 5,
        Offset: 0,
      }),
  })

  const visibleEvents = useMemo(
    () =>
      (eventsData?.events ?? []).filter(
        (e) => e.status !== 'DRAFT' && e.status !== 'PENDING_DELETION',
      ),
    [eventsData],
  )

  const featured = useMemo(() => selectFeaturedEvents(visibleEvents), [visibleEvents])
  const ongoingEvents = useMemo(
    () => visibleEvents.filter((e) => e.status === 'ONGOING').slice(0, 3),
    [visibleEvents],
  )
  const upcomingEvents = useMemo(
    () =>
      visibleEvents
        .filter((e) => e.status === 'PENDING')
        .sort((a, b) => {
          if (a.scheduledAt && b.scheduledAt) {
            return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
          }
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        })
        .slice(0, 3),
    [visibleEvents],
  )

  const slideCount = featured.length
  const safeSlideIndex = slideCount > 0 ? slideIndex % slideCount : 0

  useEffect(() => {
    if (slideCount <= 1 || carouselPaused) return
    const timer = setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % slideCount)
    }, 6000)
    return () => clearInterval(timer)
  }, [slideCount, carouselPaused])

  const activeSlide = featured[safeSlideIndex] ?? null

  const newsletters = newslettersData?.newsletters ?? []
  const newslettersTotal = newslettersData?.total ?? 0
  const totalNewsPages = Math.max(1, Math.ceil(newslettersTotal / NEWS_PAGE_SIZE))

  const topRacers = leaderboardData?.entries ?? []

  return (
    <PixelContainer maxWidth="full" padding="none" className="max-w-7xl mx-auto">
      {/* TOP ROW: Featured Event Hero Carousel (left) + Current & Upcoming Events Card (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Featured Event Hero Carousel */}
        <div
          className="lg:col-span-7 xl:col-span-8 flex flex-col"
          onMouseEnter={() => setCarouselPaused(true)}
          onMouseLeave={() => setCarouselPaused(false)}
        >
          <div className="relative w-full min-h-[340px] sm:min-h-[400px] lg:h-full rounded overflow-hidden border-2 border-retro-border-strong bg-retro-surface shadow-md flex flex-col justify-end">
            {loadingEvents ? (
              <div className="absolute inset-0 bg-retro-surface animate-pulse flex items-center justify-center">
                <span className="font-pixel text-xs text-retro-muted">LOADING FEATURED EVENTS...</span>
              </div>
            ) : activeSlide ? (
              <>
                {/* Backdrop image or deterministic generated banner */}
                <div className="absolute inset-0">
                  <EventBanner
                    id={activeSlide.id}
                    name={activeSlide.name}
                    bannerUrl={activeSlide.bannerUrl}
                    classRestriction={activeSlide.classRestriction}
                    tag={activeSlide.tag}
                    ownerName={activeSlide.ownerName}
                    ownerLogo={activeSlide.ownerLogo}
                    variant="hero"
                  />
                  {/* Scrim gradient for readable typography */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/15" />
                </div>

                {/* Top badges */}
                <div className="relative z-10 p-5 sm:p-6 pb-0 flex items-center justify-between gap-2 flex-wrap mb-auto">
                  <div className="flex items-center gap-2 flex-wrap">
                    <PixelBadge
                      tone={
                        activeSlide.status === 'ONGOING'
                          ? 'green'
                          : activeSlide.status === 'PENDING'
                            ? 'cyan'
                            : 'pink'
                      }
                    >
                      {activeSlide.status === 'ONGOING'
                        ? 'LIVE NOW'
                        : activeSlide.status === 'PENDING'
                          ? 'UPCOMING'
                          : 'RECENT EVENT'}
                    </PixelBadge>
                    <PixelBadge tone={activeSlide.tag === 'OFFICIAL' ? 'purple' : 'cyan'}>
                      {activeSlide.tag || 'COMMUNITY'}
                    </PixelBadge>
                    {formatClassBadge(activeSlide.classRestriction) && (
                      <PixelBadge tone="gold">
                        {formatClassBadge(activeSlide.classRestriction)}
                      </PixelBadge>
                    )}
                  </div>

                  {slideCount > 1 && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        aria-label="Previous featured event"
                        onClick={() =>
                          setSlideIndex((prev) => (prev - 1 + slideCount) % slideCount)
                        }
                        className="w-8 h-8 rounded bg-black/60 hover:bg-black/80 border border-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <i className="hn hn-angle-left text-sm" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label="Next featured event"
                        onClick={() => setSlideIndex((prev) => (prev + 1) % slideCount)}
                        className="w-8 h-8 rounded bg-black/60 hover:bg-black/80 border border-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <i className="hn hn-angle-right text-sm" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Bottom content overlay */}
                <div className="relative z-10 p-5 sm:p-6 pt-12 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                  <div className="min-w-0 max-w-xl">
                    {activeSlide.ownerName && (
                      <div className="font-pixel text-[11px] text-emerald-300 tracking-wider uppercase mb-1">
                        {activeSlide.ownerName}
                        {activeSlide.scheduledAt
                          ? ` • ${formatLocalDateTime(activeSlide.scheduledAt)}`
                          : ''}
                      </div>
                    )}
                    <h1 className="font-pixel text-2xl sm:text-3xl font-bold text-white tracking-wide leading-tight drop-shadow">
                      {activeSlide.name}
                    </h1>
                    {activeSlide.description && (
                      <p className="font-sans text-sm text-gray-200 mt-2 line-clamp-2 leading-relaxed">
                        {activeSlide.description}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 flex flex-col items-start sm:items-end gap-3">
                    <PixelButton asChild variant="solid" tone="green" size="md">
                      <Link to="/events/$eventId" params={{ eventId: activeSlide.id }}>
                        VIEW EVENT DETAILS
                      </Link>
                    </PixelButton>
                  </div>
                </div>

                {/* Slide indicators */}
                {slideCount > 1 && (
                  <div className="relative z-10 px-6 pb-4 flex items-center gap-2">
                    {featured.map((slide, idx) => (
                      <button
                        key={slide.id}
                        type="button"
                        aria-label={`Go to slide ${idx + 1}: ${slide.name}`}
                        onClick={() => setSlideIndex(idx)}
                        className={`h-2 rounded-full transition-all cursor-pointer ${
                          idx === safeSlideIndex
                            ? 'w-7 bg-emerald-400'
                            : 'w-2 bg-white/40 hover:bg-white/70'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </>
            ) : (
              /* Off-Season Fallback Banner */
              <>
                <div className="absolute inset-0">
                  <EventBanner
                    id="umakeiba-off-season"
                    name="Off-Season"
                    classRestriction="G3"
                    tag="OFFICIAL"
                    variant="hero"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/20" />
                </div>

                <div className="relative z-10 p-6 sm:p-8 flex flex-col justify-between h-full gap-6">
                  <div>
                    <PixelBadge tone="neutral">OFF-SEASON</PixelBadge>
                  </div>
                  <div className="max-w-xl">
                    <h1 className="font-pixel text-2xl sm:text-4xl font-bold text-white tracking-wide leading-tight">
                      OFF-SEASON
                    </h1>
                    <p className="font-sans text-sm sm:text-base text-gray-200 mt-3 leading-relaxed">
                      Nothing is happening on the track right now. Check out past events and
                      results while we gear up for the next circuit.
                    </p>
                    <div className="flex items-center gap-3 flex-wrap mt-5">
                      <PixelButton asChild variant="solid" tone="green" size="md">
                        <Link to="/events">CHECK PAST EVENTS</Link>
                      </PixelButton>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Current & Upcoming Events Sidebar Card */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col">
          <PixelCard className="h-full bg-retro-surface border-2 border-retro-border-strong flex flex-col justify-between">
            <div className="space-y-5">
              {/* Current Events Section */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div>
                    <div className="font-sans text-[11px] text-retro-muted uppercase tracking-wider">
                      {seasonLabel}
                    </div>
                    <h2 className="font-pixel text-sm font-bold text-retro-text">
                      CURRENT EVENTS
                    </h2>
                  </div>
                  <Link
                    to="/events"
                    className="font-pixel text-[10px] text-retro-primary hover:underline"
                  >
                    VIEW ALL →
                  </Link>
                </div>

                {loadingEvents ? (
                  <PixelSkeletonInlineRows rows={3} />
                ) : ongoingEvents.length === 0 ? (
                  <div className="py-2.5 px-3 rounded bg-retro-bg/60 border border-retro-border text-xs font-sans text-retro-muted">
                    No live events right now.
                  </div>
                ) : (
                  <div className="divide-y divide-retro-border border-t border-retro-border">
                    {ongoingEvents.map((evt) => {
                      const classLabel = formatClassBadge(evt.classRestriction)
                      return (
                        <Link
                          key={evt.id}
                          to="/events/$eventId"
                          params={{ eventId: evt.id }}
                          className="flex items-start justify-between gap-3 py-2.5 hover:bg-retro-bg/60 -mx-2 px-2 rounded transition-colors group"
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            <i className="hn hn-star-solid text-sm text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                            <div className="min-w-0">
                              <div className="font-sans text-sm font-semibold text-retro-text group-hover:text-retro-primary transition-colors truncate">
                                {evt.name}
                              </div>
                              <div className="font-sans text-xs text-retro-muted line-clamp-1">
                                {evt.description || evt.ownerName || 'Live competitive event'}
                              </div>
                            </div>
                          </div>
                          {classLabel && (
                            <span className="shrink-0 font-pixel text-[10px] text-retro-gold border border-retro-border px-1.5 py-0.5 rounded bg-retro-bg">
                              ↑ {classLabel}
                            </span>
                          )}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="border-t-2 border-retro-border" />

              {/* Upcoming Events Section */}
              <div>
                <div className="mb-3">
                  <div className="font-sans text-[11px] text-retro-muted uppercase tracking-wider">
                    {seasonLabel}
                  </div>
                  <h2 className="font-pixel text-sm font-bold text-retro-text">
                    UPCOMING EVENTS
                  </h2>
                </div>

                {loadingEvents ? (
                  <PixelSkeletonInlineRows rows={3} />
                ) : upcomingEvents.length === 0 ? (
                  <div className="py-3 px-3 rounded bg-retro-bg/60 border border-retro-border text-xs font-sans text-retro-muted flex flex-col gap-2">
                    <span>No upcoming events scheduled yet.</span>
                    {ongoingEvents.length === 0 && (
                      <Link
                        to="/events"
                        className="font-pixel text-[10px] text-retro-primary hover:underline"
                      >
                        BROWSE PAST EVENTS →
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-retro-border border-t border-retro-border">
                    {upcomingEvents.map((evt) => {
                      const classLabel = formatClassBadge(evt.classRestriction)
                      return (
                        <Link
                          key={evt.id}
                          to="/events/$eventId"
                          params={{ eventId: evt.id }}
                          className="flex items-start justify-between gap-3 py-2.5 hover:bg-retro-bg/60 -mx-2 px-2 rounded transition-colors group"
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            <i className="hn hn-sparkles-solid text-sm text-retro-secondary shrink-0 mt-0.5" aria-hidden="true" />
                            <div className="min-w-0">
                              <div className="font-sans text-sm font-semibold text-retro-text group-hover:text-retro-primary transition-colors truncate">
                                {evt.name}
                              </div>
                              <div className="font-sans text-xs text-retro-muted line-clamp-1">
                                {evt.scheduledAt
                                  ? formatLocalDateTime(evt.scheduledAt)
                                  : evt.description || evt.ownerName || 'Signups open soon'}
                              </div>
                            </div>
                          </div>
                          {classLabel && (
                            <span className="shrink-0 font-pixel text-[10px] text-retro-secondary border border-retro-border px-1.5 py-0.5 rounded bg-retro-bg">
                              ↑ {classLabel}
                            </span>
                          )}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </PixelCard>
        </div>
      </div>

      {/* BOTTOM ROW: Latest Newsletters Card (left) + Top Racers Preview Card (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6 items-stretch">
        {/* Latest Newsletters Card */}
        <div className="lg:col-span-7 flex flex-col">
          <PixelCard className="h-full bg-retro-surface border-2 border-retro-border-strong flex flex-col justify-between">
            <div>
              <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap pb-3 border-b-2 border-retro-border">
                <div>
                  <div className="font-sans text-[11px] text-retro-muted uppercase tracking-wider">
                    Powered by Community Organizations
                  </div>
                  <h2 className="font-pixel text-base font-bold text-retro-text flex items-center gap-2 mt-0.5">
                    <i className="hn hn-newspaper-solid text-sm text-retro-primary" aria-hidden="true" />
                    LATEST NEWS
                  </h2>
                </div>
                <PixelButton asChild variant="soft" tone="purple" size="sm">
                  <Link to="/newsletters">SHOW ALL NEWSLETTERS →</Link>
                </PixelButton>
              </div>

              {loadingNewsletters ? (
                <PixelSkeletonInlineRows rows={5} />
              ) : newsletters.length === 0 ? (
                <div className="py-6">
                  <PixelEmptyState
                    title="No Newsletters Yet"
                    description="Organizations have not published any community dispatches yet."
                  />
                </div>
              ) : (
                <div className="divide-y divide-retro-border">
                  {newsletters.map((nl) => (
                    <Link
                      key={nl.id}
                      to="/newsletters/$newsletterId"
                      params={{ newsletterId: nl.id }}
                      className="flex flex-col sm:flex-row sm:items-start justify-between gap-1.5 sm:gap-3 py-3.5 hover:bg-retro-bg/60 -mx-2 px-2 rounded transition-colors group"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <i className="hn hn-star-solid text-sm text-retro-primary shrink-0 mt-1" aria-hidden="true" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-sans text-sm font-semibold text-retro-text group-hover:text-retro-primary transition-colors">
                              {nl.title}
                            </span>
                            <PixelBadge tone="cyan">{nl.organizationName}</PixelBadge>
                          </div>
                          {nl.summary && (
                            <p className="font-sans text-xs text-retro-muted mt-1 line-clamp-1">
                              {nl.summary}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="shrink-0 font-sans text-[11px] text-retro-muted whitespace-nowrap pl-7 sm:pl-0 sm:mt-0.5">
                        {formatLocalDateTime(nl.publishedAt || nl.createdAt)}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Inline Newsletter Pagination */}
            {totalNewsPages > 1 && (
              <div className="pt-4 mt-4 border-t border-retro-border flex items-center justify-between gap-2 flex-wrap">
                <PixelButton
                  variant="ghost"
                  tone="neutral"
                  size="sm"
                  disabled={newsPage <= 1}
                  onClick={() => setNewsPage((p) => Math.max(1, p - 1))}
                >
                  ← PREV
                </PixelButton>
                <span className="font-pixel text-[11px] text-retro-muted">
                  PAGE {newsPage} OF {totalNewsPages}
                </span>
                <PixelButton
                  variant="ghost"
                  tone="neutral"
                  size="sm"
                  disabled={newsPage >= totalNewsPages}
                  onClick={() => setNewsPage((p) => Math.min(totalNewsPages, p + 1))}
                >
                  NEXT →
                </PixelButton>
              </div>
            )}
          </PixelCard>
        </div>

        {/* Top Racers / Season Leaderboard Preview Card */}
        <div className="lg:col-span-5 flex flex-col">
          <PixelCard className="h-full bg-retro-surface border-2 border-retro-border-strong flex flex-col justify-between">
            <div>
              <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap pb-3 border-b-2 border-retro-border">
                <div>
                  <div className="font-sans text-[11px] text-retro-muted uppercase tracking-wider">
                    {currentYear} Season Standings
                  </div>
                  <h2 className="font-pixel text-base font-bold text-retro-text flex items-center gap-2 mt-0.5">
                    <i className="hn hn-trophy-solid text-sm text-retro-gold" aria-hidden="true" />
                    TOP RACERS
                  </h2>
                </div>

                <PixelStack direction="row" gap={1} align="center">
                  <PixelButton
                    variant={lbSort === 'rating' ? 'solid' : 'ghost'}
                    tone={lbSort === 'rating' ? 'gold' : 'neutral'}
                    size="sm"
                    onClick={() => setLbSort('rating')}
                  >
                    RATING
                  </PixelButton>
                  <PixelButton
                    variant={lbSort === 'points' ? 'solid' : 'ghost'}
                    tone={lbSort === 'points' ? 'gold' : 'neutral'}
                    size="sm"
                    onClick={() => setLbSort('points')}
                  >
                    POINTS
                  </PixelButton>
                </PixelStack>
              </div>

              {loadingLeaderboard ? (
                <PixelSkeletonInlineRows rows={5} />
              ) : topRacers.length === 0 ? (
                <div className="py-6">
                  <PixelEmptyState
                    title="No Standings Yet"
                    description="Race results for this season will appear here once recorded."
                  />
                </div>
              ) : (
                <div className="divide-y divide-retro-border">
                  {topRacers.map((racer, idx) => {
                    const rank = racer.rank || idx + 1
                    const rankTone =
                      rank === 1
                        ? 'gold'
                        : rank === 2
                          ? 'cyan'
                          : rank === 3
                            ? 'purple'
                            : 'neutral'
                    const classLabel =
                      racer.classTier && racer.classTier !== 'PRE_OP' && racer.classTier !== 'OP'
                        ? racer.classTier
                        : 'OPEN'

                    return (
                      <Link
                        key={racer.userId}
                        to="/$user"
                        params={{ user: racer.slug || racer.userId }}
                        className="flex items-center justify-between gap-3 py-3 hover:bg-retro-bg/60 -mx-2 px-2 rounded transition-colors group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <PixelBadge tone={rankTone}>#{rank}</PixelBadge>
                          <img
                            src={racer.image || '/fallback_avatar.jpg'}
                            alt={racer.name}
                            onError={(e) => {
                              e.currentTarget.src = '/fallback_avatar.jpg'
                            }}
                            className="w-8 h-8 rounded-full object-cover border border-retro-border shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="font-sans text-sm font-semibold text-retro-text group-hover:text-retro-primary transition-colors truncate">
                              {racer.name}
                            </div>
                            <div className="font-pixel text-[10px] text-retro-muted">
                              {classLabel} • {racer.wins} {racer.wins === 1 ? 'WIN' : 'WINS'}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="font-pixel text-sm font-bold text-retro-gold">
                            {lbSort === 'rating'
                              ? Math.round(racer.rating)
                              : `${racer.totalPoints} PTS`}
                          </div>
                          <div className="font-sans text-[10px] text-retro-muted">
                            {lbSort === 'rating'
                              ? `${racer.totalPoints} pts`
                              : `Rating ${Math.round(racer.rating)}`}
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="pt-4 mt-4 border-t border-retro-border flex justify-end">
              <PixelButton asChild variant="soft" tone="gold" size="sm">
                <Link to="/leaderboard">VIEW FULL LEADERBOARD →</Link>
              </PixelButton>
            </div>
          </PixelCard>
        </div>
      </div>
    </PixelContainer>
  )
}
