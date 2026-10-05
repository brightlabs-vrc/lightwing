import React, { Suspense, useState, useRef, useEffect } from 'react'
import { createRootRoute, Link, Outlet, useRouterState } from '@tanstack/react-router'
import { PixelContainer, PixelStack, PixelButton, PixelBadge } from '@pxlkit/ui-kit'
import { PxlKitIcon } from '@pxlkit/core'
import { Trophy } from '@pxlkit/gamification'
import { useAuth } from '../hooks/useAuth'

interface UserHeaderDropdownProps {
  session: {
    user: {
      id: string
      name: string
      slug?: string | null
      image?: string | null
      vrchatUsername?: string | null
    }
  }
  signOutUser: (redirectUrl?: string) => Promise<void>
}

function UserHeaderDropdown({ session, signOutUser }: UserHeaderDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const displayName = session.user.vrchatUsername || session.user.name
  const avatarUrl = session.user.image || `https://avatar.vercel.sh/${session.user.id}`
  const userSlug = session.user.slug || session.user.id

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 p-1 border-2 border-retro-border hover:border-retro-primary rounded-full transition-colors bg-retro-surface focus:outline-none"
        title={displayName}
      >
        <img
          src={avatarUrl}
          alt={displayName}
          className="w-8 h-8 rounded-full object-cover"
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-retro-surface border-2 border-retro-border-strong rounded shadow-lg z-50 py-1 font-pixel text-xs">
          <div className="px-3 py-2 border-b border-retro-border text-retro-text font-bold truncate">
            {displayName}
          </div>
          <Link
            to="/$user"
            params={{ user: userSlug }}
            onClick={() => setIsOpen(false)}
            className="block px-3 py-2 text-retro-text hover:bg-retro-bg hover:text-retro-primary transition-colors"
          >
            MY PROFILE
          </Link>
          <Link
            to="/profile"
            onClick={() => setIsOpen(false)}
            className="block px-3 py-2 text-retro-text hover:bg-retro-bg hover:text-retro-primary transition-colors"
          >
            EDIT PROFILE
          </Link>
          <button
            type="button"
            onClick={() => {
              setIsOpen(false)
              void signOutUser('/auth')
            }}
            className="w-full text-left px-3 py-2 text-retro-red hover:bg-retro-bg transition-colors border-t border-retro-border"
          >
            SIGN OUT
          </button>
        </div>
      )}
    </div>
  )
}

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
          <PixelContainer maxWidth="full" padding="sm" className="site-header-container">
            <PixelStack direction="row" gap={4} align="center" justify="between" wrap className="site-header-inner">
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
                {isSiteAdmin ? (
                  <PixelButton asChild variant="soft" tone="gold" size="sm">
                    <Link to="/admin">ADMIN</Link>
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
