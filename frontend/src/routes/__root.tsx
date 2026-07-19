import React, { Suspense } from 'react'
import { createRootRoute, Link, Outlet, useRouterState } from '@tanstack/react-router'
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
        <header className="border-b-4 border-retro-border-strong bg-retro-surface p-4">
          <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 text-sm">
            <Link
              to="/"
              activeProps={{ className: 'bg-retro-primary text-white' }}
              className="px-3 py-1.5 font-pixel text-[11px] tracking-wider text-retro-text hover:text-retro-primary border-2 border-transparent hover:border-retro-border-strong pxl-corner-sm transition-all"
            >
              HOME
            </Link>
            <Link
              to="/events"
              activeProps={{ className: 'bg-retro-primary text-white' }}
              className="px-3 py-1.5 font-pixel text-[11px] tracking-wider text-retro-text hover:text-retro-primary border-2 border-transparent hover:border-retro-border-strong pxl-corner-sm transition-all"
            >
              EVENTS
            </Link>
            {isSiteAdmin ? (
              <Link
                to="/admin"
                className="px-3 py-1.5 font-pixel text-[11px] tracking-wider bg-retro-gold text-retro-text border-2 border-retro-border-strong pxl-corner-sm hover:bg-retro-secondary transition-all"
              >
                ADMIN
              </Link>
            ) : null}

            <div className="ml-auto flex items-center gap-3 text-xs">
              {loading ? <span className="font-pixel text-[9px] text-retro-muted animate-pulse">LOADING...</span> : null}

              {!loading && session ? (
                <div className="flex items-center gap-3">
                  <Link
                    to="/profile"
                    activeProps={{ className: 'border-retro-primary text-retro-primary' }}
                    className="font-pixel text-[9px] bg-retro-card px-2.5 py-1 border-2 border-retro-border pxl-corner-sm hover:text-retro-primary hover:border-retro-border-strong transition-all"
                    title="Edit Profile"
                  >
                    {session.user.name.toUpperCase()}
                  </Link>
                  <button
                    type="button"
                    onClick={() => void signOutUser('/auth')}
                    className="font-pixel text-[9px] bg-retro-red text-white px-2.5 py-1 border-2 border-retro-border-strong pxl-corner-sm hover:bg-red-700 active:translate-y-0.5 transition-all cursor-pointer"
                  >
                    SIGN OUT
                  </button>
                </div>
              ) : null}

              {!loading && !session ? (
                <div className="flex items-center gap-3">
                  <span className="font-pixel text-[9px] text-retro-muted">OFFLINE</span>
                  <Link
                    to="/auth"
                    className="font-pixel text-[9px] bg-retro-primary text-white px-2.5 py-1.5 border-2 border-retro-border-strong pxl-corner-sm hover:bg-indigo-700 active:translate-y-0.5 transition-all cursor-pointer"
                  >
                    SIGN IN
                  </Link>
                </div>
              ) : null}
            </div>
          </nav>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-8">
          <Outlet />
        </main>

        <footer className="mx-auto max-w-6xl px-4 pb-12 text-center font-pixel text-[10px] text-retro-muted border-t-2 border-retro-border pt-6">
          Lightwing × PxlKit • 8-Bit Racing Platform
        </footer>
      </div>
      <Suspense>
        <TanStackRouterDevtools position='bottom-right' />
      </Suspense>
    </>
  )
}
