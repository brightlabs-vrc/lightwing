import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../../hooks/useAuth'
import { requireSiteAdmin } from '../../../lib/auth-guard'
import { listAdminTeams, createAdminTeam } from '../../../lib/admin-api'
import { AdminLayout } from '../-AdminLayout'
import { AlertBanner } from '../../../components/AlertBanner'
import { Pagination } from '../../../components/Pagination'
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
      // Reload list
      await fetchTeams()
    } catch (cause) {
      setCreateError(cause instanceof Error ? cause.message : 'Unable to create team')
    } finally {
      setCreating(false)
    }
  }

  const actions = (
    <button
      type="button"
      onClick={() => {
        setCreateError(null)
        setIsModalOpen(true)
      }}
      className="slds-button slds-button_brand"
    >
      New Team
    </button>
  )

  return (
    <AdminLayout
      title="Team Directory"
      subtitle="Oversee competition teams, review historical statistics, and manage organizational memberships."
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
                      Registered Organization Teams
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

              {/* Simple search bar */}
              <div className="slds-form-element slds-m-bottom_medium" style={{ maxWidth: '300px' }}>
                <div className="slds-form-element__control">
                  <input
                    type="text"
                    placeholder="Search teams by name/slug..."
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
                  <p>Loading organization teams...</p>
                </div>
              ) : teams.length > 0 ? (
                <>
                  <div style={{ overflowX: 'auto', border: '1px solid #dddbda', borderRadius: '4px' }}>
                    <table className="slds-table slds-table_cell-buffer slds-table_bordered slds-table_col-bordered" aria-label="Teams Directory Table" style={{ width: '100%' }}>
                      <thead>
                        <tr className="slds-line-height_reset" style={{ background: '#f3f2f1' }}>
                          <th scope="col" style={{ width: '250px' }}>
                            <div className="slds-truncate font-bold" title="Team Name" style={{ fontWeight: 'bold' }}>Team Name</div>
                          </th>
                          <th scope="col" style={{ width: '250px' }}>
                            <div className="slds-truncate font-bold" title="Unique Slug" style={{ fontWeight: 'bold' }}>Unique Slug</div>
                          </th>
                          <th scope="col" style={{ width: '120px' }}>
                            <div className="slds-truncate font-bold" title="Members Count" style={{ fontWeight: 'bold' }}>Members</div>
                          </th>
                          <th scope="col" style={{ width: '220px' }}>
                            <div className="slds-truncate font-bold" title="Admin Slots" style={{ fontWeight: 'bold' }}>Admin Slots Remaining</div>
                          </th>
                          <th scope="col" style={{ width: '120px' }}>
                            <div className="slds-truncate font-bold" title="Actions" style={{ fontWeight: 'bold' }}>Actions</div>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {teams.map((team) => (
                          <tr key={team.id} className="slds-hint-parent hover:bg-slate-50">
                            <th scope="row">
                              <div className="slds-truncate font-bold" title={team.name}>
                                <Link
                                  to="/admin/teams/$teamId"
                                  params={{ teamId: team.id }}
                                  className="text-blue-600 hover:underline font-bold"
                                >
                                  {team.name}
                                </Link>
                              </div>
                            </th>
                            <td>
                              <div className="slds-truncate" title={team.slug}>{team.slug}</div>
                            </td>
                            <td>
                              <div className="slds-truncate" title={String(team.memberCount)}>
                                {team.memberCount}
                              </div>
                            </td>
                            <td>
                              <span className={`slds-badge ${team.administratorSlotsRemaining > 0 ? 'slds-theme_success' : 'slds-theme_error'}`} style={{ padding: '2px 8px', borderRadius: '4px' }}>
                                {team.administratorSlotsRemaining} / 3 slots remaining
                              </span>
                            </td>
                            <td>
                              <button
                                type="button"
                                onClick={() => navigate({ to: '/admin/teams/$teamId', params: { teamId: team.id } })}
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
                    total={totalTeams}
                    onPageChange={setPage}
                    onPageSizeChange={setPageSize}
                  />
                </>
              ) : (
                <div className="slds-align_absolute-center text-slate-500 slds-p-around_large" style={{ textAlign: 'center', border: '1px dashed #dddbda', borderRadius: '4px' }}>
                  <p>No organization teams have been registered yet.</p>
                </div>
              )}
            </div>
          </article>
        </div>
      </div>

      {/* Creation SLDS Modal */}
      {isModalOpen && (
        <>
          <section role="dialog" tabIndex={-1} aria-modal="true" className="slds-modal slds-fade-in-open" style={{ zIndex: 9001 }}>
            <div className="slds-modal__container" style={{ maxWidth: '40rem', width: '90%' }}>
              <header className="slds-modal__header">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="slds-button slds-button_icon slds-modal__close"
                  title="Close"
                  style={{
                    position: 'absolute',
                    top: '0.5rem',
                    right: '0.5rem',
                    background: 'none',
                    border: 'none',
                    fontSize: '1.25rem',
                    cursor: 'pointer',
                  }}
                >
                  X
                </button>
                <h2 className="slds-modal__title slds-hyphenate font-bold text-slate-900" style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                  Register New Team
                </h2>
              </header>

              <form onSubmit={(e) => void handleCreateTeam(e)}>
                <div className="slds-modal__content slds-p-around_medium" style={{ background: '#fff' }}>
                  {createError && (
                    <div className="slds-m-bottom_medium">
                      <AlertBanner variant="error">{createError}</AlertBanner>
                    </div>
                  )}

                  <div className="slds-form slds-form_stacked">
                    <div className="slds-form-element slds-m-bottom_medium">
                      <label className="slds-form-element__label font-bold text-slate-700" style={{ fontWeight: 'bold' }} htmlFor="team-name-input">
                        Team Name
                      </label>
                      <div className="slds-form-element__control">
                        <input
                          id="team-name-input"
                          type="text"
                          required
                          value={teamName}
                          onChange={(e) => setTeamName(e.target.value)}
                          placeholder="e.g. Kyoto Racing Syndicate"
                          className="slds-input"
                          style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px' }}
                        />
                      </div>
                    </div>

                    <div className="slds-form-element">
                      <label className="slds-form-element__label font-bold text-slate-700" style={{ fontWeight: 'bold' }} htmlFor="team-logo-input">
                        Logo URL (Optional)
                      </label>
                      <div className="slds-form-element__control">
                        <input
                          id="team-logo-input"
                          type="url"
                          value={teamLogo}
                          onChange={(e) => setTeamLogo(e.target.value)}
                          placeholder="https://example.com/logo.png"
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
                    onClick={() => setIsModalOpen(false)}
                    className="slds-button slds-button_neutral"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="slds-button slds-button_brand"
                  >
                    {creating ? 'Creating...' : 'Create Team'}
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
