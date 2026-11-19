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

function RootLayout() {
  const { session, loading, signOutUser } = useAuth()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const isAdminArea = pathname.startsWith('/admin')
  const isManagementArea =
    pathname.startsWith('/teams/new') || pathname.startsWith('/teams/manage')
  const isAuthArea = pathname === '/auth'

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

  return (
    <>
      <div className="min-h-screen bg-retro-bg text-retro-text font-sans selection:bg-retro-secondary selection:text-retro-text flex flex-col">
        <header className="border-b-2 border-retro-border-strong bg-retro-surface py-1">
          <PixelContainer maxWidth="full" padding="none" className="site-header-container px-4">
            <PixelStack direction="row" gap={3} align="center" justify="between" wrap className="site-header-inner">
              <PixelButton asChild variant="ghost" tone="neutral" className="site-brand">
                <Link to="/" aria-label="UmaKeiba Home">
                  <PixelStack direction="row" gap={2} align="center">
                    <img src="/favicon.png" alt="Lightwing" className="w-7 h-7" />
                  </PixelStack>
                </Link>
              </PixelButton>

              <PixelStack direction="row" gap={3} align="center" wrap className="site-nav">
                <PixelStack direction="row" gap={1} align="center">
                  <PixelButton asChild variant="ghost" tone="neutral" size="sm">
                    <Link to="/teams">TEAMS</Link>
                  </PixelButton>
                  <PixelButton asChild variant="ghost" tone="neutral" size="sm">
                    <Link to="/leaderboard">LEADERBOARD</Link>
                  </PixelButton>
                  <PixelButton asChild variant="ghost" tone="neutral" size="sm">
                    <Link to="/events">EVENTS</Link>
                  </PixelButton>
                </PixelStack>

                <HeaderQuickSearch />

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
              </PixelStack>
            </PixelStack>
          </PixelContainer>
        </header>

        <main className="w-full px-6 py-8 flex-1">
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
