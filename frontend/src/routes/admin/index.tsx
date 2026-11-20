import { useEffect, useMemo, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { Avatar, Button, CounterLabel, Flash, Label } from '@primer/react'
import {
  ArrowRightIcon,
  CalendarIcon,
  CheckIcon,
  ChecklistIcon,
  GraphIcon,
  OrganizationIcon,
  PeopleIcon,
  ShieldIcon,
  SyncIcon,
  XIcon,
} from '@primer/octicons-react'
import { useAuth } from '../../hooks/useAuth'
import { requireAdminPanel } from '../../lib/auth-guard'
import {
  listAdminApplications,
  listAdminEvents,
  listAdminOrganizations,
  listAdminTeams,
  listAdminUsers,
  recalculateRatings,
  reviewAdminApplication,
} from '../../lib/admin-api'
import { AdminLayout } from './-AdminLayout'
import type { eventmanager, teammanager } from '../../lib/client'

export const Route = createFileRoute('/admin/')({
  beforeLoad: async ({ location }) => {
    await requireAdminPanel(location)
  },
  component: AdminPage,
})

function eventStatusVariant(status: string): 'success' | 'accent' | 'danger' | 'secondary' | 'attention' {
  switch (status) {
    case 'ONGOING':
      return 'success'
    case 'PENDING':
      return 'accent'
    case 'PENDING_DELETION':
      return 'danger'
    case 'DRAFT':
      return 'attention'
    default:
      return 'secondary'
  }
}

function AdminPage() {
  const { session } = useAuth()
  const isSiteAdmin = session?.user.siteRole === 'SITE_ADMIN'
  const authHeader = useMemo(() => {
    const token = session?.session.token
    return token ? `Bearer ${token}` : ''
  }, [session?.session.token])

  const [loadingMetrics, setLoadingMetrics] = useState(true)
  const [totalEvents, setTotalEvents] = useState(0)
  const [recentEvents, setRecentEvents] = useState<eventmanager.EventListItem[]>([])
  const [totalUsers, setTotalUsers] = useState<number | null>(null)
  const [totalOrgs, setTotalOrgs] = useState<number | null>(null)
  const [totalTeams, setTotalTeams] = useState<number | null>(null)
  const [pendingOrgs, setPendingOrgs] = useState<teammanager.OrgApplicationView[]>([])
  const [pendingTeams, setPendingTeams] = useState<teammanager.TeamApplicationView[]>([])
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [reviewNotice, setReviewNotice] = useState<string | null>(null)

  const [recalcLoading, setRecalcLoading] = useState(false)
  const [recalcMessage, setRecalcMessage] = useState<string | null>(null)
  const [recalcError, setRecalcError] = useState<string | null>(null)

  async function loadDashboard() {
    setLoadingMetrics(true)
    try {
      const [eventsRes, appsRes] = await Promise.all([
        listAdminEvents(undefined, undefined, 6, 0),
        authHeader
          ? listAdminApplications(authHeader).catch(() => ({ organizations: [], teams: [] }))
          : Promise.resolve({ organizations: [], teams: [] }),
      ])
      setTotalEvents(eventsRes.total)
      setRecentEvents(eventsRes.events)
      setPendingOrgs(appsRes.organizations ?? [])
      setPendingTeams(appsRes.teams ?? [])

      if (isSiteAdmin && authHeader) {
        const [usersRes, orgsRes, teamsRes] = await Promise.all([
          listAdminUsers(authHeader, '', 1, 0).catch(() => ({ users: [], total: 0 })),
          listAdminOrganizations('', 1, 0).catch(() => ({ organizations: [], total: 0 })),
          listAdminTeams('', 1, 0).catch(() => ({ teams: [], total: 0 })),
        ])
        setTotalUsers(usersRes.total)
        setTotalOrgs(orgsRes.total)
        setTotalTeams(teamsRes.total)
      }
    } finally {
      setLoadingMetrics(false)
    }
  }

  useEffect(() => {
    void loadDashboard()
  }, [authHeader, isSiteAdmin])

  const handleQuickReview = async (id: string, type: 'ORGANIZATION' | 'TEAM', action: 'APPROVE' | 'REJECT') => {
    if (!authHeader) return
    setReviewingId(id)
    setReviewNotice(null)
    try {
      await reviewAdminApplication(id, type, action, authHeader)
      setReviewNotice(`Application ${action === 'APPROVE' ? 'approved' : 'rejected'}.`)
      await loadDashboard()
    } finally {
      setReviewingId(null)
    }
  }

  const handleRecalculateRatings = async () => {
    if (!authHeader) return
    try {
      setRecalcLoading(true)
      setRecalcMessage(null)
      setRecalcError(null)
      const res = await recalculateRatings(authHeader)
      setRecalcMessage(
        `Backfill complete: ${res.racesProcessed} races processed, ${res.resultsUpdated} results updated across ${res.usersRated} users.`,
      )
    } catch (err: any) {
      setRecalcError(err?.message || 'Failed to recalculate ratings')
    } finally {
      setRecalcLoading(false)
    }
  }

  const pendingTotal = (isSiteAdmin ? pendingOrgs.length : 0) + pendingTeams.length

  const statCards = [
    {
      label: 'Competition Events',
      value: loadingMetrics ? '—' : String(totalEvents),
      icon: CalendarIcon,
      to: '/admin/events',
      highlight: false,
    },
    {
      label: 'Pending Approvals',
      value: loadingMetrics ? '—' : String(pendingTotal),
      icon: ChecklistIcon,
      to: '/admin/approvals',
      highlight: pendingTotal > 0,
    },
    ...(isSiteAdmin
      ? [
          {
            label: 'Registered Users',
            value: loadingMetrics || totalUsers === null ? '—' : String(totalUsers),
            icon: PeopleIcon,
            to: '/admin/users',
            highlight: false,
          },
          {
            label: 'Organizations',
            value: loadingMetrics || totalOrgs === null ? '—' : String(totalOrgs),
            icon: OrganizationIcon,
            to: '/admin/organizations',
            highlight: false,
          },
          {
            label: 'Competitive Teams',
            value: loadingMetrics || totalTeams === null ? '—' : String(totalTeams),
            icon: ShieldIcon,
            to: '/admin/teams',
            highlight: false,
          },
        ]
      : []),
  ]

  return (
    <AdminLayout
      title="Overview"
      subtitle="Platform health, pending approvals, recent competition events, and system maintenance tools."
      actions={
        <Button type="button" leadingVisual={SyncIcon} onClick={() => void loadDashboard()} disabled={loadingMetrics}>
          Refresh
        </Button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Live Metric Summary Row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px',
          }}
        >
          {statCards.map((card) => {
            const Icon = card.icon
            return (
              <Link
                key={card.label}
                to={card.to as any}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div
                  className="primer-box"
                  style={{
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    borderColor: card.highlight ? 'var(--borderColor-attention-emphasis, #9a6700)' : undefined,
                    backgroundColor: card.highlight ? 'var(--bgColor-attention-muted, #fff8c5)' : undefined,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--fgColor-muted, #636c76)' }}>
                    <span style={{ fontSize: '12px', fontWeight: 500 }}>{card.label}</span>
                    <Icon size={16} />
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--fgColor-default, #1f2328)', lineHeight: 1.2 }}>
                    {card.value}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        {/* Two-Column Operations Workspace */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '20px',
            alignItems: 'start',
          }}
        >
          {/* Main Column (Spans wider on desktop) */}
          <div style={{ gridColumn: 'span 1', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Pending Approvals Quick Queue */}
            <section className="primer-box">
              <div
                className="primer-box-header"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ChecklistIcon size={16} />
                  <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Pending Approvals Queue</h2>
                  <CounterLabel>{pendingTotal}</CounterLabel>
                </div>
                <Link to="/admin/approvals" style={{ fontSize: '12px', color: 'var(--fgColor-accent, #0969da)', textDecoration: 'none', fontWeight: 500 }}>
                  View all <ArrowRightIcon size={12} />
                </Link>
              </div>

              <div style={{ padding: '12px 16px' }}>
                {reviewNotice && (
                  <Flash variant="success" style={{ marginBottom: '12px', fontSize: '12px' }}>
                    {reviewNotice}
                  </Flash>
                )}

                {pendingTotal === 0 ? (
                  <p style={{ margin: '8px 0', fontSize: '13px', color: 'var(--fgColor-muted, #636c76)' }}>
                    All caught up — there are no pending organization or team applications awaiting review.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {isSiteAdmin &&
                      pendingOrgs.slice(0, 3).map((app) => (
                        <div
                          key={app.id}
                          style={{
                            padding: '10px 12px',
                            border: '1px solid var(--borderColor-muted, #d8dee4)',
                            borderRadius: '6px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '12px',
                            flexWrap: 'wrap',
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <strong style={{ fontSize: '13px' }}>{app.name}</strong>
                              <Label variant="accent" size="small">ORG</Label>
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--fgColor-muted, #636c76)' }}>
                              @{app.slug} · {app.members?.length ?? 0} staff
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <Button
                              size="small"
                              variant="primary"
                              leadingVisual={CheckIcon}
                              disabled={reviewingId === app.id}
                              onClick={() => void handleQuickReview(app.id, 'ORGANIZATION', 'APPROVE')}
                            >
                              Approve
                            </Button>
                            <Button
                              size="small"
                              variant="danger"
                              leadingVisual={XIcon}
                              disabled={reviewingId === app.id}
                              onClick={() => void handleQuickReview(app.id, 'ORGANIZATION', 'REJECT')}
                            >
                              Reject
                            </Button>
                          </div>
                        </div>
                      ))}

                    {pendingTeams.slice(0, 3).map((app) => (
                      <div
                        key={app.id}
                        style={{
                          padding: '10px 12px',
                          border: '1px solid var(--borderColor-muted, #d8dee4)',
                          borderRadius: '6px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '12px',
                          flexWrap: 'wrap',
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <strong style={{ fontSize: '13px' }}>{app.name}</strong>
                            <Label variant="secondary" size="small">TEAM</Label>
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--fgColor-muted, #636c76)' }}>
                            @{app.slug} · Primary: {app.primaryOrganization.name}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <Button
                            size="small"
                            variant="primary"
                            leadingVisual={CheckIcon}
                            disabled={reviewingId === app.id}
                            onClick={() => void handleQuickReview(app.id, 'TEAM', 'APPROVE')}
                          >
                            Approve
                          </Button>
                          <Button
                            size="small"
                            variant="danger"
                            leadingVisual={XIcon}
                            disabled={reviewingId === app.id}
                            onClick={() => void handleQuickReview(app.id, 'TEAM', 'REJECT')}
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Recent Competition Events */}
            <section className="primer-box">
              <div
                className="primer-box-header"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CalendarIcon size={16} />
                  <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Recent Events</h2>
                </div>
                <Link to="/admin/events" style={{ fontSize: '12px', color: 'var(--fgColor-accent, #0969da)', textDecoration: 'none', fontWeight: 500 }}>
                  Manage events <ArrowRightIcon size={12} />
                </Link>
              </div>

              {recentEvents.length === 0 ? (
                <p style={{ margin: 0, padding: '16px', fontSize: '13px', color: 'var(--fgColor-muted, #636c76)' }}>
                  {loadingMetrics ? 'Loading events...' : 'No active events found.'}
                </p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="primer-table">
                    <thead>
                      <tr>
                        <th>Event</th>
                        <th style={{ width: '110px' }}>Status</th>
                        <th style={{ width: '90px' }}>Races</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentEvents.map((evt) => (
                        <tr key={evt.id}>
                          <td>
                            <Link
                              to="/admin/events/$eventId"
                              params={{ eventId: evt.id }}
                              style={{ fontWeight: 600, color: 'var(--fgColor-accent, #0969da)', textDecoration: 'none' }}
                            >
                              {evt.name}
                            </Link>
                            <div style={{ fontSize: '11px', color: 'var(--fgColor-muted, #636c76)' }}>
                              {evt.scoringTypeLabel} · {evt.tag || 'OFFICIAL'}
                            </div>
                          </td>
                          <td>
                            <Label variant={eventStatusVariant(evt.status)} size="small">
                              {evt.status}
                            </Label>
                          </td>
                          <td style={{ color: 'var(--fgColor-muted, #636c76)' }}>{evt.raceCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          {/* Right Column: Active Session & Maintenance */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Active Session */}
            <section className="primer-box">
              <div className="primer-box-header">
                <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Active Administrator Session</h2>
              </div>
              <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                <Avatar
                  src={session?.user.image || '/fallback_avatar.jpg'}
                  size={44}
                  alt={session?.user.vrchatUsername ?? session?.user.name ?? 'Admin'}
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--fgColor-default, #1f2328)' }}>
                    {session?.user.vrchatUsername ?? session?.user.name}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--fgColor-muted, #636c76)', marginBottom: '6px' }}>
                    {session?.user.name}
                  </div>
                  <Label variant={isSiteAdmin ? 'accent' : 'secondary'}>
                    {session?.user.siteRole ?? 'SITE_ADMIN'}
                  </Label>
                </div>
              </div>
            </section>

            {/* Rating System Backfill (SITE_ADMIN only) */}
            {isSiteAdmin && (
              <section className="primer-box">
                <div className="primer-box-header" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <GraphIcon size={16} />
                  <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Rating System Backfill</h2>
                </div>
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--fgColor-muted, #636c76)', lineHeight: 1.5 }}>
                    Replay all historical race results chronologically using Glicko-2 to compute and persist participant ratings and per-race rating deltas.
                  </p>
                  {recalcMessage && (
                    <Flash variant="success" style={{ fontSize: '12px' }}>
                      {recalcMessage}
                    </Flash>
                  )}
                  {recalcError && (
                    <Flash variant="danger" style={{ fontSize: '12px' }}>
                      {recalcError}
                    </Flash>
                  )}
                  <div>
                    <Button
                      type="button"
                      variant="primary"
                      leadingVisual={SyncIcon}
                      onClick={() => void handleRecalculateRatings()}
                      disabled={recalcLoading}
                    >
                      {recalcLoading ? 'Recalculating Ratings...' : 'Recalculate All Ratings'}
                    </Button>
                  </div>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
