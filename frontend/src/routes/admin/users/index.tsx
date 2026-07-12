import { Link, Outlet, createFileRoute, useNavigate, useRouterState } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useAuth } from '../../../hooks/useAuth'
import { requireSiteAdmin } from '../../../lib/auth-guard'
import { listAdminUsers } from '../../../lib/admin-api'
import { AdminLayout } from '../-AdminLayout'
import { SldsIcon } from '../../../components/SldsIcon'
import type { auth } from '../../../lib/client'

export const Route = createFileRoute('/admin/users/')({
  beforeLoad: async ({ location }) => {
    await requireSiteAdmin(location)
  },
  component: AdminUsersListPage,
})

function AdminUsersListPage() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const isListRoute = pathname === '/admin/users' || pathname === '/admin/users/'

  const [users, setUsers] = useState<auth.UserSummary[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [lookupId, setLookupId] = useState('')

  async function loadUsers() {
    setLoadingUsers(true)
    setGlobalError(null)
    try {
      const response = await listAdminUsers()
      setUsers(response.users)
    } catch (cause) {
      setGlobalError(cause instanceof Error ? cause.message : 'Unable to load users')
    } finally {
      setLoadingUsers(false)
    }
  }

  useEffect(() => {
    void loadUsers()
  }, [])

  function lookupUser() {
    const id = lookupId.trim()
    if (!id) {
      return
    }
    navigate({
      to: '/admin/users/$userId',
      params: { userId: id },
    })
  }

  const currentUserId = session?.user.id ?? ''

  if (!isListRoute) {
    return <Outlet />
  }

  return (
    <AdminLayout
      title="User Account Management"
      subtitle="Browse system competitor profiles, review active team memberships, and adjust administrative site roles."
      actions={
        <button
          type="button"
          onClick={() => {
            void loadUsers()
          }}
          className="slds-button slds-button_neutral"
          style={{ padding: '4px 12px', fontSize: '12px' }}
        >
          Refresh
        </button>
      }
    >
      {globalError && (
        <div className="slds-align_absolute-center text-slate-500 slds-p-around_medium" style={{ textAlign: 'center', border: '1px dashed #dddbda', borderRadius: '4px' }}>
          <p>{globalError}</p>
        </div>
      )}

      <div className="slds-grid slds-wrap slds-gutters">
        {/* Directory list */}
        <div className="slds-col slds-size_1-of-1 slds-medium-size_2-of-3 slds-m-bottom_medium">
          <article className="slds-card" style={{ border: '1px solid #dddbda' }}>
            <div className="slds-card__header slds-grid slds-grid_align-spread" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <header className="slds-media slds-media_center slds-has-flexi-truncate">
                <div className="slds-media__figure" style={{ marginRight: '0.5rem' }}>
                  <SldsIcon category="standard" name="people" size={18} />
                </div>
                <div className="slds-media__body">
                  <h2 className="slds-card__header-title">
                    <span className="slds-card__header-link slds-truncate font-semibold" style={{ fontWeight: 'bold' }}>
                      Registered Users
                    </span>
                  </h2>
                </div>
              </header>
            </div>

            <div className="slds-card__body" style={{ padding: '0 1rem 1rem 1rem' }}>
              {loadingUsers ? (
                <p className="slds-text-body_small slds-p-around_medium" style={{ color: '#514f4d' }}>Loading users...</p>
              ) : users.length === 0 ? (
                <p className="slds-text-body_small slds-p-around_medium" style={{ color: '#514f4d' }}>No users found.</p>
              ) : (
                <ul className="slds-has-dividers_bottom-space" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                  {users.map((user) => (
                    <li key={user.id} className="slds-item slds-p-vertical_small">
                      <Link
                        to="/admin/users/$userId"
                        params={{ userId: user.id }}
                        className="slds-text-link_reset"
                        style={{
                          display: 'block',
                          textDecoration: 'none',
                          borderRadius: '4px',
                          padding: '12px',
                          transition: 'background 0.2s',
                          borderLeft: '4px solid transparent',
                        }}
                      >
                        <div className="slds-grid slds-grid_align-spread" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="slds-text-body_regular font-bold text-slate-900" style={{ fontWeight: 'bold', fontSize: '1rem' }}>
                            {user.name}
                            {user.id === currentUserId && (
                              <span className="slds-badge slds-theme_light slds-m-left_x-small" style={{ fontSize: '10px', padding: '1px 6px' }}>you</span>
                            )}
                          </span>
                          <span
                            className={`slds-badge ${
                              user.siteRole === 'SITE_ADMIN'
                                ? 'slds-theme_success'
                                : 'slds-theme_light'
                            }`}
                            style={{ fontSize: '10px', padding: '1px 6px' }}
                          >
                            {user.siteRole}
                          </span>
                        </div>
                        <div className="slds-grid slds-grid_align-spread slds-m-top_xx-small" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <code className="text-xs" style={{ fontSize: '12px', color: '#514f4d' }}>{user.id}</code>
                          <span className="slds-badge slds-theme_light" style={{ fontSize: '10px', padding: '1px 6px' }}>
                            {user.classTier ?? 'PRE_OP'}
                          </span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </article>
        </div>

        {/* Lookup utility */}
        <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-3 slds-m-bottom_medium">
          <article className="slds-card" style={{ border: '1px solid #dddbda', height: '100%' }}>
            <div className="slds-card__header slds-grid">
              <header className="slds-media slds-media_center slds-has-flexi-truncate">
                <div className="slds-media__figure" style={{ marginRight: '0.5rem' }}>
                  <SldsIcon category="standard" name="contact" size={24} />
                </div>
                <div className="slds-media__body">
                  <h2 className="slds-card__header-title">
                    <span className="slds-card__header-link slds-truncate font-semibold" style={{ fontWeight: 'bold' }}>
                      Lookup by Identifier
                    </span>
                  </h2>
                </div>
              </header>
            </div>

            <div className="slds-card__body slds-card__body_inner" style={{ padding: '1.5rem' }}>
              <p className="slds-text-body_small text-slate-500 slds-m-bottom_medium" style={{ fontSize: '12px' }}>
                Jump directly to a user's profile by entering their unique identifier:
              </p>
              <div className="slds-form-element">
                <label className="slds-form-element__label font-bold text-slate-700" style={{ fontWeight: 'bold' }} htmlFor="user-lookup-input">
                  User ID
                </label>
                <div className="slds-form-element__control slds-grid" style={{ display: 'flex', gap: '8px' }}>
                  <input
                    id="user-lookup-input"
                    value={lookupId}
                    onChange={(evt) => setLookupId(evt.target.value)}
                    onKeyDown={(evt) => {
                      if (evt.key === 'Enter') {
                        lookupUser()
                      }
                    }}
                    placeholder="e.g. mock-admin-1 or mock-user-1"
                    className="slds-input"
                    style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px', flexGrow: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => lookupUser()}
                    className="slds-button slds-button_brand"
                    style={{ padding: '6px 20px', height: '36px' }}
                  >
                    Go
                  </button>
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </AdminLayout>
  )
}
