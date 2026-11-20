import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { Avatar, Button, CounterLabel, IconButton, Label, Select, TextInput } from '@primer/react'
import { SearchIcon, TrashIcon } from '@primer/octicons-react'
import { useAuth } from '../../../hooks/useAuth'
import { requireAdminPanel } from '../../../lib/auth-guard'
import { deleteAdminUser, listAdminUsers } from '../../../lib/admin-api'
import { AdminLayout } from '../-AdminLayout'
import { AlertBanner } from '../../../components/AlertBanner'
import { Pagination } from '../../../components/Pagination'
import { UserLink } from '../../../components/UserLink'
import { PrimerSkeletonList } from '../../../components/LoadingSkeleton'
import { DangerZoneDeleteDialog } from '../../../components/DangerZoneDeleteDialog'
import type { auth } from '../../../lib/client'

export const Route = createFileRoute('/admin/users/')({
  beforeLoad: async ({ location }) => {
    await requireAdminPanel(location)
  },
  component: AdminUsersPage,
})

function AdminUsersPage() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const isSiteAdmin = session?.user.siteRole === 'SITE_ADMIN'
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('ALL')
  const [users, setUsers] = useState<auth.UserProfile[]>([])
  const [totalUsers, setTotalUsers] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<auth.UserProfile | null>(null)

  const authHeader = useMemo(() => {
    const token = session?.session.token
    return token ? `Bearer ${token}` : null
  }, [session?.session.token])

  async function fetchUsers() {
    if (!authHeader) return
    setLoading(true)
    setError(null)
    try {
      const offset = (page - 1) * pageSize
      const response = await listAdminUsers(authHeader, search, pageSize, offset)
      setUsers(response.users)
      setTotalUsers(response.total)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load user list')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchUsers()
  }, [authHeader, search, page, pageSize])

  const visibleUsers = useMemo(() => {
    if (roleFilter === 'ALL') return users
    return users.filter((u) => u.siteRole === roleFilter)
  }, [users, roleFilter])

  async function handleConfirmDeleteUser() {
    if (!deleteTarget || !authHeader) return
    await deleteAdminUser(deleteTarget.id, authHeader)
    setSuccess(`Permanently deleted user account "${deleteTarget.vrchatUsername || deleteTarget.name}".`)
    setDeleteTarget(null)
    await fetchUsers()
  }

  return (
    <AdminLayout
      title="Users"
      subtitle="Lookup participant accounts, review site role privileges, inspect team affiliations, and manage user lifecycle."
      breadcrumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Users' }]}
    >
      {error && <AlertBanner variant="error">{error}</AlertBanner>}
      {success && <AlertBanner variant="success">{success}</AlertBanner>}

      <section className="primer-box">
        {/* Filter Toolbar */}
        <div
          className="primer-box-header"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Registered Users</h2>
            <CounterLabel>{totalUsers}</CounterLabel>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ minWidth: '240px' }}>
              <TextInput
                id="user-search-input"
                leadingVisual={SearchIcon}
                value={search}
                onChange={(evt) => {
                  setSearch(evt.target.value)
                  setPage(1)
                }}
                placeholder="Search name, VRChat, or @slug..."
                size="small"
                block
              />
            </div>

            <Select
              aria-label="Filter by site role"
              size="small"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <Select.Option value="ALL">All Roles</Select.Option>
              <Select.Option value="SITE_ADMIN">SITE_ADMIN</Select.Option>
              <Select.Option value="EVENT_ADMIN">EVENT_ADMIN</Select.Option>
              <Select.Option value="USER">USER</Select.Option>
            </Select>
          </div>
        </div>

        {loading ? (
          <PrimerSkeletonList count={4} />
        ) : visibleUsers.length > 0 ? (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="primer-table" aria-label="Users Directory Table" style={{ minWidth: '760px' }}>
                <thead>
                  <tr>
                    <th scope="col" style={{ width: '28%' }}>User / VRChat</th>
                    <th scope="col" style={{ width: '20%' }}>Discord Name</th>
                    <th scope="col" style={{ width: '130px' }}>Site Role</th>
                    <th scope="col">Affiliations</th>
                    <th scope="col" style={{ width: '140px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleUsers.map((user) => {
                    const isSelf = user.id === session?.user.id
                    return (
                      <tr key={user.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                            <Avatar
                              src={user.image || '/fallback_avatar.jpg'}
                              size={28}
                              alt={user.vrchatUsername || user.name}
                            />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontWeight: 600 }}>
                                  <UserLink userId={user.id} name={user.vrchatUsername || user.name} />
                                </span>
                                {isSelf && (
                                  <Label variant="accent" size="small">You</Label>
                                )}
                              </div>
                              {user.slug && (
                                <div style={{ fontSize: '11px', color: 'var(--fgColor-muted, #636c76)' }}>
                                  @{user.slug}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={{ color: 'var(--fgColor-muted, #636c76)' }}>{user.name}</td>
                        <td>
                          <Label
                            variant={
                              user.siteRole === 'SITE_ADMIN'
                                ? 'accent'
                                : user.siteRole === 'EVENT_ADMIN'
                                ? 'attention'
                                : 'secondary'
                            }
                            size="small"
                          >
                            {user.siteRole}
                          </Label>
                        </td>
                        <td>
                          {user.teams.length > 0 ? (
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', maxHeight: '56px', overflowY: 'auto' }}>
                              {user.teams.map((t) => (
                                <Label key={t.organizationId} variant="secondary" size="small">
                                  {t.name} ({t.role})
                                </Label>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--fgColor-muted, #636c76)', fontSize: '12px' }}>None</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <Button
                              type="button"
                              size="small"
                              onClick={() => navigate({ to: '/admin/users/$userId', params: { userId: user.id } })}
                            >
                              Manage
                            </Button>
                            {isSiteAdmin && !isSelf && (
                              <IconButton
                                type="button"
                                size="small"
                                variant="danger"
                                aria-label={`Delete ${user.vrchatUsername || user.name}`}
                                icon={TrashIcon}
                                onClick={() => setDeleteTarget(user)}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <Pagination
              page={page}
              pageSize={pageSize}
              total={totalUsers}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </>
        ) : (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--fgColor-muted, #636c76)', fontSize: '13px' }}>
            No user accounts match the current filter.
          </div>
        )}
      </section>

      {deleteTarget && (
        <DangerZoneDeleteDialog
          isOpen={true}
          onClose={() => setDeleteTarget(null)}
          entityType="user"
          entityName={deleteTarget.vrchatUsername || deleteTarget.name}
          confirmText={deleteTarget.slug || deleteTarget.name}
          consequences={[
            'All active sessions and linked OAuth accounts for this user.',
            'All organization and competitive team memberships.',
            'All event registrations, race results, Glicko-2 ratings, and organization class grades.',
          ]}
          onConfirmDelete={handleConfirmDeleteUser}
        />
      )}
    </AdminLayout>
  )
}
