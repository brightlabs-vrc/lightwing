import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { requireAdminPanel } from '../../lib/auth-guard'
import { AdminLayout } from './-AdminLayout'
import { listAdminApplications, reviewAdminApplication } from '../../lib/admin-api'
import { AlertBanner } from '../../components/AlertBanner'
import type { teammanager } from '../../lib/client'

export const Route = createFileRoute('/admin/approvals')({
  beforeLoad: async ({ location }) => {
    await requireAdminPanel(location)
  },
  component: AdminApprovalsPage,
})

function AdminApprovalsPage() {
  const { session } = useAuth()
  const [orgApps, setOrgApps] = useState<teammanager.OrgApplicationView[]>([])
  const [teamApps, setTeamApps] = useState<teammanager.TeamApplicationView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [reviewingId, setReviewingId] = useState<string | null>(null)

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

  return (
    <AdminLayout
      title="Application Approvals Queue"
      subtitle="Review pending organization and competitive team registration applications."
      actions={
        <button
          type="button"
          onClick={() => void fetchApplications()}
          className="slds-button slds-button_neutral"
        >
          Refresh Queue
        </button>
      }
    >
      {error && (
        <div className="slds-m-bottom_medium">
          <AlertBanner variant="error">{error}</AlertBanner>
        </div>
      )}
      {success && (
        <div className="slds-m-bottom_medium">
          <AlertBanner variant="success">{success}</AlertBanner>
        </div>
      )}

      {loading ? (
        <p className="text-slate-500">Loading pending applications queue...</p>
      ) : (
        <div className="slds-grid slds-wrap slds-gutters" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Organization Applications Section (SITE_ADMIN only) */}
          {isSiteAdmin && (
            <div className="slds-col slds-size_1-of-1">
              <article className="slds-card" style={{ border: '1px solid #dddbda', borderRadius: '6px', background: '#fff', padding: '1.25rem' }}>
                <div className="slds-card__header slds-m-bottom_medium">
                  <h2 className="slds-text-heading_small font-bold" style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                    🏢 Pending Organization Applications ({orgApps.length})
                  </h2>
                </div>

                {orgApps.length === 0 ? (
                  <p className="text-slate-500 text-sm">No pending organization applications in queue.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {orgApps.map((app) => (
                      <div key={app.id} className="slds-box bg-slate-50" style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '1rem', background: '#f8fafc' }}>
                        <div className="slds-grid slds-grid_align-spread" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <h3 className="text-lg font-bold text-slate-900" style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{app.name}</h3>
                            <p className="text-xs text-slate-500" style={{ fontSize: '12px', color: '#64748b' }}>Slug: @{app.slug} | Type: {app.orgType}</p>
                            <div className="slds-m-top_x-small" style={{ fontSize: '13px', display: 'flex', gap: '16px', marginTop: '6px' }}>
                              <span><strong>Discord Invite:</strong> {app.discordInvite}</span>
                              <span><strong>VRChat Group ID:</strong> {app.vrchatGroupId}</span>
                            </div>
                            {app.members && app.members.length > 0 && (
                              <p className="text-xs text-slate-600 slds-m-top_x-small" style={{ fontSize: '12px', marginTop: '4px' }}>
                                <strong>Staff Roster ({app.members.length}):</strong> {app.members.map((m) => m.name).join(', ')}
                              </p>
                            )}
                          </div>

                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              type="button"
                              disabled={reviewingId === app.id}
                              onClick={() => void handleReview(app.id, 'ORGANIZATION', 'APPROVE')}
                              className="slds-button slds-button_brand"
                              style={{ padding: '4px 12px', fontSize: '12px' }}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={reviewingId === app.id}
                              onClick={() => void handleReview(app.id, 'ORGANIZATION', 'REJECT')}
                              className="slds-button slds-button_destructive"
                              style={{ padding: '4px 12px', fontSize: '12px' }}
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            </div>
          )}

          {/* Team Applications Section (SITE_ADMIN and EVENT_ADMIN) */}
          <div className="slds-col slds-size_1-of-1">
            <article className="slds-card" style={{ border: '1px solid #dddbda', borderRadius: '6px', background: '#fff', padding: '1.25rem' }}>
              <div className="slds-card__header slds-m-bottom_medium">
                <h2 className="slds-text-heading_small font-bold" style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                  🏁 Pending Competitive Team Applications ({teamApps.length})
                </h2>
              </div>

              {teamApps.length === 0 ? (
                <p className="text-slate-500 text-sm">No pending team applications in queue.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {teamApps.map((app) => (
                    <div key={app.id} className="slds-box bg-slate-50" style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '1rem', background: '#f8fafc' }}>
                      <div className="slds-grid slds-grid_align-spread" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <h3 className="text-lg font-bold text-slate-900" style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{app.name}</h3>
                          <p className="text-xs text-slate-500" style={{ fontSize: '12px', color: '#64748b' }}>Slug: @{app.slug}</p>
                          <div className="slds-m-top_x-small" style={{ fontSize: '13px', marginTop: '6px' }}>
                            <p>
                              <strong>Primary Organization:</strong> {app.primaryOrganization.name} (@{app.primaryOrganization.slug})
                            </p>
                            {app.secondaryOrganizations && app.secondaryOrganizations.length > 0 && (
                              <p style={{ marginTop: '2px' }}>
                                <strong>Secondary Organizations:</strong> {app.secondaryOrganizations.map((s) => s.name).join(', ')}
                              </p>
                            )}
                            {app.members && app.members.length > 0 && (
                              <p style={{ marginTop: '2px' }}>
                                <strong>Preliminary Roster ({app.members.length}):</strong> {app.members.map((m) => m.name).join(', ')}
                              </p>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            disabled={reviewingId === app.id}
                            onClick={() => void handleReview(app.id, 'TEAM', 'APPROVE')}
                            className="slds-button slds-button_brand"
                            style={{ padding: '4px 12px', fontSize: '12px' }}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={reviewingId === app.id}
                            onClick={() => void handleReview(app.id, 'TEAM', 'REJECT')}
                            className="slds-button slds-button_destructive"
                            style={{ padding: '4px 12px', fontSize: '12px' }}
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
