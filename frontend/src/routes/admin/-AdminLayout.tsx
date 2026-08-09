import React from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { Header, NavList, Button } from '@primer/react'
import { HomeIcon, TrophyIcon, PeopleIcon, ShieldIcon, ArrowLeftIcon } from '@primer/octicons-react'
import { useAuth } from '../../hooks/useAuth'
import { ColorModeSelector } from '../../components/ThemeAndStatus'

interface AdminLayoutProps {
  children: React.ReactNode
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { session, signOutUser } = useAuth()
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  const isCurrent = (path: string) => {
    if (path === '/admin') {
      return pathname === '/admin' || pathname === '/admin/'
    }
    return pathname.startsWith(path)
  }

  const navItems = [
    {
      to: '/admin',
      label: 'Dashboard',
      icon: HomeIcon,
      isActive:
        isCurrent('/admin') &&
        !isCurrent('/admin/events') &&
        !isCurrent('/admin/users') &&
        !isCurrent('/admin/teams'),
    },
    {
      to: '/admin/events',
      label: 'Events & Races',
      icon: TrophyIcon,
      isActive: isCurrent('/admin/events'),
    },
    {
      to: '/admin/users',
      label: 'Users',
      icon: PeopleIcon,
      isActive: isCurrent('/admin/users'),
    },
    {
      to: '/admin/teams',
      label: 'Teams',
      icon: ShieldIcon,
      isActive: isCurrent('/admin/teams'),
    },
  ]

  return (
    <div
      style={{
        backgroundColor: 'var(--color-canvas-default)',
        color: 'var(--color-fg-default)',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Global Application Header */}
      <Header>
        <Header.Item>
          <Header.Link
            href="/admin"
            style={{ fontSize: '18px', fontWeight: 'bold' }}
          >
            Project Lightwing Admin
          </Header.Link>
        </Header.Item>
        <Header.Item full />
        <Header.Item
          style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}
        >
          {session ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <span style={{ fontSize: '14px', color: 'var(--color-fg-muted)' }}>
                Signed in as <strong>{session.user.name}</strong> ({' '}
                {session.user.siteRole})
              </span>
              <Button size="small" onClick={() => void signOutUser('/')}>
                Sign Out
              </Button>
            </div>
          ) : (
            <span style={{ fontSize: '14px', color: 'var(--color-fg-muted)' }}>
              Not signed in
            </span>
          )}
          <ColorModeSelector />
        </Header.Item>
      </Header>

      {/* Sidebar + Main Content */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Sidebar Navigation */}
        <nav
          style={{
            width: 256,
            minWidth: 256,
            maxWidth: 256,
            backgroundColor: 'var(--color-canvas-subtle)',
            borderRight: '1px solid var(--color-border-default)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ padding: '1.5rem 0' }}>
            <NavList aria-label="Admin">
              {navItems.map((item) => (
                <NavList.Item
                  key={item.to}
                  as={Link}
                  to={item.to as any}
                  aria-current={item.isActive ? 'page' : undefined}
                  style={{ fontSize: '14px' }}
                >
                  <NavList.LeadingVisual>
                    <item.icon />
                  </NavList.LeadingVisual>
                  {item.label}
                </NavList.Item>
              ))}
            </NavList>

            <div style={{ marginTop: '2rem' }}>
              <NavList>
                <NavList.Item
                  as={Link}
                  to="/"
                  style={{
                    fontSize: '14px',
                    fontWeight: 'bold',
                    color: 'var(--color-accent-fg)',
                  }}
                >
                  <NavList.LeadingVisual>
                    <ArrowLeftIcon />
                  </NavList.LeadingVisual>
                  Back to Portal
                </NavList.Item>
              </NavList>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main
          style={{
            flex: 1,
            padding: '1.5rem',
            overflowY: 'auto',
            minHeight: 0,
          }}
        >
          {children}
        </main>
      </div>

      {/* Footer */}
      <div
        style={{
          borderTop: '1px solid var(--color-border-default)',
          padding: '1rem 1.5rem',
          textAlign: 'center',
        }}
      >
        <span style={{ fontSize: '12px', color: 'var(--color-fg-muted)' }}>
          Project Lightwing Admin — Authorized access only
        </span>
      </div>
    </div>
  )
}
