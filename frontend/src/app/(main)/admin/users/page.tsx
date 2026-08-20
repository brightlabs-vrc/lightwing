'use client'

import { useAuth } from '@/hooks/useAuth'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { listAdminUsers } from '@/lib/admin-api'
import { AdminLayout } from '@/components/Admin/AdminLayout'
import { AlertBanner } from '@/components/AlertBanner'
import { PaginationBar } from '@/components/Pagination'
import { UserLink } from '@/components/UserLink'
import { Heading, Text, Label, Button, TextInput, FormControl, Spinner } from '@primer/react'
import type { auth } from '@/lib/client'

export default function AdminUsersPage() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const authHeader = useMemo(() => session?.session.token ? "Bearer " + session.session.token : null, [session?.session.token])

  const [search, setSearch] = useState('')
  const [users, setUsers] = useState<auth.UserProfile[]>([])
  const [totalUsers, setTotalUsers] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    if (!authHeader) return
    setLoading(true)
    setError(null)
    try {
      const offset = (page - 1) * pageSize
      const result = await listAdminUsers(authHeader, search, pageSize, offset)
      setUsers(result.users)
      setTotalUsers(result.total)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load user list')
    } finally {
      setLoading(false)
    }
  }, [authHeader, search, page, pageSize])

  useEffect(() => { void fetchUsers() }, [fetchUsers])

  if (!authHeader) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <AlertBanner variant="error">Authentication required</AlertBanner>
      </div>
    )
  }

  return (
    <AdminLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <Heading as="h1" style={{ fontSize: '24px', margin: 0 }}>Manage Users</Heading>

        <div style={{ maxWidth: '400px', marginBottom: '1.5rem' }}>
          <FormControl>
            <FormControl.Label style={{ fontWeight: 'bold' }}>Search by Name</FormControl.Label>
            <TextInput
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder="Search competitors..."
              width="100%"
            />
          </FormControl>
        </div>

        {error && <AlertBanner variant="error">{error}</AlertBanner>}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem', gap: '0.5rem', color: 'var(--color-fg-muted)' }}>
            <Spinner size="small" />
            <span>Loading competitor records...</span>
          </div>
        ) : users.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-fg-muted)', border: '1px dashed var(--color-border-default)', borderRadius: '6px' }}>
            No competitor accounts match the current query
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto', border: '1px solid var(--color-border-default)', borderRadius: '6px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                <thead>
                  <tr style={{ background: 'var(--color-canvas-subtle)', borderBottom: '1px solid var(--color-border-default)' }}>
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
                    <tr key={user.id} style={{ borderBottom: '1px solid var(--color-border-default)' }}>
                      <td style={{ padding: '12px', fontWeight: 'bold' }}>
                        <UserLink userId={user.id} name={user.vrchatUsername || '—'} />
                        {user.id === session?.user.id && (
                          <Label variant="default" style={{ marginLeft: '8px' }}>You</Label>
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
                          <span style={{ color: 'var(--color-fg-muted)' }}>None</span>
                        )}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <a href={"/admin/users/" + user.id} style={{ fontSize: '13px' }}>
                          Manage
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationBar page={page} pageSize={pageSize} total={totalUsers} onPageChange={setPage} onPageSizeChange={setPageSize} />
          </>
        )}
      </div>
    </AdminLayout>
  )
}