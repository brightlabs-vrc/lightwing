import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useAuth } from '../../../hooks/useAuth'
import { requireSiteAdmin } from '../../../lib/auth-guard'
import { getAdminUserProfile, updateAdminUserSiteRole } from '../../../lib/admin-api'
import { AdminLayout } from '../-AdminLayout'
import type { auth } from '../../../lib/client'

export const Route = createFileRoute('/admin/users/')({
  beforeLoad: async ({ location }) => {
    await requireSiteAdmin(location)
  },
  component: AdminUsersPage,
})

function AdminUsersPage() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const [selectedUserId, setSelectedUserId] = useState('')
  const [profile, setProfile] = useState<auth.UserProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [updatingRole, setUpdatingRole] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const authHeader = useMemo(() => {
    const token = session?.session.token
    return token ? `Bearer ${token}` : null
  }, [session?.session.token])

  const currentUserId = session?.user.id ?? ''

  const users = [
    {
      id: currentUserId,
      role: session?.user.siteRole ?? 'USER',
      label: `${session?.user.name ?? 'Current user'} (you)`,
    },
    {
      id: 'mock-user-1',
      role: 'USER',
      label: 'Thunder Bolt (Competitor)',
    },
    {
      id: 'mock-user-2',
      role: 'USER',
      label: 'Shadow Runner (Competitor)',
    },
    {
      id: 'mock-user-3',
      role: 'USER',
      label: 'Swift Galloper (Competitor)',
    },
  ].filter((user) => user.id)

  async function lookupUser() {
    if (!selectedUserId.trim()) {
      setError('Enter a user ID to continue.')
      setSuccess(null)
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const loaded = await getAdminUserProfile(selectedUserId.trim())
      setProfile(loaded)
    } catch (cause) {
      setProfile(null)
      setError(cause instanceof Error ? cause.message : 'Unable to fetch user profile')
    } finally {
      setLoading(false)
    }
  }

  async function setSiteRole(siteRole: auth.SiteRoleName) {
    if (!profile) {
      return
    }

    if (!authHeader) {
      setError('Missing auth session token. Re-authenticate from /auth and try again.')
      setSuccess(null)
      return
    }

    setUpdatingRole(true)
    setError(null)
    setSuccess(null)
    try {
      const updated = await updateAdminUserSiteRole(profile.id, siteRole, authHeader)
      setProfile(updated)
      setSuccess(`Successfully updated ${profile.name}'s role to ${siteRole}.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update site role')
    } finally {
      setUpdatingRole(false)
    }
  }

  return (
    <AdminLayout
      title="User Account Management"
      subtitle="Verify system competitor profiles, review active team memberships, and adjust administrative site roles."
    >
      <div className="slds-grid slds-wrap slds-gutters">
        {/* Quick access list cards */}
        <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-3 slds-m-bottom_medium">
          <article className="slds-card" style={{ border: '1px solid #dddbda', height: '100%' }}>
            <div className="slds-card__header slds-grid">
              <header className="slds-media slds-media_center slds-has-flexi-truncate">
                <div className="slds-media__figure" style={{ marginRight: '0.5rem' }}>
                  <span className="slds-icon_container slds-icon-standard-people" style={{ fontSize: '18px' }}>👥</span>
                </div>
                <div className="slds-media__body">
                  <h2 className="slds-card__header-title">
                    <span className="slds-card__header-link slds-truncate font-semibold" style={{ fontWeight: 'bold' }}>
                      Quick Access Users
                    </span>
                  </h2>
                </div>
              </header>
            </div>

            <div className="slds-card__body slds-card__body_inner">
              <p className="slds-text-body_small text-slate-500 slds-m-bottom_medium" style={{ fontSize: '12px' }}>
                Quickly jump to detailed profiling dashboards for active administrative or mock user records:
              </p>
              <ul className="slds-has-dividers_around-space" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {users.map((user) => (
                  <li key={user.id} className="slds-item" style={{ padding: '8px', border: '1px solid #dddbda', borderRadius: '4px', marginBottom: '6px', background: '#f8fafc' }}>
                    <div className="slds-grid slds-grid_align-spread" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() =>
                          navigate({
                            to: '/admin/users/$userId',
                            params: { userId: user.id },
                          })
                        }
                        className="font-bold text-blue-600 hover:underline"
                        style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', fontWeight: 'bold' }}
                      >
                        {user.label}
                      </button>
                      <span className="slds-badge slds-theme_light" style={{ fontSize: '10px', padding: '1px 6px' }}>
                        {user.role}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </article>
        </div>

        {/* User Lookup Controls */}
        <div className="slds-col slds-size_1-of-1 slds-medium-size_2-of-3 slds-m-bottom_medium">
          <article className="slds-card" style={{ border: '1px solid #dddbda', height: '100%' }}>
            <div className="slds-card__header slds-grid">
              <header className="slds-media slds-media_center slds-has-flexi-truncate">
                <div className="slds-media__figure" style={{ marginRight: '0.5rem' }}>
                  <span className="slds-icon_container slds-icon-standard-contact" style={{ fontSize: '18px' }}>🔍</span>
                </div>
                <div className="slds-media__body">
                  <h2 className="slds-card__header-title">
                    <span className="slds-card__header-link slds-truncate font-semibold" style={{ fontWeight: 'bold' }}>
                      Lookup & Access Controls
                    </span>
                  </h2>
                </div>
              </header>
            </div>

            <div className="slds-card__body slds-card__body_inner" style={{ padding: '1.5rem' }}>
              <div className="slds-form slds-m-bottom_large">
                <div className="slds-form-element">
                  <label className="slds-form-element__label font-bold text-slate-700" style={{ fontWeight: 'bold' }} htmlFor="user-lookup-input">
                    Query User by Unique Identifier
                  </label>
                  <div className="slds-form-element__control slds-grid" style={{ display: 'flex', gap: '8px' }}>
                    <input
                      id="user-lookup-input"
                      value={selectedUserId}
                      onChange={(evt) => setSelectedUserId(evt.target.value)}
                      placeholder="e.g. mock-admin-1 or mock-user-1"
                      className="slds-input"
                      style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px', flexGrow: 1 }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        void lookupUser()
                      }}
                      disabled={loading}
                      className="slds-button slds-button_brand"
                      style={{ padding: '6px 20px', height: '36px' }}
                    >
                      {loading ? 'Searching...' : 'Search Profile'}
                    </button>
                  </div>
                </div>
              </div>

              {error && (
                <div className="slds-notify slds-notify_alert slds-theme_alert-texture slds-theme_error slds-m-bottom_medium" role="alert" style={{ background: '#d32f2f', color: '#fff', padding: '8px 16px', borderRadius: '4px' }}>
                  <h2>{error}</h2>
                </div>
              )}
              {success && (
                <div className="slds-notify slds-notify_alert slds-theme_alert-texture slds-theme_info slds-m-bottom_medium" role="alert" style={{ background: '#2e7d32', color: '#fff', padding: '8px 16px', borderRadius: '4px' }}>
                  <h2>{success}</h2>
                </div>
              )}

              {profile ? (
                <div className="slds-box slds-theme_shade" style={{ background: '#f3f2f1', border: '1px solid #dddbda', borderRadius: '4px', padding: '1.5rem' }}>
                  <h3 className="slds-text-heading_small font-bold slds-m-bottom_medium text-slate-900" style={{ fontWeight: 'bold', borderBottom: '1px solid #dddbda', paddingBottom: '6px' }}>
                    Account Profile Results
                  </h3>

                  <div className="slds-grid slds-wrap slds-gutters slds-m-bottom_large">
                    <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-m-bottom_small">
                      <p className="slds-text-title text-slate-500" style={{ fontSize: '11px', textTransform: 'uppercase' }}>Full Name</p>
                      <p className="slds-text-body_regular font-bold" style={{ fontWeight: 'bold' }}>{profile.name}</p>
                    </div>
                    <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-m-bottom_small">
                      <p className="slds-text-title text-slate-500" style={{ fontSize: '11px', textTransform: 'uppercase' }}>Email Address</p>
                      <p className="slds-text-body_regular">{profile.email}</p>
                    </div>
                    <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-m-bottom_small">
                      <p className="slds-text-title text-slate-500" style={{ fontSize: '11px', textTransform: 'uppercase' }}>Global Site Role</p>
                      <span className={`slds-badge ${profile.siteRole === 'SITE_ADMIN' ? 'slds-theme_success' : 'slds-theme_light'}`} style={{ padding: '2px 8px', borderRadius: '4px', background: profile.siteRole === 'SITE_ADMIN' ? '#2e7d32' : '#e0e0e0', color: profile.siteRole === 'SITE_ADMIN' ? '#fff' : '#000' }}>
                        {profile.siteRole}
                      </span>
                    </div>
                    <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-m-bottom_small">
                      <p className="slds-text-title text-slate-500" style={{ fontSize: '11px', textTransform: 'uppercase' }}>Skill Class Tier</p>
                      <p className="slds-text-body_regular"><strong>{profile.classTier ?? 'PRE_OP (Default)'}</strong></p>
                    </div>
                  </div>

                  <div className="slds-m-bottom_large">
                    <p className="slds-text-title text-slate-500 slds-m-bottom_xx-small" style={{ fontSize: '11px', textTransform: 'uppercase' }}>Career Biography</p>
                    <p className="slds-text-body_regular" style={{ background: '#fff', padding: '10px', borderRadius: '4px', border: '1px solid #dddbda' }}>
                      {profile.biography ?? 'No biography details provided.'}
                    </p>
                  </div>

                  <div>
                    <p className="slds-text-title text-slate-500 slds-m-bottom_small" style={{ fontSize: '11px', textTransform: 'uppercase' }}>Adjust Administrative Access</p>
                    <div className="slds-grid slds-wrap" style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          void setSiteRole('SITE_ADMIN')
                        }}
                        disabled={updatingRole || profile.siteRole === 'SITE_ADMIN'}
                        className="slds-button slds-button_success"
                        style={{ padding: '6px 16px', background: '#2e7d32', color: '#fff' }}
                      >
                        Grant SITE_ADMIN
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void setSiteRole('USER')
                        }}
                        disabled={updatingRole || profile.siteRole === 'USER'}
                        className="slds-button slds-button_destructive"
                        style={{ padding: '6px 16px', background: '#d32f2f', color: '#fff' }}
                      >
                        Revoke to USER
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="slds-align_absolute-center text-slate-500 slds-p-around_large" style={{ textAlign: 'center', border: '1px dashed #dddbda', borderRadius: '4px' }}>
                  <p>Enter a User ID in the input box above and click "Search Profile" to inspect records.</p>
                </div>
              )}
            </div>
          </article>
        </div>
      </div>
    </AdminLayout>
  )
}
