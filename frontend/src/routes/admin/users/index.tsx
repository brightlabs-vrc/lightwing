import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../../hooks/useAuth'
import { requireSiteAdmin } from '../../../lib/auth-guard'
import { listAdminUsers } from '../../../lib/admin-api'
import { AdminLayout } from '../-AdminLayout'
import { AlertBanner } from '../../../components/AlertBanner'
import { PaginationBar } from '../../../components/Pagination'
import { UserLink } from '../../../components/UserLink'
import { Heading, Text, Label, Button, TextInput, FormControl, Spinner } from '@primer/react'
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
  const [totalUsers, setTotalUsers] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
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

  return (
    <AdminLayout>
      <div style={{
        border: '1px solid var(--color-border-default)',
        borderRadius: '6px',
        backgroundColor: 'var(--color-canvas-default)',
        boxShadow: 'var(--color-shadow-small)',
        overflow: 'hidden'
      }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--color-border-default)' }}>
          <Heading as="h2" style={{ fontSize: '18px', margin: 0 }}>
            Registered System Competitors
          </Heading>
        </div>

        <div style={{ padding: '1.5rem' }}>
          {/* Search Control */}
          <div style={{ maxWidth: '400px', marginBottom: '1.5rem' }}>
            <FormControl>
              <FormControl.Label style={{ fontWeight: 'bold' }}>Search by Name</FormControl.Label>
              <TextInput
                value={search}
                onChange={(evt) => {
                  setSearch(evt.target.value)
                  setPage(1)
                }}
                placeholder="Search competitors..."
                width="100%"
              />
            </FormControl>
          </div>

          {error && (
            <div style={{ marginBottom: '1rem' }}>
              <AlertBanner variant="error">{error}</AlertBanner>
            </div>
          )}

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '3rem', gap: '0.5rem', color: '#57606a' }}>
              <Spinner size="small" />
              <span>Loading competitor records...</span>
            </div>
          ) : users.length > 0 ? (
            <>
              <div style={{ overflowX: 'auto', border: '1px solid #d0d7de', borderRadius: '6px', marginBottom: '1rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ background: '#f6f8fa', borderBottom: '1px solid #d0d7de' }}>
                      <th style={{ padding: '12px', fontWeight: 'bold' }}>VRChat Username</th>
                      <th style={{ padding: '12px', fontWeight: 'bold' }}>Discord Name</th>
                      <th style={{ padding: '12px', fontWeight: 'bold' }}>Site Role</th>
                      <th style={{ padding: '12px', fontWeight: 'bold' }}>Class Tier</th>
                      <th style={{ padding: '12px', fontWeight: 'bold' }}>Team Affiliations</th>
                      <th style={{ padding: '12px', fontWeight: 'bold' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} style={{ borderBottom: '1px solid #d0d7de' }}>
                        <td style={{ padding: '12px', fontWeight: 'bold' }}>
                          <UserLink userId={user.id} name={user.vrchatUsername || '—'} />
                          {user.id === session?.user.id && (
                            <Label variant="default" style={{ marginLeft: '8px' }}>
                              You
                            </Label>
                          )}
                        </td>
                        <td style={{ padding: '12px' }}>{user.name}</td>
                        <td style={{ padding: '12px' }}>
                          <Label variant={user.siteRole === 'SITE_ADMIN' ? 'success' : 'default'}>
                            {user.siteRole}
                          </Label>
                        </td>
                        <td style={{ padding: '12px' }}>
                          {!user.classTier || user.classTier === 'PRE_OP' || user.classTier === 'OP' ? 'None' : user.classTier}
                        </td>
                        <td style={{ padding: '12px' }}>
                          {user.teams.length > 0 ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {user.teams.map((t) => (
                                <Label key={t.organizationId} variant="accent">
                                  {t.name} ({t.role})
                                </Label>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color: '#8c959f' }}>None</span>
                          )}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <Button
                            size="small"
                            onClick={() => navigate({ to: '/admin/users/$userId', params: { userId: user.id } })}
                          >
                            Manage
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <PaginationBar
                page={page}
                pageSize={pageSize}
                total={totalUsers}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </>
          ) : (
            <div style={{
              textAlign: 'center',
              padding: '3rem',
              color: '#57606a',
              border: '1px dashed #d0d7de',
              borderRadius: '6px'
            }}>
              <span>No competitor accounts match the current query filter.</span>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
