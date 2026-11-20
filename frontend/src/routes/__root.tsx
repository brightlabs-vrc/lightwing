import React, { Suspense, useState } from 'react'
import {
  createRootRoute,
  HeadContent,
  Link,
  Outlet,
  Scripts,
  useRouterState,
} from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  PixelContainer,
  PixelStack,
  PixelButton,
  PixelBadge,
  PxlKitSurfaceProvider,
  PxlKitToastProvider,
} from '@pxlkit/ui-kit'
import { AuthProvider, useAuth } from '../hooks/useAuth'
import { UserHeaderDropdown } from '../components/UserHeaderDropdown'
import { HeaderQuickSearch } from '../components/HeaderQuickSearch'
import { buildSeoMeta } from '../lib/seo'
import appCss from '../styles.css?url'

const TanStackRouterDevtools =
  import.meta.env.PROD
    ? () => null
    : React.lazy(() =>
        import('@tanstack/router-devtools').then((res) => ({
          default: res.TanStackRouterDevtools,
        })),
      )

export const Route = createRootRoute({
  ssr: 'data-only',
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1.0' },
      ...buildSeoMeta({
        description: 'UmaKeiba - Competitive VR Racing Platform',
      }),
    ],
    links: [
      { rel: 'icon', type: 'image/png', href: '/favicon.png' },
      { rel: 'stylesheet', href: appCss },
    ],
  }),
  shellComponent: RootDocument,
  component: RootLayout,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <PxlKitSurfaceProvider surface="pixel">
            <PxlKitToastProvider>
              <AuthProvider>{children}</AuthProvider>
            </PxlKitToastProvider>
          </PxlKitSurfaceProvider>
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  )
}

import {
  PixelSkeletonDetail,
  SldsSkeletonDetail,
} from '../components/LoadingSkeleton'
import { AdminLayout } from './admin/-AdminLayout'
import { ManagementLayout } from './teams/-ManagementLayout'

function isAdminPath(path: string): boolean {
  return path.startsWith('/admin')
}

function isManagementPath(path: string): boolean {
  return path.startsWith('/teams/new') || path.startsWith('/teams/manage')
}

