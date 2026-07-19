import React, { Suspense } from 'react'
import { createRootRoute, Link, Outlet, useRouterState } from '@tanstack/react-router'
import { PixelContainer, PixelStack, PixelButton, PixelBadge } from '@pxlkit/ui-kit'
import { PxlKitIcon } from '@pxlkit/core'
import { Trophy } from '@pxlkit/gamification'
import { useAuth } from '../hooks/useAuth'

const TanStackRouterDevtools =
  import.meta.env.PROD
    ? () => null
    : React.lazy(() =>
        import('@tanstack/router-devtools').then((res) => ({
          default: res.TanStackRouterDevtools,
        })),
      )

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  const { session, loading, signOutUser } = useAuth()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const isAdminArea = pathname.startsWith('/admin')
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
        <header className="border-b-2 border-retro-border-strong bg-retro-surface">
          <PixelContainer maxWidth="full" padding="sm">
            <PixelStack direction="row" gap={4} align="center" justify="between" wrap>
              <PixelButton asChild variant="ghost" tone="neutral">
                <Link to="/">
                  <PixelStack direction="row" gap={2} align="center">
                    <span className="font-pixel text-sm tracking-wider leading-none">LIGHTWING</span>
                  </PixelStack>
                </Link>
              </PixelButton>

              <PixelStack direction="row" gap={2} align="center" wrap>
                <PixelButton asChild variant="ghost" tone="neutral" size="sm">
                  <Link to="/">HOME</Link>
                </PixelButton>
                <PixelButton asChild variant="ghost" tone="neutral" size="sm">
                  <Link to="/events">EVENTS</Link>
                </PixelButton>
                {isSiteAdmin ? (
                  <PixelButton asChild variant="soft" tone="gold" size="sm">
                    <Link to="/admin">ADMIN</Link>
                  </PixelButton>
                ) : null}

                {loading ? (
                  <PixelBadge tone="neutral">LOADING...</PixelBadge>
                ) : null}

                {!loading && session ? (
                  <PixelStack direction="row" gap={2} align="center">
                    <PixelButton asChild variant="outline" tone="neutral" size="sm">
                      <Link to="/profile" title="Edit Profile">
                        {session.user.name.toUpperCase()}
                      </Link>
                    </PixelButton>
                    <PixelButton
                      variant="solid"
                      tone="red"
                      size="sm"
                      onClick={() => void signOutUser('/auth')}
                    >
                      SIGN OUT
                    </PixelButton>
                  </PixelStack>
                ) : null}

                {!loading && !session ? (
                  <PixelStack direction="row" gap={2} align="center">
                    <PixelBadge tone="neutral">OFFLINE</PixelBadge>
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
          Lightwing Prototype &copy; 2026, Umamusume Racing Society. All rights reserved. Neigh.
        </footer>
      </div>
      <Suspense>
        <TanStackRouterDevtools position='bottom-right' />
      </Suspense>
    </>
  )
}
