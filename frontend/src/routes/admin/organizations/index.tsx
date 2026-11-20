import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { Button, CounterLabel, Dialog, FormControl, IconButton, Label, Select, TextInput } from '@primer/react'
import { ArrowSwitchIcon, PlusIcon, SearchIcon, TrashIcon } from '@primer/octicons-react'
import { useAuth } from '../../../hooks/useAuth'
import { requireSiteAdmin } from '../../../lib/auth-guard'
import {
  convertAdminTeamToOrg,
  createAdminOrganization,
  deleteAdminOrganization,
  listAdminOrganizations,
  listAdminTeams,
} from '../../../lib/admin-api'
import { AdminLayout } from '../-AdminLayout'
import { AlertBanner } from '../../../components/AlertBanner'
import { Pagination } from '../../../components/Pagination'
import { PrimerSkeletonList } from '../../../components/LoadingSkeleton'
import { DangerZoneDeleteDialog } from '../../../components/DangerZoneDeleteDialog'
import type { teammanager } from '../../../lib/client'

export const Route = createFileRoute('/admin/organizations/')({
  beforeLoad: async ({ location }) => {
    await requireSiteAdmin(location)
  },
  component: AdminOrganizationsPage,
})

function AdminOrganizationsPage() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const [orgs, setOrgs] = useState<teammanager.AdminOrganizationItem[]>([])
  const [totalOrgs, setTotalOrgs] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<teammanager.AdminOrganizationItem | null>(null)

  const [orgName, setOrgName] = useState('')
  const [orgLogo, setOrgLogo] = useState('')
  const [discordInvite, setDiscordInvite] = useState('')
  const [vrchatGroupId, setVrchatGroupId] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [teamsList, setTeamsList] = useState<teammanager.TeamListItem[]>([])
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [converting, setConverting] = useState(false)
  const [convertError, setConvertError] = useState<string | null>(null)

  const authHeader = useMemo(() => {
    const token = session?.session.token
    return token ? `Bearer ${token}` : null
  }, [session?.session.token])

  async function fetchOrganizations() {
    setLoading(true)
    setError(null)
    try {
      const offset = (page - 1) * pageSize
      const response = await listAdminOrganizations(search, pageSize, offset)
      setOrgs(response.organizations || [])
      setTotalOrgs(response.total || 0)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load organizations')
    } finally {
      setLoading(false)
    }
  }

  async function loadTeamsForConvert() {
    try {
      const response = await listAdminTeams('', 100, 0)
      setTeamsList(response.teams || [])
    } catch (cause) {
      console.error('Failed to load teams for conversion', cause)
    }
  }

  useEffect(() => {
    void fetchOrganizations()
  }, [page, pageSize, search])

  async function handleCreateOrg(evt: React.FormEvent) {
    evt.preventDefault()
    if (!orgName.trim()) {
      setCreateError('Organization name is required.')
      return
    }
    if (!authHeader) {
      setCreateError('Authentication token missing.')
      return
    }

    setCreating(true)
    setCreateError(null)
    try {
      await createAdminOrganization(
        {
          name: orgName.trim(),
          logo: orgLogo.trim() || null,
          discordInvite: discordInvite.trim() || null,
          vrchatGroupId: vrchatGroupId.trim() || null,
        },
        authHeader,
      )
      setIsCreateModalOpen(false)
      setOrgName('')
      setOrgLogo('')
      setDiscordInvite('')
      setVrchatGroupId('')
      setSuccess('Organization created successfully.')
      await fetchOrganizations()
    } catch (cause) {
      setCreateError(cause instanceof Error ? cause.message : 'Failed to create organization')
    } finally {
      setCreating(false)
    }
  }

  async function handleConvertTeam(evt: React.FormEvent) {
    evt.preventDefault()
    if (!selectedTeamId) {
      setConvertError('Please select a team to convert.')
      return
    }
    if (!authHeader) {
      setConvertError('Authentication token missing.')
      return
    }

    setConverting(true)
    setConvertError(null)
    try {
      await convertAdminTeamToOrg(selectedTeamId, authHeader)
      setIsConvertModalOpen(false)
      setSelectedTeamId('')
      setSuccess('Team converted to organization successfully.')
      await fetchOrganizations()
    } catch (cause) {
      setConvertError(cause instanceof Error ? cause.message : 'Failed to convert team to organization')
    } finally {
      setConverting(false)
    }
  }

  async function handleConfirmDeleteOrg() {
    if (!deleteTarget || !authHeader) return
    await deleteAdminOrganization(deleteTarget.id, authHeader)
    setSuccess(`Permanently deleted organization "${deleteTarget.name}".`)
    setDeleteTarget(null)
    await fetchOrganizations()
  }

  return (
    <AdminLayout
      title="Organizations"
      subtitle="Oversee registered organizations, manage staff roles, convert teams, or remove organizations."
      breadcrumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Organizations' }]}
      actions={
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Button
            type="button"
            leadingVisual={ArrowSwitchIcon}
            onClick={() => {
              setConvertError(null)
              void loadTeamsForConvert()
              setIsConvertModalOpen(true)
            }}
          >
            Convert Team to Org
          </Button>
          <Button
            type="button"
            variant="primary"
            leadingVisual={PlusIcon}
            onClick={() => {
              setCreateError(null)
              setIsCreateModalOpen(true)
            }}
          >
            New Organization
          </Button>
        </div>
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
            <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Registered Organizations</h2>
            <CounterLabel>{totalOrgs}</CounterLabel>
          </div>

          <div style={{ minWidth: '240px' }}>
            <TextInput
              size="small"
              block
              leadingVisual={SearchIcon}
              placeholder="Search organizations by name or slug..."
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
        ) : orgs.length > 0 ? (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="primer-table" aria-label="Organizations Directory Table" style={{ minWidth: '680px' }}>
                <thead>
                  <tr>
                    <th scope="col" style={{ width: '30%' }}>Organization</th>
                    <th scope="col" style={{ width: '20%' }}>Slug</th>
                    <th scope="col" style={{ width: '100px' }}>Members</th>
                    <th scope="col" style={{ width: '190px' }}>Admin Slots</th>
                    <th scope="col" style={{ width: '140px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orgs.map((org) => (
                    <tr key={org.id}>
                      <td>
                        <Link
                          to="/admin/organizations/$orgId"
                          params={{ orgId: org.id }}
                          style={{ fontWeight: 600, color: 'var(--fgColor-accent, #0969da)', textDecoration: 'none' }}
                        >
                          {org.name}
                        </Link>
                      </td>
                      <td style={{ color: 'var(--fgColor-muted, #636c76)' }}>@{org.slug}</td>
                      <td>{org.memberCount}</td>
                      <td>
                        <Label variant={org.administratorSlotsRemaining > 0 ? 'success' : 'danger'} size="small">
                          {org.administratorSlotsRemaining} / 3 remaining
                        </Label>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <Button
                            type="button"
                            size="small"
                            onClick={() => navigate({ to: '/admin/organizations/$orgId', params: { orgId: org.id } })}
                          >
                            Manage
                          </Button>
                          <IconButton
                            type="button"
                            size="small"
                            variant="danger"
                            aria-label={`Delete ${org.name}`}
                            icon={TrashIcon}
                            onClick={() => setDeleteTarget(org)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={page}
              pageSize={pageSize}
              total={totalOrgs}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </>
        ) : (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--fgColor-muted, #636c76)', fontSize: '13px' }}>
            No organizations have been registered yet.
          </div>
        )}
      </section>

      {isCreateModalOpen && (
        <Dialog title="Register New Organization" onClose={() => setIsCreateModalOpen(false)} width="medium">
          <form onSubmit={(e) => void handleCreateOrg(e)} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {createError && <AlertBanner variant="error">{createError}</AlertBanner>}

            <FormControl required>
              <FormControl.Label>Organization Name</FormControl.Label>
              <TextInput
                block
                required
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="e.g. International Umamusume Racing Association"
              />
            </FormControl>

            <FormControl>
              <FormControl.Label>Logo URL (Optional)</FormControl.Label>
              <TextInput
                block
                type="url"
                value={orgLogo}
                onChange={(e) => setOrgLogo(e.target.value)}
                placeholder="https://example.com/logo.png"
              />
            </FormControl>

            <FormControl>
              <FormControl.Label>Discord Invite Link (Optional)</FormControl.Label>
              <TextInput
                block
                value={discordInvite}
                onChange={(e) => setDiscordInvite(e.target.value)}
                placeholder="https://discord.gg/example"
              />
            </FormControl>

            <FormControl>
              <FormControl.Label>VRChat Group ID (Optional)</FormControl.Label>
              <TextInput
                block
                value={vrchatGroupId}
                onChange={(e) => setVrchatGroupId(e.target.value)}
                placeholder="grp_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
            </FormControl>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '8px', borderTop: '1px solid var(--borderColor-muted, #d8dee4)' }}>
              <Button type="button" onClick={() => setIsCreateModalOpen(false)} disabled={creating}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={creating}>
                {creating ? 'Creating...' : 'Create Organization'}
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {isConvertModalOpen && (
        <Dialog title="Convert Team to Organization" onClose={() => setIsConvertModalOpen(false)} width="medium">
          <form onSubmit={(e) => void handleConvertTeam(e)} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {convertError && <AlertBanner variant="error">{convertError}</AlertBanner>}

            <FormControl required>
              <FormControl.Label>Select Team to Convert</FormControl.Label>
              <Select
                block
                required
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
              >
                <Select.Option value="">-- Choose Team --</Select.Option>
                {teamsList.map((t) => (
                  <Select.Option key={t.id} value={t.id}>
                    {t.name} (@{t.slug})
                  </Select.Option>
                ))}
              </Select>
              <FormControl.Caption>
                Converting a team promotes it into a full organization, migrating its roster into staff members and removing the team record.
              </FormControl.Caption>
            </FormControl>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '8px', borderTop: '1px solid var(--borderColor-muted, #d8dee4)' }}>
              <Button type="button" onClick={() => setIsConvertModalOpen(false)} disabled={converting}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={converting}>
                {converting ? 'Converting...' : 'Convert to Organization'}
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {deleteTarget && (
        <DangerZoneDeleteDialog
          isOpen={true}
          onClose={() => setDeleteTarget(null)}
          entityType="organization"
          entityName={deleteTarget.name}
          confirmText={deleteTarget.slug}
          consequences={[
            'All organization staff memberships and administrator assignments.',
            'All organization-owned competition events, races, and newsletters.',
            'All organization-scoped participant class grades and team links.',
          ]}
          onConfirmDelete={handleConfirmDeleteOrg}
        />
      )}
    </AdminLayout>
  )
}
