import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../../hooks/useAuth'
import { requireSiteAdmin } from '../../../lib/auth-guard'
import { listAdminUsers } from '../../../lib/admin-api'
import { AdminLayout } from '../-AdminLayout'
import { AlertBanner } from '../../../components/AlertBanner'
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
  const [search, setSearch] = useState('')
  const [users, setUsers] = useState<auth.UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const authHeader = useMemo(() => {
    const token = session?.session.token
    return token ? `Bearer ${token}` : null
  }, [session?.session.token])

  async function fetchUsers() {
    if (!authHeader) return
    setLoading(true)
    setError(null)
    try {
      const response = await listAdminUsers(authHeader, search)
      setUsers(response.users)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load user list')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchUsers()
  }, [authHeader, search])

  return (
    <AdminLayout
      title="User Account Directory"
      subtitle="Verify system competitor profiles, review site role authorization levels, and manage global system privileges."
    >
      <div className="slds-grid slds-wrap slds-gutters">
        <div className="slds-col slds-size_1-of-1 slds-m-bottom_medium">
          <article className="slds-card" style={{ border: '1px solid #dddbda' }}>
            <div className="slds-card__header slds-grid">
              <header className="slds-media slds-media_center slds-has-flexi-truncate">
                <div className="slds-media__body">
                  <h2 className="slds-card__header-title">
                    <span className="slds-card__header-link slds-truncate font-semibold" style={{ fontWeight: 'bold' }}>
                      Registered System Competitors
                    </span>
                  </h2>
                </div>
              </header>
            </div>

            <div className="slds-card__body slds-card__body_inner" style={{ padding: '1.5rem' }}>
              {/* Search Control */}
              <div className="slds-form-element slds-m-bottom_large" style={{ maxWidth: '400px' }}>
                <label className="slds-form-element__label font-bold text-slate-700" style={{ fontWeight: 'bold' }} htmlFor="user-search-input">
                  Search by Name
                </label>
                <div className="slds-form-element__control">
                  <input
                    id="user-search-input"
                    value={search}
                    onChange={(evt) => setSearch(evt.target.value)}
                    placeholder="Search competitors..."
                    className="slds-input"
                    style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px' }}
                  />
                </div>
              </div>

              {error && (
                <div className="slds-m-bottom_medium">
                  <AlertBanner variant="error">{error}</AlertBanner>
                </div>
              )}

              {loading ? (
                <div className="slds-align_absolute-center slds-p-around_large text-slate-500" style={{ textAlign: 'center' }}>
                  <p>Loading competitor records...</p>
                </div>
              ) : users.length > 0 ? (
                <div style={{ overflowX: 'auto', border: '1px solid #dddbda', borderRadius: '4px' }}>
                  <table className="slds-table slds-table_cell-buffer slds-table_bordered slds-table_col-bordered" aria-label="Competitors Directory Table" style={{ width: '100%' }}>
                    <thead>
                      <tr className="slds-line-height_reset" style={{ background: '#f3f2f1' }}>
                        <th scope="col" style={{ width: '250px' }}>
                          <div className="slds-truncate font-bold" title="Full Name" style={{ fontWeight: 'bold' }}>Full Name</div>
                        </th>
                        <th scope="col" style={{ width: '150px' }}>
                          <div className="slds-truncate font-bold" title="Site Role" style={{ fontWeight: 'bold' }}>Site Role</div>
                        </th>
                        <th scope="col" style={{ width: '150px' }}>
                          <div className="slds-truncate font-bold" title="Class Tier" style={{ fontWeight: 'bold' }}>Class Tier</div>
                        </th>
                        <th scope="col">
                          <div className="slds-truncate font-bold" title="Team Affiliations" style={{ fontWeight: 'bold' }}>Team Affiliations</div>
                        </th>
                        <th scope="col" style={{ width: '120px' }}>
                          <div className="slds-truncate font-bold" title="Actions" style={{ fontWeight: 'bold' }}>Actions</div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user.id} className="slds-hint-parent hover:bg-slate-50">
                          <th scope="row">
                            <div className="slds-truncate font-bold" title={user.name}>
                              <Link
                                to="/admin/users/$userId"
                                params={{ userId: user.id }}
                                className="text-blue-600 hover:underline font-bold"
                              >
                                {user.name}
                              </Link>
                              {user.id === session?.user.id && (
                                <span className="slds-badge slds-m-left_small" style={{ fontSize: '10px', padding: '1px 4px' }}>
                                  You
                                </span>
                              )}
                            </div>
                          </th>
                          <td>
                            <span className={`slds-badge ${user.siteRole === 'SITE_ADMIN' ? 'slds-theme_success' : 'slds-theme_light'}`} style={{ padding: '2px 8px', borderRadius: '4px' }}>
                              {user.siteRole}
                            </span>
                          </td>
                          <td>
                            <div className="slds-truncate" title={user.classTier ?? 'PRE_OP'}>
                              {user.classTier ?? 'PRE_OP'}
                            </div>
                          </td>
                          <td>
                            <div className="slds-truncate" title={user.teams.map((t) => `${t.name} (${t.role})`).join(', ')}>
                              {user.teams.length > 0 ? (
                                <div className="slds-grid slds-wrap" style={{ gap: '4px' }}>
                                  {user.teams.map((t) => (
                                    <span key={t.organizationId} className="slds-badge slds-theme_light" style={{ fontSize: '11px', padding: '1px 6px' }}>
                                      {t.name} ({t.role})
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-400">None</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <button
                              type="button"
                              onClick={() => navigate({ to: '/admin/users/$userId', params: { userId: user.id } })}
                              className="slds-button slds-button_neutral"
                              style={{ fontSize: '12px', padding: '2px 10px' }}
                            >
                              Manage
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="slds-align_absolute-center text-slate-500 slds-p-around_large" style={{ textAlign: 'center', border: '1px dashed #dddbda', borderRadius: '4px' }}>
                  <p>No competitor accounts match the current query filter.</p>
                </div>
              )}
            </div>
          </article>
        </div>
      </div>
    </AdminLayout>
  )
}
