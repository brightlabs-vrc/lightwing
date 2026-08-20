'use client'

import { usePathname } from 'next/navigation'
import { Header, NavList, Button } from '@primer/react'
import { HomeIcon, TrophyIcon, PeopleIcon, ShieldIcon, ArrowLeftIcon } from '@primer/octicons-react'
import { useAuth } from '@/hooks/useAuth'
import { ColorModeSelector } from '@/components/ThemeAndStatus'
import React from 'react'

interface AdminLayoutProps {
  children: React.ReactNode
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname()
  const { session, signOutUser } = useAuth()

  const isCurrent = (path: string) => {
    if (path === '/admin') {
      return pathname === '/admin' || pathname === '/admin/'
    }
    return pathname.startsWith(path)
  }

  const navItems = [
    { href: '/admin', label: 'Dashboard', icon: HomeIcon, isActive: isCurrent('/admin') && !isCurrent('/admin/events') && !isCurrent('/admin/users') && !isCurrent('/admin/teams') },
    { href: '/admin/events', label: 'Events & Races', icon: TrophyIcon, isActive: isCurrent('/admin/events') && !pathname.startsWith('/admin/events/') },
    { href: '/admin/users', label: 'Users', icon: PeopleIcon, isActive: isCurrent('/admin/users') && !pathname.startsWith('/admin/users/') },
    { href: '/admin/teams', label: 'Teams', icon: ShieldIcon, isActive: isCurrent('/admin/teams') && !pathname.startsWith('/admin/teams/') },
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
      <Header>
        <Header.Item>
          <Header.Link href="/admin" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img src="/favicon.png" alt="Lightwing" style={{ width: '20px', height: '20px' }} />
            <span style={{ fontSize: '18px', fontWeight: 'bold' }}>Admin</span>
          </Header.Link>
        </Header.Item>
        <Header.Item full />
        <Header.Item style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {session ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '14px', color: 'var(--color-fg-muted)' }}>
                Signed in as <strong>{session.user.vrchatUsername ?? session.user.name}</strong> ({session.user.siteRole})
              </span>
              <Button size="small" onClick={() => void signOutUser('/')}>
                Sign Out
              </Button>
            </div>
          ) : (
            <span style={{ fontSize: '14px', color: 'var(--color-fg-muted)' }}>Not signed in</span>
          )}
          <ColorModeSelector />
        </Header.Item>
      </Header>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
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
                  key={item.href}
                  href={item.href}
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
                  href="/"
                  style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--color-accent-fg)' }}
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

        <main style={{ flex: 1, padding: '1.5rem', overflowY: 'auto', minHeight: 0 }}>
          {children}
        </main>
      </div>

      <div
        style={{
          borderTop: '1px solid var(--color-border-default)',
          padding: '1rem 1.5rem',
          textAlign: 'center',
        }}
      >
        <span style={{ fontSize: '12px', color: 'var(--color-fg-muted)' }}>Admin — Authorized access only</span>
      </div>
    </div>
  )
}
