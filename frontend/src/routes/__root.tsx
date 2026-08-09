import React, { Suspense } from 'react'
import { createRootRoute, Link, Outlet, useRouterState } from '@tanstack/react-router'
import { Header, Button, Text } from '@primer/react'
import { useAuth } from '../hooks/useAuth'
import { ColorModeSelector } from '../components/ThemeAndStatus'

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
          <TanStackRouterDevtools position="bottom-right" />
        </Suspense>
      </>
    )
  }

  if (isAuthArea) {
    return (
      <>
        <div style={{ backgroundColor: 'var(--color-canvas-subtle)', minHeight: '100vh', color: 'var(--color-fg-default)' }}>
          <Outlet />
        </div>
        <Suspense>
          <TanStackRouterDevtools position="bottom-right" />
        </Suspense>
      </>
    )
  }

  return (
    <div style={{
      backgroundColor: 'var(--color-canvas-subtle)',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      color: 'var(--color-fg-default)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif'
    }}>
      {/* Global Application Header */}
      <Header>
        <Header.Item>
          <Header.Link as={Link as any} to="/" style={{ fontSize: '18px', fontWeight: 'bold' }}>
            LIGHTWING
          </Header.Link>
        </Header.Item>
        <Header.Item>
          <Header.Link as={Link as any} to="/">
            Home
          </Header.Link>
        </Header.Item>
        <Header.Item>
          <Header.Link as={Link as any} to="/events">
            Events
          </Header.Link>
        </Header.Item>
        {isSiteAdmin ? (
          <Header.Item>
            <Header.Link as={Link as any} to="/admin" style={{ color: 'var(--color-attention-fg)', fontWeight: 'bold' }}>
              Admin
            </Header.Link>
          </Header.Item>
        ) : null}

        <Header.Item full />

        <Header.Item style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {loading ? (
            <span style={{ fontSize: '12px', color: 'var(--color-fg-muted)' }}>LOADING...</span>
          ) : session ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Button as={Link as any} to="/profile" size="small">
                {session.user.name.toUpperCase()}
              </Button>
              <Button
                variant="danger"
                size="small"
                onClick={() => void signOutUser('/auth')}
              >
                Sign Out
              </Button>
            </div>
          ) : (
            <Button as={Link as any} to="/auth" variant="primary" size="small">
              Sign In
            </Button>
          )}
          <ColorModeSelector />
        </Header.Item>
      </Header>

      {/* Main page body slot */}
      <main style={{ maxWidth: '1200px', width: '100%', margin: '0 auto', padding: '2rem 1.5rem', flexGrow: 1, boxSizing: 'border-box' }}>
        <Outlet />
      </main>

      {/* Footer bar */}
      <footer style={{
        textAlign: 'center',
        padding: '2rem 1.5rem',
        fontSize: '12px',
        color: 'var(--color-fg-muted)',
        borderTop: '1px solid var(--color-border-default)',
        backgroundColor: 'var(--color-canvas-default)'
      }}>
        Lightwing Prototype &copy; 2026, Umamusume Racing Society. All rights reserved. Neigh.
      </footer>

      <Suspense>
        <TanStackRouterDevtools position="bottom-right" />
      </Suspense>
    </div>
  )
}
