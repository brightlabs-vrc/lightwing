import '../../lib/ssr-dom-shim'
import React, { useEffect, useMemo, useState } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import {
  Avatar,
  BaseStyles,
  Breadcrumbs,
  Button,
  CounterLabel,
  IconButton,
  Label,
  NavList,
  PageLayout,
  ThemeProvider,
} from '@primer/react'
import {
  ArrowLeftIcon,
  CalendarIcon,
  ChecklistIcon,
  HomeIcon,
  OrganizationIcon,
  PeopleIcon,
  ShieldIcon,
  SignOutIcon,
  ThreeBarsIcon,
  XIcon,
} from '@primer/octicons-react'
import { useAuth } from '../../hooks/useAuth'
import { usePageHead } from '../../hooks/usePageHead'
import { listAdminApplications } from '../../lib/admin-api'

export interface AdminBreadcrumb {
  label: string
  to?: string
  params?: Record<string, string>
}

interface AdminLayoutProps {
  children: React.ReactNode
  title: string
  subtitle?: string
  actions?: React.ReactNode
  breadcrumbs?: AdminBreadcrumb[]
}

export function AdminLayout({
  children,
  title,
  subtitle,
  actions,
  breadcrumbs,
}: AdminLayoutProps) {
  usePageHead({
    title: title ? `Admin — ${title}` : 'Admin Console',
    description: 'UmaKeiba Site & Event Administration.',
  })

  const { session, signOutUser } = useAuth()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number | null>(null)

  const isSiteAdmin = session?.user.siteRole === 'SITE_ADMIN'

  const authHeader = useMemo(() => {
    const token = session?.session.token
    return token ? `Bearer ${token}` : ''
  }, [session?.session.token])

  useEffect(() => {
    if (!authHeader) return
    let cancelled = false
    listAdminApplications(authHeader)
      .then((res) => {
        if (cancelled) return
        const count = (res.organizations?.length ?? 0) + (res.teams?.length ?? 0)
        setPendingApprovalsCount(count)
      })
      .catch(() => {
        // non-fatal sidebar counter fetch
      })
    return () => {
      cancelled = true
    }
  }, [authHeader, pathname])

  useEffect(() => {
    setMobileNavOpen(false)
  }, [pathname])

  const isCurrent = (path: string) => {
    if (path === '/admin') {
      return pathname === '/admin' || pathname === '/admin/'
    }
    return pathname.startsWith(path)
  }

  const navContent = (
    <NavList aria-label="Admin Console Navigation">
      <NavList.Group title="General">
        <NavList.Item
          as={Link}
          to="/admin"
          aria-current={isCurrent('/admin') ? 'page' : undefined}
        >
          <NavList.LeadingVisual>
            <HomeIcon />
          </NavList.LeadingVisual>
          Overview
        </NavList.Item>

        <NavList.Item
          as={Link}
          to="/admin/events"
          aria-current={isCurrent('/admin/events') ? 'page' : undefined}
        >
          <NavList.LeadingVisual>
            <CalendarIcon />
          </NavList.LeadingVisual>
          Events &amp; Races
        </NavList.Item>

        <NavList.Item
          as={Link}
          to="/admin/approvals"
          aria-current={isCurrent('/admin/approvals') ? 'page' : undefined}
        >
          <NavList.LeadingVisual>
            <ChecklistIcon />
          </NavList.LeadingVisual>
          Approvals Queue
          {pendingApprovalsCount !== null && pendingApprovalsCount > 0 && (
            <NavList.TrailingVisual>
              <CounterLabel scheme="primary">{pendingApprovalsCount}</CounterLabel>
            </NavList.TrailingVisual>
          )}
        </NavList.Item>
      </NavList.Group>

      <NavList.Divider />

      <NavList.Group title="Directory & Access">
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

        {isSiteAdmin && (
          <>
            <NavList.Item
              as={Link}
              to="/admin/organizations"
              aria-current={isCurrent('/admin/organizations') ? 'page' : undefined}
            >
              <NavList.LeadingVisual>
                <OrganizationIcon />
              </NavList.LeadingVisual>
              Organizations
            </NavList.Item>

            <NavList.Item
              as={Link}
              to="/admin/teams"
              aria-current={isCurrent('/admin/teams') ? 'page' : undefined}
            >
              <NavList.LeadingVisual>
                <ShieldIcon />
              </NavList.LeadingVisual>
              Teams
            </NavList.Item>
          </>
        )}
      </NavList.Group>

      <NavList.Divider />

      <NavList.Item as={Link} to="/">
        <NavList.LeadingVisual>
          <ArrowLeftIcon />
        </NavList.LeadingVisual>
        Back to Portal
      </NavList.Item>
    </NavList>
  )

  return (
    <ThemeProvider colorMode="day">
      <BaseStyles>
        <div className="primer-admin-scope" data-color-mode="light" data-light-theme="light">
          {/* Compact GitHub-style Top Application Header */}
          <header
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 30,
              backgroundColor: 'var(--bgColor-default, #ffffff)',
              borderBottom: '1px solid var(--borderColor-default, #d0d7de)',
            }}
          >
            <div
              style={{
                maxWidth: '1440px',
                margin: '0 auto',
                padding: '10px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                <div className="md:hidden">
                  <IconButton
                    aria-label={mobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
                    icon={mobileNavOpen ? XIcon : ThreeBarsIcon}
                    variant="invisible"
                    size="small"
                    onClick={() => setMobileNavOpen((prev) => !prev)}
                  />
                </div>

                <Link
                  to="/admin"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '10px',
                    textDecoration: 'none',
                    color: 'var(--fgColor-default, #1f2328)',
                  }}
                >
                  <img
                    src="/favicon.png"
                    alt="Lightwing"
                    style={{ width: '24px', height: '24px', borderRadius: '4px' }}
                  />
                  <span style={{ fontWeight: 600, fontSize: '15px', letterSpacing: '-0.01em' }}>
                    Lightwing
                  </span>
                  <span style={{ color: 'var(--fgColor-muted, #636c76)', fontWeight: 400 }}>/</span>
                  <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--fgColor-default, #1f2328)' }}>
                    Admin Console
                  </span>
                </Link>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <Link to="/" style={{ textDecoration: 'none' }} className="hidden sm:inline-flex">
                  <Button variant="invisible" size="small" leadingVisual={ArrowLeftIcon}>
                    Portal
                  </Button>
                </Link>

                {session ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        backgroundColor: 'var(--bgColor-muted, #f6f8fa)',
                        border: '1px solid var(--borderColor-muted, #d8dee4)',
                      }}
                    >
                      <Avatar
                        src={session.user.image || '/fallback_avatar.jpg'}
                        size={20}
                        alt={session.user.vrchatUsername ?? session.user.name}
                      />
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          color: 'var(--fgColor-default, #1f2328)',
                          maxWidth: '140px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {session.user.vrchatUsername ?? session.user.name}
                      </span>
                      <Label
                        variant={isSiteAdmin ? 'accent' : 'secondary'}
                        size="small"
                      >
                        {session.user.siteRole}
                      </Label>
                    </div>
                    <Button
                      type="button"
                      size="small"
                      leadingVisual={SignOutIcon}
                      onClick={() => void signOutUser('/')}
                    >
                      Sign Out
                    </Button>
                  </div>
                ) : (
                  <span style={{ fontSize: '12px', color: 'var(--fgColor-muted, #636c76)' }}>
                    Not signed in
                  </span>
                )}
              </div>
            </div>

            {/* Mobile Collapsible Navigation */}
            {mobileNavOpen && (
              <div
                className="md:hidden"
                style={{
                  borderTop: '1px solid var(--borderColor-default, #d0d7de)',
                  backgroundColor: 'var(--bgColor-default, #ffffff)',
                  padding: '8px 12px 16px 12px',
                }}
              >
                {navContent}
              </div>
            )}
          </header>

          {/* Primer PageLayout: Sticky Left NavList Sidebar + Main Workspace */}
          <div style={{ maxWidth: '1440px', margin: '0 auto' }}>
            <PageLayout containerWidth="full" padding="normal" columnGap="normal">
              <PageLayout.Pane
                position="start"
                sticky
                width="small"
                divider="line"
                hidden={{ narrow: true }}
              >
                <div style={{ paddingTop: '4px' }}>{navContent}</div>
              </PageLayout.Pane>

              <PageLayout.Content width="full">
                {/* Optional Breadcrumbs */}
                {breadcrumbs && breadcrumbs.length > 0 && (
                  <div style={{ marginBottom: '8px' }}>
                    <Breadcrumbs>
                      {breadcrumbs.map((crumb, idx) => {
                        const isLast = idx === breadcrumbs.length - 1
                        if (isLast || !crumb.to) {
                          return (
                            <Breadcrumbs.Item key={crumb.label} selected={isLast}>
                              {crumb.label}
                            </Breadcrumbs.Item>
                          )
                        }
                        return (
                          <Breadcrumbs.Item
                            key={crumb.label}
                            as={Link}
                            to={crumb.to as any}
                            params={crumb.params as any}
                          >
                            {crumb.label}
                          </Breadcrumbs.Item>
                        )
                      })}
                    </Breadcrumbs>
                  </div>
                )}

                {/* GitHub Settings-style Page Header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '16px',
                    flexWrap: 'wrap',
                    paddingBottom: '16px',
                    marginBottom: '20px',
                    borderBottom: '1px solid var(--borderColor-default, #d0d7de)',
                  }}
                >
                  <div style={{ minWidth: 0, flex: '1 1 300px' }}>
                    <h1
                      style={{
                        margin: 0,
                        fontSize: '22px',
                        fontWeight: 600,
                        lineHeight: 1.25,
                        color: 'var(--fgColor-default, #1f2328)',
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {title}
                    </h1>
                    {subtitle && (
                      <p
                        style={{
                          margin: '6px 0 0 0',
                          fontSize: '14px',
                          color: 'var(--fgColor-muted, #636c76)',
                          lineHeight: 1.5,
                        }}
                      >
                        {subtitle}
                      </p>
                    )}
                  </div>

                  {actions && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        flexWrap: 'wrap',
                        flexShrink: 0,
                      }}
                    >
                      {actions}
                    </div>
                  )}
                </div>

                {/* Page Content */}
                <div style={{ paddingBottom: '48px' }}>{children}</div>
              </PageLayout.Content>
            </PageLayout>
          </div>
        </div>
      </BaseStyles>
    </ThemeProvider>
  )
}
