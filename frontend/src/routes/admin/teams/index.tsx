import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { Button, CounterLabel, Dialog, FormControl, IconButton, Select, TextInput } from '@primer/react'
import { PlusIcon, SearchIcon, TrashIcon } from '@primer/octicons-react'
import { useAuth } from '../../../hooks/useAuth'
import { requireSiteAdmin } from '../../../lib/auth-guard'
import {
  createAdminTeam,
  deleteAdminTeam,
  listAdminTeams,
  listApprovedOrganizations,
} from '../../../lib/admin-api'
import { AdminLayout } from '../-AdminLayout'
import { AlertBanner } from '../../../components/AlertBanner'
import { Pagination } from '../../../components/Pagination'
import { PrimerSkeletonList } from '../../../components/LoadingSkeleton'
import { DangerZoneDeleteDialog } from '../../../components/DangerZoneDeleteDialog'
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
  const [success, setSuccess] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<teammanager.TeamListItem | null>(null)

  const [approvedOrgs, setApprovedOrgs] = useState<teammanager.LinkedOrganization[]>([])

  const [teamName, setTeamName] = useState('')
  const [teamLogo, setTeamLogo] = useState('')
  const [primaryOrgId, setPrimaryOrgId] = useState('')
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
      setError(cause instanceof Error ? cause.message : 'Unable to load competition teams')
    } finally {
      setLoading(false)
    }
  }

  async function fetchApprovedOrgs() {
    try {
      const res = await listApprovedOrganizations()
      setApprovedOrgs(res.organizations || [])
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    void fetchTeams()
  }, [page, pageSize, search])

  useEffect(() => {
    void fetchApprovedOrgs()
  }, [])

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
      await createAdminTeam(
        {
          name: teamName.trim(),
          logo: teamLogo.trim() || null,
          primaryOrganizationId: primaryOrgId.trim() || null,
        },
        authHeader,
      )
      setIsModalOpen(false)
      setTeamName('')
      setTeamLogo('')
      setPrimaryOrgId('')
      setSuccess('Competitive team created successfully.')
      await fetchTeams()
    } catch (cause) {
      setCreateError(cause instanceof Error ? cause.message : 'Unable to create team')
    } finally {
      setCreating(false)
    }
  }

  async function handleConfirmDeleteTeam() {
    if (!deleteTarget || !authHeader) return
    await deleteAdminTeam(deleteTarget.id, authHeader)
    setSuccess(`Permanently deleted team "${deleteTarget.name}".`)
    setDeleteTarget(null)
    await fetchTeams()
  }

  return (
    <AdminLayout
      title="Teams"
      subtitle="Oversee competitive teams, review historical statistics, manage rosters, or delete teams."
      breadcrumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Teams' }]}
      actions={
        <Button
          type="button"
          variant="primary"
          leadingVisual={PlusIcon}
          onClick={() => {
            setCreateError(null)
            setIsModalOpen(true)
          }}
        >
          New Team
        </Button>
      }
    >
      {error && <AlertBanner variant="error">{error}</AlertBanner>}
      {success && <AlertBanner variant="success">{success}</AlertBanner>}

      <section className="primer-box">
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
            <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Registered Competitive Teams</h2>
            <CounterLabel>{totalTeams}</CounterLabel>
          </div>

          <div style={{ minWidth: '240px' }}>
            <TextInput
              size="small"
              block
              leadingVisual={SearchIcon}
              placeholder="Search teams by name or slug..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
          </div>
        </div>

        {loading ? (
          <PrimerSkeletonList count={4} />
        ) : teams.length > 0 ? (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="primer-table" aria-label="Teams Directory Table" style={{ minWidth: '680px' }}>
                <thead>
                  <tr>
                    <th scope="col" style={{ width: '26%' }}>Team Name</th>
                    <th scope="col" style={{ width: '18%' }}>Slug</th>
                    <th scope="col" style={{ width: '24%' }}>Primary Organization</th>
                    <th scope="col" style={{ width: '110px' }}>Roster</th>
                    <th scope="col" style={{ width: '140px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((team) => {
                    const primaryOrg = team.organizations?.find((o) => o.isPrimary)
                    return (
                      <tr key={team.id}>
                        <td>
                          <Link
                            to="/admin/teams/$teamId"
                            params={{ teamId: team.id }}
                            style={{ fontWeight: 600, color: 'var(--fgColor-accent, #0969da)', textDecoration: 'none' }}
                          >
                            {team.name}
                          </Link>
                        </td>
                        <td style={{ color: 'var(--fgColor-muted, #636c76)' }}>@{team.slug}</td>
                        <td>
                          {primaryOrg ? (
                            <Link
                              to="/admin/organizations/$orgId"
                              params={{ orgId: primaryOrg.id }}
                              style={{ fontWeight: 500, color: 'var(--fgColor-default, #1f2328)', textDecoration: 'none' }}
                            >
                              {primaryOrg.name}
                            </Link>
                          ) : (
                            <span style={{ color: 'var(--fgColor-muted, #636c76)' }}>Independent</span>
                          )}
                        </td>
                        <td>{team.memberCount} members</td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <Button
                              type="button"
                              size="small"
                              onClick={() => navigate({ to: '/admin/teams/$teamId', params: { teamId: team.id } })}
                            >
                              Manage
                            </Button>
                            <IconButton
                              type="button"
                              size="small"
                              variant="danger"
                              aria-label={`Delete ${team.name}`}
                              icon={TrashIcon}
                              onClick={() => setDeleteTarget(team)}
                            />
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
              total={totalTeams}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </>
        ) : (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--fgColor-muted, #636c76)', fontSize: '13px' }}>
            No competitive teams have been registered yet.
          </div>
        )}
      </section>

      {isModalOpen && (
        <Dialog title="Register New Team" onClose={() => setIsModalOpen(false)} width="medium">
          <form onSubmit={(e) => void handleCreateTeam(e)} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {createError && <AlertBanner variant="error">{createError}</AlertBanner>}

            <FormControl required>
              <FormControl.Label>Team Name</FormControl.Label>
              <TextInput
                block
                required
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="e.g. Kyoto Racing Syndicate"
              />
            </FormControl>

            <FormControl>
              <FormControl.Label>Primary Parent Organization (Optional)</FormControl.Label>
              <Select block value={primaryOrgId} onChange={(e) => setPrimaryOrgId(e.target.value)}>
                <Select.Option value="">-- Independent / None --</Select.Option>
                {approvedOrgs.map((org) => (
                  <Select.Option key={org.id} value={org.id}>
                    {org.name} (@{org.slug})
                  </Select.Option>
                ))}
              </Select>
            </FormControl>

            <FormControl>
              <FormControl.Label>Logo URL (Optional)</FormControl.Label>
              <TextInput
                block
                type="url"
                value={teamLogo}
                onChange={(e) => setTeamLogo(e.target.value)}
                placeholder="https://example.com/logo.png"
              />
            </FormControl>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '8px', borderTop: '1px solid var(--borderColor-muted, #d8dee4)' }}>
              <Button type="button" onClick={() => setIsModalOpen(false)} disabled={creating}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={creating}>
                {creating ? 'Creating...' : 'Create Team'}
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {deleteTarget && (
        <DangerZoneDeleteDialog
          isOpen={true}
          onClose={() => setDeleteTarget(null)}
          entityType="team"
          entityName={deleteTarget.name}
          confirmText={deleteTarget.slug}
          consequences={[
            'The competitive team profile and its historical display metadata.',
            'All team roster memberships and linked organization associations.',
          ]}
          onConfirmDelete={handleConfirmDeleteTeam}
        />
      )}
    </AdminLayout>
  )
}
