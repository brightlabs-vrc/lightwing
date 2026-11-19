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
import { PxlKitIcon } from '@pxlkit/core'
import { Trophy } from '@pxlkit/gamification'
import { AuthProvider, useAuth } from '../hooks/useAuth'
import { UserHeaderDropdown } from '../components/UserHeaderDropdown'
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

function RootLayout() {
  const { session, loading, signOutUser } = useAuth()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const isAdminArea = pathname.startsWith('/admin')
  const isManagementArea = pathname.startsWith('/teams')
  const isAuthArea = pathname === '/auth'
  const isSiteAdmin = session?.user.siteRole === 'SITE_ADMIN'

  if (isAdminArea) {
    return (
      <>
        <Outlet />
        <Suspense>
          <TanStackRouterDevtools position='bottom-right' />
        </Suspense>
      </>
    )
  }

  if (isManagementArea) {
    return (
      <>
        <Outlet />
        <Suspense>
          <TanStackRouterDevtools position='bottom-right' />
        </Suspense>
      </>
    )
  }

  if (isAuthArea) {
    return (
      <>
        <div className='min-h-screen bg-[radial-gradient(circle_at_top,_#dbeafe_0%,_#eff6ff_28%,_#f8fafc_62%,_#ffffff_100%)] text-slate-900'>
          <Outlet />
        </div>
        <Suspense>
          <TanStackRouterDevtools position='bottom-right' />
        </Suspense>
      </>
    )
  }

  return (
    <>
      <div className="min-h-screen bg-retro-bg text-retro-text font-sans selection:bg-retro-secondary selection:text-retro-text">
        <header className="border-b-2 border-retro-border-strong bg-retro-surface py-0.5">
          <PixelContainer maxWidth="full" padding="none" className="site-header-container px-4">
            <PixelStack direction="row" gap={3} align="center" justify="between" wrap className="site-header-inner">
              <PixelButton asChild variant="ghost" tone="neutral" className="site-brand">
                <Link to="/">
                  <PixelStack direction="row" gap={2} align="center">
                    <img src="/favicon.png" alt="Lightwing" className="w-6 h-6" />
                  </PixelStack>
                </Link>
              </PixelButton>

              <PixelStack direction="row" gap={2} align="center" wrap className="site-nav">
                <PixelButton asChild variant="ghost" tone="neutral" size="sm">
                  <Link to="/">HOME</Link>
                </PixelButton>
                <PixelButton asChild variant="ghost" tone="neutral" size="sm">
                  <Link to="/events">EVENTS</Link>
                </PixelButton>
                <PixelButton asChild variant="ghost" tone="neutral" size="sm">
                  <Link to="/leaderboard">LEADERBOARD</Link>
                </PixelButton>
                <PixelButton asChild variant="ghost" tone="neutral" size="sm">
                  <Link to="/newsletters">NEWSLETTERS</Link>
                </PixelButton>
                {isSiteAdmin ? (
                  <PixelButton asChild variant="soft" tone="gold" size="sm">
                    <Link to="/admin">ADMIN</Link>
                  </PixelButton>
                ) : null}

                {!loading && session && (isSiteAdmin || (session.user.teams && session.user.teams.length > 0)) ? (
                  <PixelButton asChild variant="soft" tone="purple" size="sm">
                    <Link
                      to="/teams/manage/$id"
                      params={{ id: session.user.teams && session.user.teams.length > 0 ? session.user.teams[0].organizationId : 'org_mock_urs' }}
                    >
                      ORG ADMIN
                    </Link>
                  </PixelButton>
                ) : null}

                {loading ? (
                  <PixelBadge tone="neutral">LOADING...</PixelBadge>
                ) : null}

                {!loading && session ? (
                  <UserHeaderDropdown
                    session={session}
                    signOutUser={signOutUser}
                  />
                ) : null}

                {!loading && !session ? (
                  <PixelStack direction="row" gap={2} align="center">
                    <PixelButton asChild variant="solid" tone="purple" size="sm">
                      <Link to="/auth">SIGN IN</Link>
                    </PixelButton>
                  </PixelStack>
                ) : null}
              </PixelStack>
            </PixelStack>
          </PixelContainer>
        </header>

        <main className="w-full px-6 py-8">
          <Outlet />
        </main>

        <footer className="w-full px-6 pb-12 text-center font-pixel text-xs text-retro-muted border-t-2 border-retro-border pt-6">
          Project Lightwing &copy; 2026 is made with {'<3'} by Bright Labs. Neigh.
        </footer>
      </div>
      <Suspense>
        <TanStackRouterDevtools position='bottom-right' />
      </Suspense>
    </>
  )
}
