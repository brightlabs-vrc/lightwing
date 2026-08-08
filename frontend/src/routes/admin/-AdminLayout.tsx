import React from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { Header, UnderlineNav, PageHeader, Heading } from '@primer/react'
import { useAuth } from '../../hooks/useAuth'
import { ColorModeSelector } from '../../components/ThemeAndStatus'

interface AdminLayoutProps {
  children: React.ReactNode
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

export function AdminLayout({ children, title, subtitle, actions }: AdminLayoutProps) {
  const { session, signOutUser } = useAuth()
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  const isCurrent = (path: string) => {
    if (path === '/admin') {
      return pathname === '/admin' || pathname === '/admin/'
    }
    return pathname.startsWith(path)
  }

  return (
    <div style={{ backgroundColor: 'var(--color-canvas-subtle)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Global Application Header */}
      <Header>
        <Header.Item>
          <Header.Link href="/admin" style={{ fontSize: '18px', fontWeight: 'bold' }}>
            ⚙️ Project Lightwing Admin
          </Header.Link>
        </Header.Item>
        <Header.Item full />
        <Header.Item style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {session ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '14px', color: '#57606a' }}>
                Signed in as <strong>{session.user.name}</strong> ({session.user.siteRole})
              </span>
              <ButtonWrapper onClick={() => void signOutUser('/')}>
                Sign Out
              </ButtonWrapper>
            </div>
          ) : (
            <span style={{ fontSize: '14px', color: '#57606a' }}>Not signed in</span>
          )}
          <ColorModeSelector />
        </Header.Item>
      </Header>

      {/* Navigation and Context Bar */}
      <div style={{ backgroundColor: 'var(--color-canvas-default)', borderBottom: '1px solid var(--color-border-default)' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 1.5rem' }}>
          <UnderlineNav aria-label="Admin Navigation">
            <UnderlineNav.Item as={Link} to="/admin" aria-current={isCurrent('/admin') && !isCurrent('/admin/events') && !isCurrent('/admin/users') && !isCurrent('/admin/teams') ? 'page' : undefined}>
              Home
            </UnderlineNav.Item>
            <UnderlineNav.Item as={Link} to="/admin/events" aria-current={isCurrent('/admin/events') ? 'page' : undefined}>
              Events & Races
            </UnderlineNav.Item>
            <UnderlineNav.Item as={Link} to="/admin/users" aria-current={isCurrent('/admin/users') ? 'page' : undefined}>
              Users
            </UnderlineNav.Item>
            <UnderlineNav.Item as={Link} to="/admin/teams" aria-current={isCurrent('/admin/teams') ? 'page' : undefined}>
              Teams
            </UnderlineNav.Item>
            <UnderlineNav.Item as={Link} to="/" style={{ marginLeft: 'auto', fontWeight: 'bold', color: 'var(--color-accent-fg)' }}>
              ← Back to Portal
            </UnderlineNav.Item>
          </UnderlineNav>
        </div>
      </div>

      {/* Main Content Workspace */}
      <main style={{ maxWidth: '1400px', width: '100%', margin: '0 auto', padding: '1.5rem', flexGrow: 1, boxSizing: 'border-box' }}>
        {/* Page Header block */}
        <div style={{
          backgroundColor: 'var(--color-canvas-default)',
          border: '1px solid var(--color-border-default)',
          borderRadius: '6px',
          padding: '1.5rem',
          marginBottom: '1.5rem',
          boxShadow: 'var(--color-shadow-medium)'
        }}>
          <PageHeader>
            <PageHeader.TitleArea>
              <PageHeader.Title>
                <Heading as="h1" style={{ fontSize: '24px' }}>{title}</Heading>
              </PageHeader.Title>
              {subtitle && (
                <PageHeader.Description>
                  <span style={{ fontSize: '14px', color: '#57606a' }}>{subtitle}</span>
                </PageHeader.Description>
              )}
            </PageHeader.TitleArea>
            {actions && (
              <PageHeader.Actions>
                <div style={{ display: 'flex', gap: '8px' }}>{actions}</div>
              </PageHeader.Actions>
            )}
          </PageHeader>
        </div>

        {/* Content body slot */}
        <div>
          {children}
        </div>
      </main>
    </div>
  )
}

import { Button as PrimerButton } from '@primer/react'
const ButtonWrapper: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => {
  return (
    <PrimerButton size="small" onClick={onClick}>
      {children}
    </PrimerButton>
  )
}
