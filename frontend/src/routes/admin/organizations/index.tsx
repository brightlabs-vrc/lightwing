import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../../hooks/useAuth'
import { requireSiteAdmin } from '../../../lib/auth-guard'
import {
  listAdminOrganizations,
  createAdminOrganization,
  listAdminTeams,
  convertAdminTeamToOrg,
} from '../../../lib/admin-api'
import { AdminLayout } from '../-AdminLayout'
import { AlertBanner } from '../../../components/AlertBanner'
import { Pagination } from '../../../components/Pagination'
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

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false)

  // Create Org form state
  const [orgName, setOrgName] = useState('')
  const [orgLogo, setOrgLogo] = useState('')
  const [discordInvite, setDiscordInvite] = useState('')
  const [vrchatGroupId, setVrchatGroupId] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Convert Team form state
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
        authHeader
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

  const actions = (
    <div style={{ display: 'flex', gap: '8px' }}>
      <button
        type="button"
        onClick={() => {
          setConvertError(null)
          void loadTeamsForConvert()
          setIsConvertModalOpen(true)
        }}
        className="slds-button slds-button_neutral"
      >
        Convert Team to Org
      </button>
      <button
        type="button"
        onClick={() => {
          setCreateError(null)
          setIsCreateModalOpen(true)
        }}
        className="slds-button slds-button_brand"
      >
        New Organization
      </button>
    </div>
  )

  return (
    <AdminLayout
      title="Organizations Directory"
      subtitle="Oversee system organizations, manage administrative roles, and convert registered teams."
      actions={actions}
    >
      <div className="slds-grid slds-wrap slds-gutters">
        <div className="slds-col slds-size_1-of-1 slds-m-bottom_medium">
          <article className="slds-card" style={{ border: '1px solid #dddbda' }}>
            <div className="slds-card__header slds-grid">
              <header className="slds-media slds-media_center slds-has-flexi-truncate">
                <div className="slds-media__body">
                  <h2 className="slds-card__header-title">
                    <span className="slds-card__header-link slds-truncate font-semibold" style={{ fontWeight: 'bold' }}>
                      Registered System Organizations
                    </span>
                  </h2>
                </div>
              </header>
            </div>

            <div className="slds-card__body slds-card__body_inner" style={{ padding: '1.5rem' }}>
              {error && (
                <div className="slds-m-bottom_medium">
                  <AlertBanner variant="error">{error}</AlertBanner>
                </div>
              )}
              {success && (
                <div className="slds-m-bottom_medium">
                  <AlertBanner variant="success">{success}</AlertBanner>
                </div>
              )}

              <div className="slds-form-element slds-m-bottom_medium" style={{ maxWidth: '300px' }}>
                <div className="slds-form-element__control">
                  <input
                    type="text"
                    placeholder="Search organizations by name/slug..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value)
                      setPage(1)
                    }}
                    className="slds-input"
                    style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px' }}
                  />
                </div>
              </div>

              {loading ? (
                <div className="slds-align_absolute-center slds-p-around_large text-slate-500" style={{ textAlign: 'center' }}>
                  <p>Loading organizations...</p>
                </div>
              ) : orgs.length > 0 ? (
                <>
                  <div style={{ overflowX: 'auto', border: '1px solid #dddbda', borderRadius: '4px' }}>
                    <table className="slds-table slds-table_cell-buffer slds-table_bordered slds-table_col-bordered" aria-label="Organizations Directory Table" style={{ width: '100%', tableLayout: 'fixed', minWidth: '700px' }}>
                      <thead>
                        <tr className="slds-line-height_reset" style={{ background: '#f3f2f1' }}>
                          <th scope="col" style={{ width: '30%', minWidth: '180px' }}>
                            <div className="slds-truncate font-bold" title="Organization Name" style={{ fontWeight: 'bold' }}>Organization Name</div>
                          </th>
                          <th scope="col" style={{ width: '25%', minWidth: '150px' }}>
                            <div className="slds-truncate font-bold" title="Unique Slug" style={{ fontWeight: 'bold' }}>Unique Slug</div>
                          </th>
                          <th scope="col" style={{ width: '110px' }}>
                            <div className="slds-truncate font-bold" title="Members Count" style={{ fontWeight: 'bold' }}>Members</div>
                          </th>
                          <th scope="col" style={{ minWidth: '180px' }}>
                            <div className="slds-truncate font-bold" title="Admin Slots" style={{ fontWeight: 'bold' }}>Admin Slots Remaining</div>
                          </th>
                          <th scope="col" style={{ width: '100px' }}>
                            <div className="slds-truncate font-bold" title="Actions" style={{ fontWeight: 'bold' }}>Actions</div>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {orgs.map((org) => (
                          <tr key={org.id} className="slds-hint-parent hover:bg-slate-50">
                            <th scope="row">
                              <div className="slds-truncate font-bold" title={org.name}>
                                <Link
                                  to="/admin/organizations/$orgId"
                                  params={{ orgId: org.id }}
                                  className="text-blue-600 hover:underline font-bold"
                                >
                                  {org.name}
                                </Link>
                              </div>
                            </th>
                            <td>
                              <div className="slds-truncate" title={org.slug}>{org.slug}</div>
                            </td>
                            <td>
                              <div className="slds-truncate" title={String(org.memberCount)}>
                                {org.memberCount}
                              </div>
                            </td>
                            <td>
                              <span className={`slds-badge ${org.administratorSlotsRemaining > 0 ? 'slds-theme_success' : 'slds-theme_error'}`} style={{ padding: '2px 8px', borderRadius: '4px' }}>
                                {org.administratorSlotsRemaining} / 3 slots remaining
                              </span>
                            </td>
                            <td>
                              <button
                                type="button"
                                onClick={() => navigate({ to: '/admin/organizations/$orgId', params: { orgId: org.id } })}
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

                  <Pagination
                    page={page}
                    pageSize={pageSize}
                    total={totalOrgs}
                    onPageChange={setPage}
                    onPageSizeChange={setPageSize}
                  />
                </>
              ) : (
                <div className="slds-align_absolute-center text-slate-500 slds-p-around_large" style={{ textAlign: 'center', border: '1px dashed #dddbda', borderRadius: '4px' }}>
                  <p>No organizations have been registered yet.</p>
                </div>
              )}
            </div>
          </article>
        </div>
      </div>

      {/* CREATE ORG MODAL */}
      {isCreateModalOpen && (
        <>
          <section role="dialog" tabIndex={-1} aria-modal="true" className="slds-modal slds-fade-in-open" style={{ zIndex: 9001 }}>
            <div className="slds-modal__container" style={{ maxWidth: '40rem', width: '90%' }}>
              <header className="slds-modal__header">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="slds-button slds-button_icon slds-modal__close"
                  title="Close"
                >
                  X
                </button>
                <h2 className="slds-modal__title font-bold text-slate-900" style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                  Register New Organization
                </h2>
              </header>

              <form onSubmit={(e) => void handleCreateOrg(e)}>
                <div className="slds-modal__content slds-p-around_medium" style={{ background: '#fff' }}>
                  {createError && (
                    <div className="slds-m-bottom_medium">
                      <AlertBanner variant="error">{createError}</AlertBanner>
                    </div>
                  )}

                  <div className="slds-form slds-form_stacked">
                    <div className="slds-form-element slds-m-bottom_medium">
                      <label className="slds-form-element__label font-bold text-slate-700" htmlFor="org-name-input">
                        Organization Name
                      </label>
                      <div className="slds-form-element__control">
                        <input
                          id="org-name-input"
                          type="text"
                          required
                          value={orgName}
                          onChange={(e) => setOrgName(e.target.value)}
                          placeholder="e.g. International Umamusume Racing Association"
                          className="slds-input"
                          style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px' }}
                        />
                      </div>
                    </div>

                    <div className="slds-form-element slds-m-bottom_medium">
                      <label className="slds-form-element__label font-bold text-slate-700" htmlFor="org-logo-input">
                        Logo URL (Optional)
                      </label>
                      <div className="slds-form-element__control">
                        <input
                          id="org-logo-input"
                          type="url"
                          value={orgLogo}
                          onChange={(e) => setOrgLogo(e.target.value)}
                          placeholder="https://example.com/logo.png"
                          className="slds-input"
                          style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px' }}
                        />
                      </div>
                    </div>

                    <div className="slds-form-element slds-m-bottom_medium">
                      <label className="slds-form-element__label font-bold text-slate-700" htmlFor="org-discord-input">
                        Discord Invite Link (Optional)
                      </label>
                      <div className="slds-form-element__control">
                        <input
                          id="org-discord-input"
                          type="text"
                          value={discordInvite}
                          onChange={(e) => setDiscordInvite(e.target.value)}
                          placeholder="https://discord.gg/example"
                          className="slds-input"
                          style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px' }}
                        />
                      </div>
                    </div>

                    <div className="slds-form-element">
                      <label className="slds-form-element__label font-bold text-slate-700" htmlFor="org-vrc-input">
                        VRChat Group ID (Optional)
                      </label>
                      <div className="slds-form-element__control">
                        <input
                          id="org-vrc-input"
                          type="text"
                          value={vrchatGroupId}
                          onChange={(e) => setVrchatGroupId(e.target.value)}
                          placeholder="grp_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                          className="slds-input"
                          style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <footer className="slds-modal__footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="slds-button slds-button_neutral"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="slds-button slds-button_brand"
                  >
                    {creating ? 'Creating...' : 'Create Organization'}
                  </button>
                </footer>
              </form>
            </div>
          </section>
          <div className="slds-backdrop slds-backdrop_open" style={{ zIndex: 9000 }}></div>
        </>
      )}

      {/* CONVERT TEAM MODAL */}
      {isConvertModalOpen && (
        <>
          <section role="dialog" tabIndex={-1} aria-modal="true" className="slds-modal slds-fade-in-open" style={{ zIndex: 9001 }}>
            <div className="slds-modal__container" style={{ maxWidth: '40rem', width: '90%' }}>
              <header className="slds-modal__header">
                <button
                  type="button"
                  onClick={() => setIsConvertModalOpen(false)}
                  className="slds-button slds-button_icon slds-modal__close"
                  title="Close"
                >
                  X
                </button>
                <h2 className="slds-modal__title font-bold text-slate-900" style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                  Convert Team to Organization
                </h2>
              </header>

              <form onSubmit={(e) => void handleConvertTeam(e)}>
                <div className="slds-modal__content slds-p-around_medium" style={{ background: '#fff' }}>
                  {convertError && (
                    <div className="slds-m-bottom_medium">
                      <AlertBanner variant="error">{convertError}</AlertBanner>
                    </div>
                  )}

                  <div className="slds-form-element">
                    <label className="slds-form-element__label font-bold text-slate-700" htmlFor="select-team-convert">
                      Select Team to Convert
                    </label>
                    <div className="slds-form-element__control">
                      <select
                        id="select-team-convert"
                        required
                        value={selectedTeamId}
                        onChange={(e) => setSelectedTeamId(e.target.value)}
                        className="slds-select"
                        style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px' }}
                      >
                        <option value="">-- Choose Team --</option>
                        {teamsList.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} (@{t.slug})
                          </option>
                        ))}
                      </select>
                    </div>
                    <p className="slds-text-body_small text-slate-500" style={{ fontSize: '11px', marginTop: '6px' }}>
                      Converting a team turns it into a full organization, migrating all roster members into staff administrators/members and deleting the team record.
                    </p>
                  </div>
                </div>

                <footer className="slds-modal__footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setIsConvertModalOpen(false)}
                    className="slds-button slds-button_neutral"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={converting}
                    className="slds-button slds-button_brand"
                  >
                    {converting ? 'Converting...' : 'Convert to Organization'}
                  </button>
                </footer>
              </form>
            </div>
          </section>
          <div className="slds-backdrop slds-backdrop_open" style={{ zIndex: 9000 }}></div>
        </>
      )}
    </AdminLayout>
  )
}
