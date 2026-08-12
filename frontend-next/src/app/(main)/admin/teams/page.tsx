'use client'

import { AdminLayout } from '@/components/Admin/AdminLayout'
import { AlertBanner } from '@/components/AlertBanner'
import { PaginationBar } from '@/components/Pagination'
import { Heading, Button, TextInput, FormControl, Spinner, Dialog } from '@primer/react'
import type { teammanager } from '@/lib/client'
import { listAdminTeams, createAdminTeam } from '@/lib/admin-api'
import { useAuth } from '@/hooks/useAuth'
import { useCallback, useEffect, useMemo, useState } from 'react'

export default function AdminTeamsPage() {
  const { session } = useAuth()
  const authHeader = useMemo(() => session?.session.token ? "Bearer " + session.session.token : null, [session?.session.token])

  const [teams, setTeams] = useState<teammanager.TeamListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [teamName, setTeamName] = useState('')
  const [teamLogo, setTeamLogo] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const fetchTeams = useCallback(async () => {
    if (!authHeader) return
    setLoading(true)
    setError(null)
    try {
      const offset = (page - 1) * pageSize
      const result = await listAdminTeams(search, pageSize, offset)
      setTeams(result.teams)
      setTotal(result.total)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load organization teams')
    } finally {
      setLoading(false)
    }
  }, [authHeader, search, page, pageSize])

  useEffect(() => { void fetchTeams() }, [fetchTeams])

  async function handleCreateTeam(e: React.FormEvent) {
    e.preventDefault()
    if (!teamName.trim()) {
      setCreateError('Team name is required.')
      return
    }
    if (!authHeader) {
      setCreateError('Authentication token is missing.')
      return
    }
    setCreating(true)
    setCreateError(null)
    try {
      await createAdminTeam({ name: teamName.trim(), logo: teamLogo.trim() || null }, authHeader)
      setIsModalOpen(false)
      setTeamName('')
      setTeamLogo('')
      await fetchTeams()
    } catch (cause) {
      setCreateError(cause instanceof Error ? cause.message : 'Unable to create team')
    } finally {
      setCreating(false)
    }
  }

  if (!authHeader) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <AlertBanner variant="error">Authentication required</AlertBanner>
      </div>
    )
  }

  return (
    <AdminLayout>
      <div style={{ marginBottom: '1.5rem' }}>
        <Heading as="h1" style={{ fontSize: '24px', margin: 0 }}>Teams</Heading>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <Button onClick={() => setIsModalOpen(true)}>Create Team</Button>
      </div>

      {error && (
        <AlertBanner variant="error">{error}</AlertBanner>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <Spinner size="large" />
        </div>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid var(--color-border-default)', backgroundColor: 'var(--color-canvas-subtle)', fontWeight: '600' }}>Name</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid var(--color-border-default)', backgroundColor: 'var(--color-canvas-subtle)', fontWeight: '600' }}>Members</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid var(--color-border-default)', backgroundColor: 'var(--color-canvas-subtle)', fontWeight: '600' }}>Created</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((team) => (
                  <tr key={team.id} style={{ borderBottom: '1px solid var(--color-border-default)' }}>
                    <td style={{ padding: '0.75rem' }}>
                      <span style={{ fontWeight: '500' }}>{team.name}</span>
                      <span style={{ fontSize: '12px', color: 'var(--color-fg-muted)' }}>@{team.slug}</span>
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <span style={{ fontSize: '12px', color: 'var(--color-fg-muted)' }}>
                        {team.memberCount ?? 0}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <span style={{ fontSize: '12px', color: 'var(--color-fg-muted)' }}>
                        {new Date().toLocaleDateString()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <PaginationBar
            page={page}
            total={total}
            pageSize={pageSize}
            onPageChange={(p) => setPage(p)}
            onPageSizeChange={(s) => setPageSize(s)}
          />
        </>
      )}

      {isModalOpen && (
        <Dialog onClose={() => setIsModalOpen(false)} title="Create Team">
          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <FormControl>
              <FormControl.Label style={{ fontWeight: 'bold' }}>Team Name</FormControl.Label>
              <TextInput
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="My Racing Team"
                autoFocus
              />
            </FormControl>
            <FormControl>
              <FormControl.Label style={{ fontWeight: 'bold' }}>Logo URL (optional)</FormControl.Label>
              <TextInput
                value={teamLogo}
                onChange={(e) => setTeamLogo(e.target.value)}
                placeholder="https://example.com/logo.png"
              />
            </FormControl>
            {createError && (
              <AlertBanner variant="error">{createError}</AlertBanner>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <Button variant="default" onClick={() => setIsModalOpen(false)} disabled={creating}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleCreateTeam} disabled={creating}>
                {creating ? 'Creating...' : 'Create Team'}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </AdminLayout>
  )
}