function RootLayout() {
  const { session, loading, signOutUser } = useAuth()
  const { targetPathname, resolvedPathname } = useRouterState({
    select: (state) => ({
      targetPathname: state.location.pathname,
      resolvedPathname: state.resolvedLocation?.pathname ?? state.location.pathname,
    }),
  })

  const isTransitioning = targetPathname !== resolvedPathname
  const isAdminArea = isAdminPath(targetPathname)
  const isManagementArea = isManagementPath(targetPathname)
  const isAuthArea = targetPathname === '/auth'

  if (isAdminArea) {
    return (
      <>
        {isTransitioning ? (
          <AdminLayout title="Loading...">
            <SldsSkeletonDetail />
          </AdminLayout>
        ) : (
          <Outlet />
        )}
        <Suspense>
          <TanStackRouterDevtools position='bottom-right' />
        </Suspense>
      </>
    )
  }

  if (isManagementArea) {
    return (
      <>
        {isTransitioning ? (
          <ManagementLayout>
            <PixelContainer maxWidth="full" padding="md">
              <PixelSkeletonDetail />
            </PixelContainer>
          </ManagementLayout>
        ) : (
          <Outlet />
        )}
        <Suspense>
          <TanStackRouterDevtools position='bottom-right' />
        </Suspense>
      </>
    )
  }

  const navItems = [
    { to: '/teams' as const, label: 'TEAMS', icon: 'hn-users-solid' },
    { to: '/leaderboard' as const, label: 'LEADERBOARD', icon: 'hn-trophy-solid' },
    { to: '/events' as const, label: 'EVENTS', icon: 'hn-flag-checkered-solid' },
    { to: '/newsletters' as const, label: 'NEWS', icon: 'hn-newspaper-solid' },
  ]

  return (
    <>
      <div className="min-h-screen bg-retro-bg text-retro-text font-sans selection:bg-retro-secondary selection:text-retro-text flex flex-col overflow-x-hidden">
        <header className="border-b-2 border-retro-border-strong bg-retro-surface sticky top-0 z-40">
          <PixelContainer maxWidth="full" padding="none" className="site-header-container px-3 sm:px-4">
            {/* Top Bar: Brand + Desktop Nav/Search + Account */}
            <div className="flex items-center justify-between gap-2 py-1.5 site-header-inner">
              <div className="flex items-center gap-2 min-w-0">
                <PixelButton asChild variant="ghost" tone="neutral" size="sm" className="site-brand px-1.5">
                  <Link to="/" aria-label="UmaKeiba Home">
                    <div className="flex items-center gap-2">
                      <img src="/favicon.png" alt="Lightwing" className="w-7 h-7 shrink-0" />
                      <span className="font-pixel text-xs font-bold text-retro-text tracking-wide sm:hidden">
                        UMAKEIBA
                      </span>
                    </div>
                  </Link>
                </PixelButton>
              </div>

              {/* Desktop Navigation + Quick Search + Account */}
              <div className="flex items-center gap-2 sm:gap-3 site-nav">
                <nav aria-label="Main navigation" className="hidden md:flex items-center gap-1">
                  {navItems.map((item) => {
                    const active = targetPathname === item.to || targetPathname.startsWith(`${item.to}/`)
                    return (
                      <PixelButton
                        key={item.to}
                        asChild
                        variant={active ? 'soft' : 'ghost'}
                        tone={active ? 'purple' : 'neutral'}
                        size="sm"
                      >
                        <Link to={item.to} className="inline-flex items-center gap-1.5">
                          <i className={`hn ${item.icon} text-xs`} aria-hidden="true" />
                          <span>{item.label}</span>
                        </Link>
                      </PixelButton>
                    )
                  })}
                </nav>

                <div className="hidden sm:block">
                  <HeaderQuickSearch />
                </div>

                {loading ? (
                  <PixelBadge tone="neutral">LOADING...</PixelBadge>
                ) : null}

                {!loading && session ? (
                  <UserHeaderDropdown
                    session={session}
                    signOutUser={signOutUser}
                  />
                ) : null}

                {!loading && !session && !isAuthArea ? (
                  <PixelButton asChild variant="solid" tone="purple" size="sm">
                    <Link to="/auth">SIGN IN</Link>
                  </PixelButton>
                ) : null}
              </div>
            </div>

            {/* Hugging Face-Inspired Mobile Second Tier: Search + Horizontally Scrollable Pill Nav */}
            <div className="md:hidden pb-2 pt-1 border-t border-retro-border/70 flex flex-col gap-2">
              <div className="sm:hidden">
                <HeaderQuickSearch />
              </div>
              <nav
                aria-label="Mobile navigation"
                className="flex items-center gap-1.5 overflow-x-auto no-scrollbar"
              >
                {navItems.map((item) => {
                  const active = targetPathname === item.to || targetPathname.startsWith(`${item.to}/`)
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-[10px] font-pixel font-bold whitespace-nowrap shrink-0 transition-colors ${
                        active
                          ? 'bg-retro-primary text-white border-retro-primary'
                          : 'bg-retro-bg text-retro-text border-retro-border hover:border-retro-primary'
                      }`}
                    >
                      <i className={`hn ${item.icon} text-[11px]`} aria-hidden="true" />
                      <span>{item.label}</span>
                    </Link>
                  )
                })}
              </nav>
            </div>
          </PixelContainer>
        </header>

        <main className="w-full px-3 sm:px-6 py-4 sm:py-8 flex-1">
          {isTransitioning ? (
            <PixelContainer maxWidth="full" padding="md">
              <PixelSkeletonDetail />
            </PixelContainer>
          ) : (
            <Outlet />
          )}
        </main>

        <footer className="w-full px-4 sm:px-6 pb-10 text-center font-pixel text-xs text-retro-muted border-t-2 border-retro-border pt-6">
          Project Lightwing &copy; 2026 is made with {'<3'} by Bright Labs. Neigh.
        </footer>
      </div>
      <Suspense>
        <TanStackRouterDevtools position='bottom-right' />
      </Suspense>
    </>
  )
}
