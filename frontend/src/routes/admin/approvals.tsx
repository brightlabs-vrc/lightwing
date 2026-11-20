import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { Button, CounterLabel, Label, UnderlineNav } from '@primer/react'
import { CheckIcon, OrganizationIcon, ShieldIcon, SyncIcon, XIcon } from '@primer/octicons-react'
import { useAuth } from '../../hooks/useAuth'
import { requireAdminPanel } from '../../lib/auth-guard'
import { AdminLayout } from './-AdminLayout'
import { listAdminApplications, reviewAdminApplication } from '../../lib/admin-api'
import { AlertBanner } from '../../components/AlertBanner'
import { PrimerSkeletonList } from '../../components/LoadingSkeleton'
import type { teammanager } from '../../lib/client'

export const Route = createFileRoute('/admin/approvals')({
  beforeLoad: async ({ location }) => {
    await requireAdminPanel(location)
  },
  component: AdminApprovalsPage,
})

type QueueFilter = 'ALL' | 'ORGANIZATIONS' | 'TEAMS'

function AdminApprovalsPage() {
  const { session } = useAuth()
  const [orgApps, setOrgApps] = useState<teammanager.OrgApplicationView[]>([])
  const [teamApps, setTeamApps] = useState<teammanager.TeamApplicationView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<QueueFilter>('ALL')

  const isSiteAdmin = session?.user.siteRole === 'SITE_ADMIN'

  const authHeader = useMemo(() => {
    const token = session?.session.token
    return token ? `Bearer ${token}` : ''
  }, [session?.session.token])

  async function fetchApplications() {
    setLoading(true)
    setError(null)
    try {
      const res = await listAdminApplications(authHeader)
      setOrgApps(res.organizations || [])
      setTeamApps(res.teams || [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load pending applications queue')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchApplications()
  }, [authHeader])

  const handleReview = async (id: string, type: 'ORGANIZATION' | 'TEAM', action: 'APPROVE' | 'REJECT') => {
    setReviewingId(id)
    setError(null)
    setSuccess(null)
    try {
      await reviewAdminApplication(id, type, action, authHeader)
      setSuccess(`Application ${action === 'APPROVE' ? 'approved' : 'rejected'} successfully.`)
      void fetchApplications()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to review application')
    } finally {
      setReviewingId(null)
    }
  }

  const totalPending = (isSiteAdmin ? orgApps.length : 0) + teamApps.length

  return (
    <AdminLayout
      title="Application Approvals Queue"
      subtitle="Review and act on pending organization and competitive team registration requests."
      breadcrumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Approvals' }]}
      actions={
        <Button type="button" leadingVisual={SyncIcon} onClick={() => void fetchApplications()} disabled={loading}>
          Refresh Queue
        </Button>
      }
    >
      {error && <AlertBanner variant="error">{error}</AlertBanner>}
      {success && <AlertBanner variant="success">{success}</AlertBanner>}

      <div style={{ marginBottom: '20px' }}>
        <UnderlineNav aria-label="Approvals Queue Filter">
          <UnderlineNav.Item
            aria-current={filter === 'ALL' ? 'page' : undefined}
            counter={totalPending}
            onSelect={(e) => {
              e.preventDefault()
              setFilter('ALL')
            }}
          >
            All Pending
          </UnderlineNav.Item>
          {isSiteAdmin && (
            <UnderlineNav.Item
              aria-current={filter === 'ORGANIZATIONS' ? 'page' : undefined}
              icon={OrganizationIcon}
              counter={orgApps.length}
              onSelect={(e) => {
                e.preventDefault()
                setFilter('ORGANIZATIONS')
              }}
            >
              Organizations
            </UnderlineNav.Item>
          )}
          <UnderlineNav.Item
            aria-current={filter === 'TEAMS' ? 'page' : undefined}
            icon={ShieldIcon}
            counter={teamApps.length}
            onSelect={(e) => {
              e.preventDefault()
              setFilter('TEAMS')
            }}
          >
            Competitive Teams
          </UnderlineNav.Item>
        </UnderlineNav>
      </div>

      {loading ? (
        <PrimerSkeletonList count={3} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Organization Applications (SITE_ADMIN only) */}
          {isSiteAdmin && (filter === 'ALL' || filter === 'ORGANIZATIONS') && (
            <section className="primer-box">
              <div className="primer-box-header" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <OrganizationIcon size={16} />
                <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Pending Organization Applications</h2>
                <CounterLabel>{orgApps.length}</CounterLabel>
              </div>

              {orgApps.length === 0 ? (
                <p style={{ margin: 0, padding: '20px 16px', fontSize: '13px', color: 'var(--fgColor-muted, #636c76)' }}>
                  No pending organization applications in queue.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {orgApps.map((app, idx) => (
                    <div
                      key={app.id}
                      style={{
                        padding: '16px',
                        borderTop: idx === 0 ? 'none' : '1px solid var(--borderColor-muted, #d8dee4)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '16px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ flex: '1 1 320px', minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>{app.name}</h3>
                          <Label variant="accent" size="small">{app.orgType}</Label>
                          <span style={{ fontSize: '12px', color: 'var(--fgColor-muted, #636c76)' }}>@{app.slug}</span>
                        </div>
                        <div style={{ marginTop: '8px', fontSize: '13px', display: 'flex', gap: '16px', flexWrap: 'wrap', color: 'var(--fgColor-default, #1f2328)' }}>
                          <span><strong>Discord Invite:</strong> {app.discordInvite}</span>
                          <span><strong>VRChat Group ID:</strong> <code>{app.vrchatGroupId}</code></span>
                        </div>
                        {app.members && app.members.length > 0 && (
                          <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--fgColor-muted, #636c76)' }}>
                            <strong>Staff Roster ({app.members.length}):</strong> {app.members.map((m) => m.name).join(', ')}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                        <Button
                          type="button"
                          variant="primary"
                          size="small"
                          leadingVisual={CheckIcon}
                          disabled={reviewingId === app.id}
                          onClick={() => void handleReview(app.id, 'ORGANIZATION', 'APPROVE')}
                        >
                          Approve
                        </Button>
                        <Button
                          type="button"
                          variant="danger"
                          size="small"
                          leadingVisual={XIcon}
                          disabled={reviewingId === app.id}
                          onClick={() => void handleReview(app.id, 'ORGANIZATION', 'REJECT')}
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Team Applications (SITE_ADMIN and EVENT_ADMIN) */}
          {(filter === 'ALL' || filter === 'TEAMS') && (
            <section className="primer-box">
              <div className="primer-box-header" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldIcon size={16} />
                <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Pending Competitive Team Applications</h2>
                <CounterLabel>{teamApps.length}</CounterLabel>
              </div>

              {teamApps.length === 0 ? (
                <p style={{ margin: 0, padding: '20px 16px', fontSize: '13px', color: 'var(--fgColor-muted, #636c76)' }}>
                  No pending team applications in queue.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {teamApps.map((app, idx) => (
                    <div
                      key={app.id}
                      style={{
                        padding: '16px',
                        borderTop: idx === 0 ? 'none' : '1px solid var(--borderColor-muted, #d8dee4)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '16px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ flex: '1 1 320px', minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>{app.name}</h3>
                          <span style={{ fontSize: '12px', color: 'var(--fgColor-muted, #636c76)' }}>@{app.slug}</span>
                        </div>
                        <div style={{ marginTop: '8px', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div>
                            <strong>Primary Organization:</strong> {app.primaryOrganization.name} (@{app.primaryOrganization.slug})
                          </div>
                          {app.secondaryOrganizations && app.secondaryOrganizations.length > 0 && (
                            <div>
                              <strong>Secondary Organizations:</strong> {app.secondaryOrganizations.map((s) => s.name).join(', ')}
                            </div>
                          )}
                          {app.members && app.members.length > 0 && (
                            <div style={{ fontSize: '12px', color: 'var(--fgColor-muted, #636c76)' }}>
                              <strong>Preliminary Roster ({app.members.length}):</strong> {app.members.map((m) => m.name).join(', ')}
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                        <Button
                          type="button"
                          variant="primary"
                          size="small"
                          leadingVisual={CheckIcon}
                          disabled={reviewingId === app.id}
                          onClick={() => void handleReview(app.id, 'TEAM', 'APPROVE')}
                        >
                          Approve
                        </Button>
                        <Button
                          type="button"
                          variant="danger"
                          size="small"
                          leadingVisual={XIcon}
                          disabled={reviewingId === app.id}
                          onClick={() => void handleReview(app.id, 'TEAM', 'REJECT')}
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </AdminLayout>
  )
}
