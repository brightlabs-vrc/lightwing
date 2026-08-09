import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../../hooks/useAuth'
import { requireSiteAdmin } from '../../../lib/auth-guard'
import { listAdminTeams, createAdminTeam } from '../../../lib/admin-api'
import { AdminLayout } from '../-AdminLayout'
import { AlertBanner } from '../../../components/AlertBanner'
import { PaginationBar } from '../../../components/Pagination'
import { Heading, Text, Label, Button, TextInput, FormControl, Spinner, Dialog } from '@primer/react'
import type { teammanager } from '../../../lib/client'

export const Route = createFileRoute('/admin/teams/')({
  beforeLoad: async ({ location }) => {
    await requireSiteAdmin(location)
  },
  component: AdminTeamsPage,
})

function AdminTeamsPage() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const [teams, setTeams] = useState<teammanager.TeamListItem[]>([])
  const [totalTeams, setTotalTeams] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Create team form state
  const [teamName, setTeamName] = useState('')
  const [teamLogo, setTeamLogo] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const authHeader = useMemo(() => {
    const token = session?.session.token
    return token ? `Bearer ${token}` : null
  }, [session?.session.token])

  async function fetchTeams() {
    setLoading(true)
    setError(null)
    try {
      const offset = (page - 1) * pageSize
      const response = await listAdminTeams(search, pageSize, offset)
      setTeams(response.teams)
      setTotalTeams(response.total)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load organization teams')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchTeams()
  }, [page, pageSize, search])

  async function handleCreateTeam(evt: React.FormEvent) {
    evt.preventDefault()
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
      const created = await createAdminTeam(
        {
          name: teamName.trim(),
          logo: teamLogo.trim() || null,
        },
        authHeader,
      )
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

  return (
    <AdminLayout>
      <div style={{
        border: '1px solid var(--color-border-default)',
        borderRadius: '6px',
        backgroundColor: 'var(--color-canvas-default)',
        boxShadow: 'var(--color-shadow-small)',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid var(--color-border-default)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <Heading as="h2" style={{ fontSize: '18px', margin: 0 }}>
            Registered Organization Teams
          </Heading>
          <Button
            variant="primary"
            onClick={() => {
              setCreateError(null)
              setIsModalOpen(true)
            }}
          >
            New Team
          </Button>
        </div>

        <div style={{ padding: '1.5rem' }}>
          {error && (
            <div style={{ marginBottom: '1rem' }}>
              <AlertBanner variant="error">{error}</AlertBanner>
            </div>
          )}

          {/* Simple search bar */}
          <div style={{ maxWidth: '300px', marginBottom: '1.5rem' }}>
            <TextInput
              placeholder="Search teams by name/slug..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              width="100%"
            />
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '3rem', gap: '0.5rem', color: 'var(--color-fg-muted)' }}>
              <Spinner size="small" />
              <span>Loading organization teams...</span>
            </div>
          ) : teams.length > 0 ? (
            <>
              <div style={{ overflowX: 'auto', border: '1px solid var(--color-border-default)', borderRadius: '6px', marginBottom: '1rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-canvas-subtle)', borderBottom: '1px solid var(--color-border-default)' }}>
                      <th style={{ padding: '12px', fontWeight: 'bold' }}>Team Name</th>
                      <th style={{ padding: '12px', fontWeight: 'bold' }}>Unique Slug</th>
                      <th style={{ padding: '12px', fontWeight: 'bold' }}>Members</th>
                      <th style={{ padding: '12px', fontWeight: 'bold' }}>Admin Slots Remaining</th>
                      <th style={{ padding: '12px', fontWeight: 'bold' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teams.map((team) => (
                      <tr key={team.id} style={{ borderBottom: '1px solid var(--color-border-default)' }}>
                        <td style={{ padding: '12px', fontWeight: 'bold' }}>
                          <Link
                            to="/admin/teams/$teamId"
                            params={{ teamId: team.id }}
                            style={{ color: 'var(--color-accent-fg)', textDecoration: 'none', fontWeight: 'bold' }}
                          >
                            {team.name}
                          </Link>
                        </td>
                        <td style={{ padding: '12px' }}>{team.slug}</td>
                        <td style={{ padding: '12px' }}>{team.memberCount}</td>
                        <td style={{ padding: '12px' }}>
                          <Label variant={team.administratorSlotsRemaining > 0 ? 'success' : 'danger'}>
                            {team.administratorSlotsRemaining} / 3 slots remaining
                          </Label>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <Button
                            size="small"
                            onClick={() => navigate({ to: '/admin/teams/$teamId', params: { teamId: team.id } })}
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
                total={totalTeams}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </>
          ) : (
            <div style={{
              textAlign: 'center',
              padding: '3rem',
              color: 'var(--color-fg-muted)',
              border: '1px dashed var(--color-border-default)',
              borderRadius: '6px'
            }}>
              <span>No organization teams have been registered yet.</span>
            </div>
          )}
        </div>
      </div>

      {/* Creation Modal */}
      {isModalOpen && (
        <Dialog
          onClose={() => setIsModalOpen(false)}
          title="Register New Team"
        >
          <form onSubmit={(e) => void handleCreateTeam(e)}>
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {createError && (
                <AlertBanner variant="error">{createError}</AlertBanner>
              )}

              <FormControl required>
                <FormControl.Label style={{ fontWeight: 'bold' }}>Team Name</FormControl.Label>
                <TextInput
                  type="text"
                  required
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="e.g. Kyoto Racing Syndicate"
                  width="100%"
                />
              </FormControl>

              <FormControl>
                <FormControl.Label style={{ fontWeight: 'bold' }}>Logo URL (Optional)</FormControl.Label>
                <TextInput
                  type="url"
                  value={teamLogo}
                  onChange={(e) => setTeamLogo(e.target.value)}
                  placeholder="https://example.com/logo.png"
                  width="100%"
                />
              </FormControl>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              padding: '1rem 1.5rem',
              borderTop: '1px solid var(--color-border-default)',
              backgroundColor: 'var(--color-canvas-subtle)',
            }}>
              <Button type="button" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={creating}>
                {creating ? 'Creating...' : 'Create Team'}
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </AdminLayout>
  )
}
