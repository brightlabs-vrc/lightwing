'use client'


import { Header, Button, Text, Link as PrimerLink } from '@primer/react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { ColorModeSelector } from '@/components/ThemeAndStatus'

import { usePathname } from 'next/navigation'

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { session, loading } = useAuth()
  const pathname = usePathname()
  const isAdminArea = pathname.startsWith('/admin')
  const isAuthArea = pathname === '/auth'
  const isSiteAdmin = session?.user.siteRole === 'SITE_ADMIN'

  if (isAdminArea) {
    return <>{children}</>
  }

  if (isAuthArea) {
    return (
      <div
        style={{
          backgroundColor: 'var(--color-canvas-subtle)',
          minHeight: '100vh',
          color: 'var(--color-fg-default)',
        }}
      >
        {children}
      </div>
    )
  }

  return (
    <div
      style={{
        backgroundColor: 'var(--color-canvas-subtle)',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        color: 'var(--color-fg-default)',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
      }}
    >
      <Header>
        <Header.Item>
          <Link href="/" style={{ display: 'flex', alignItems: 'center' }}>
            <img
              src="/favicon.png"
              alt="Lightwing"
              style={{ width: '24px', height: '24px' }}
            />
          </Link>
        </Header.Item>
        <Header.Item>
          <Header.Link as={Link} href="/">
            Home
          </Header.Link>
        </Header.Item>
        <Header.Item>
          <Header.Link as={Link} href="/events">
            Events
          </Header.Link>
        </Header.Item>
        {isSiteAdmin && (
          <Header.Item>
            <Header.Link
              as={Link}
              href="/admin"
              style={{
                color: 'var(--color-attention-fg)',
                fontWeight: 'bold',
              }}
            >
              Admin
            </Header.Link>
          </Header.Item>
        )}
        <Header.Item full />
        <Header.Item
          style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}
        >
          {loading ? (
            <span
              style={{ fontSize: '12px', color: 'var(--color-fg-muted)' }}
            >
              LOADING...
            </span>
          ) : session ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Button as={Link} href="/profile" size="small">
                {session.user.vrchatUsername ?? session.user.name}
              </Button>
              <Button
                variant="danger"
                size="small"
                onClick={() => {
                  fetch('/api/auth/sign-out', { method: 'POST', credentials: 'include' })
                    .then(() => window.location.href = '/auth')
                }}
              >
                Sign Out
              </Button>
            </div>
          ) : (
            <Button as={Link} href="/auth" variant="primary" size="small">
              Sign In
            </Button>
          )}
          <ColorModeSelector />
        </Header.Item>
      </Header>

      <main
        style={{
          maxWidth: '1200px',
          width: '100%',
          margin: '0 auto',
          padding: '2rem 1.5rem',
          flexGrow: 1,
          boxSizing: 'border-box',
        }}
      >
        {children}
      </main>

      <footer
        style={{
          textAlign: 'center',
          padding: '2rem 1.5rem',
          fontSize: '12px',
          color: 'var(--color-fg-muted)',
          borderTop: '1px solid var(--color-border-default)',
          backgroundColor: 'var(--color-canvas-default)',
        }}
      >
        Lightwing Prototype &copy; 2026, Umamusume Racing Society. All rights
        reserved. Neigh.
      </footer>
    </div>
  )
}