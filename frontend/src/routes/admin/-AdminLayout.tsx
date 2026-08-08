import React from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { Header, PageLayout, NavList, PageHeader, Heading, Button } from '@primer/react'
import {
  HomeIcon,
  CalendarIcon,
  PeopleIcon,
  OrganizationIcon,
  ArrowLeftIcon,
} from '@primer/octicons-react'
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
      <Header style={{ borderBottom: '1px solid var(--color-border-default)', padding: '0.75rem 1.5rem' }}>
        <Header.Item>
          <Header.Link href="/admin" style={{ fontSize: '18px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⚙️</span> Project Lightwing Admin
          </Header.Link>
        </Header.Item>
        <Header.Item full />
        <Header.Item style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {session ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '14px', color: 'var(--color-fg-muted)' }}>
                Signed in as <strong>{session.user.name}</strong> ({session.user.siteRole})
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

      {/* Main Utilitarian Dashboard Layout */}
      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <PageLayout containerWidth="full" padding="none">
          <PageLayout.Pane position="start" aria-label="Admin Navigation" width="medium" style={{
            backgroundColor: 'var(--color-canvas-default)',
            borderRight: '1px solid var(--color-border-default)',
            minHeight: 'calc(100vh - 60px)',
            padding: '1.5rem 1rem',
          }}>
            <NavList>
              <NavList.Group title="Dashboard Nav">
                <NavList.Item
                  as={Link}
                  to="/admin"
                  aria-current={isCurrent('/admin') && !isCurrent('/admin/events') && !isCurrent('/admin/users') && !isCurrent('/admin/teams') ? 'page' : undefined}
                >
                  <NavList.LeadingVisual>
                    <HomeIcon />
                  </NavList.LeadingVisual>
                  Home
                </NavList.Item>

                <NavList.Item
                  as={Link}
                  to="/admin/events"
                  aria-current={isCurrent('/admin/events') ? 'page' : undefined}
                >
                  <NavList.LeadingVisual>
                    <CalendarIcon />
                  </NavList.LeadingVisual>
                  Events & Races
                </NavList.Item>

                <NavList.Item
                  as={Link}
                  to="/admin/users"
                  aria-current={isCurrent('/admin/users') ? 'page' : undefined}
                >
                  <NavList.LeadingVisual>
                    <PeopleIcon />
                  </NavList.LeadingVisual>
                  Users
                </NavList.Item>

                <NavList.Item
                  as={Link}
                  to="/admin/teams"
                  aria-current={isCurrent('/admin/teams') ? 'page' : undefined}
                >
                  <NavList.LeadingVisual>
                    <OrganizationIcon />
                  </NavList.LeadingVisual>
                  Teams
                </NavList.Item>
              </NavList.Group>

              <NavList.Divider style={{ margin: '1.5rem 0' }} />

              <NavList.Item
                as={Link}
                to="/"
                style={{ color: 'var(--color-accent-fg)', fontWeight: 'bold' }}
              >
                <NavList.LeadingVisual>
                  <ArrowLeftIcon />
                </NavList.LeadingVisual>
                Back to Portal
              </NavList.Item>
            </NavList>
          </PageLayout.Pane>

          <PageLayout.Content style={{ padding: '2rem' }}>
            {/* Page Header block */}
            <div style={{
              backgroundColor: 'var(--color-canvas-default)',
              border: '1px solid var(--color-border-default)',
              borderRadius: '6px',
              padding: '1.5rem',
              marginBottom: '2rem',
              boxShadow: 'var(--color-shadow-small)',
            }}>
              <PageHeader>
                <PageHeader.TitleArea>
                  <PageHeader.Title>
                    <Heading as="h1" style={{ fontSize: '24px', margin: 0 }}>{title}</Heading>
                  </PageHeader.Title>
                  {subtitle && (
                    <PageHeader.Description>
                      <span style={{ fontSize: '14px', color: 'var(--color-fg-muted)' }}>{subtitle}</span>
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
          </PageLayout.Content>
        </PageLayout>
      </div>
    </div>
  )
}
