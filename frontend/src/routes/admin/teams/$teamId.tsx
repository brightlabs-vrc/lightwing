import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../../hooks/useAuth'
import { requireSiteAdmin } from '../../../lib/auth-guard'
import {
  getAdminTeam,
  updateAdminTeamStats,
  updateAdminTeam,
  addAdminTeamMember,
  updateAdminTeamMemberRole,
  removeAdminTeamMember,
  listAdminUsers,
  listAdminTeamMembers,
} from '../../../lib/admin-api'
import { AdminLayout } from '../-AdminLayout'
import { AlertBanner } from '../../../components/AlertBanner'
import { UserSearchCombobox } from '../../../components/UserSearchCombobox'
import { Pagination } from '../../../components/Pagination'
import type { teammanager, auth } from '../../../lib/client'

export const Route = createFileRoute('/admin/teams/$teamId')({
  beforeLoad: async ({ location }) => {
    await requireSiteAdmin(location)
  },
  component: AdminTeamDetailPage,
})

function AdminTeamDetailPage() {
  const { teamId } = Route.useParams()
  const { session } = useAuth()
  const [team, setTeam] = useState<teammanager.Team | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Roster state
  const [members, setMembers] = useState<Array<{ userId: string; name: string; slug: string | null; role: string }>>([])
  const [totalMembers, setTotalMembers] = useState(0)
  const [memberPage, setMemberPage] = useState(1)
  const [memberPageSize, setMemberPageSize] = useState(10)
  const [memberSearch, setMemberSearch] = useState('')

  // Modals state
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false)
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false)
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false)

  // Edit Stats form state
  const [seasonRank, setSeasonRank] = useState('')
  const [pointsAverage, setPointsAverage] = useState('')
  const [rankingAverage, setRankingAverage] = useState('')
  const [averagePointsPerEvent, setAveragePointsPerEvent] = useState('')
  const [updatingStats, setUpdatingStats] = useState(false)
  const [statsError, setStatsError] = useState<string | null>(null)

  // Edit Team Parameters form state
  const [teamName, setTeamName] = useState('')
  const [teamSlug, setTeamSlug] = useState('')
  const [teamLogo, setTeamLogo] = useState('')
  const [updatingTeam, setUpdatingTeam] = useState(false)
  const [teamError, setTeamError] = useState<string | null>(null)

  // Add Member form state
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedRole, setSelectedRole] = useState('member')
  const [addingMember, setAddingMember] = useState(false)
  const [memberError, setMemberError] = useState<string | null>(null)

  const authHeader = useMemo(() => {
    const token = session?.session.token
    return token ? `Bearer ${token}` : null
  }, [session?.session.token])

  async function loadTeamData() {
    setLoading(true)
    setError(null)
    try {
      const loadedTeam = await getAdminTeam(teamId)
      setTeam(loadedTeam)

      // Prepopulate stats form
      setSeasonRank(loadedTeam.stats.seasonRank !== null ? String(loadedTeam.stats.seasonRank) : '')
      setPointsAverage(loadedTeam.stats.pointsAverage !== null ? String(loadedTeam.stats.pointsAverage) : '')
      setRankingAverage(loadedTeam.stats.rankingAverage !== null ? String(loadedTeam.stats.rankingAverage) : '')
      setAveragePointsPerEvent(loadedTeam.stats.averagePointsPerEvent !== null ? String(loadedTeam.stats.averagePointsPerEvent) : '')

      // Prepopulate team parameters form
      setTeamName(loadedTeam.name || '')
      setTeamSlug(loadedTeam.slug || '')
      setTeamLogo(loadedTeam.logo || '')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load team details')
    } finally {
      setLoading(false)
    }
  }

  async function fetchRoster() {
    try {
      const offset = (memberPage - 1) * memberPageSize
      const response = await listAdminTeamMembers(teamId, memberSearch, memberPageSize, offset)
      setMembers(response.members)
      setTotalMembers(response.total)
    } catch (cause) {
      console.error('Failed to load roster', cause)
    }
  }

  useEffect(() => {
    void loadTeamData()
  }, [teamId, authHeader])

  useEffect(() => {
    void fetchRoster()
  }, [teamId, memberPage, memberPageSize, memberSearch])

  async function handleUpdateStats(evt: React.FormEvent) {
    evt.preventDefault()
    if (!authHeader) return

    setUpdatingStats(true)
    setStatsError(null)
    try {
      const updated = await updateAdminTeamStats(
        teamId,
        {
          seasonRank: seasonRank.trim() ? Number(seasonRank) : null,
          pointsAverage: pointsAverage.trim() ? Number(pointsAverage) : null,
          rankingAverage: rankingAverage.trim() ? Number(rankingAverage) : null,
          averagePointsPerEvent: averagePointsPerEvent.trim() ? Number(averagePointsPerEvent) : null,
        },
        authHeader,
      )
      setTeam(updated)
      setIsStatsModalOpen(false)
      setSuccess('Team statistics updated successfully.')
    } catch (cause) {
      setStatsError(cause instanceof Error ? cause.message : 'Failed to update statistics')
    } finally {
      setUpdatingStats(false)
    }
  }

  async function handleUpdateTeam(evt: React.FormEvent) {
    evt.preventDefault()
    if (!authHeader) return

    const trimmedSlug = teamSlug.trim()
    if (trimmedSlug && trimmedSlug.length > 24) {
      setTeamError('Slug must be 24 characters or fewer.')
      return
    }

    setUpdatingTeam(true)
    setTeamError(null)
    try {
      const updated = await updateAdminTeam(
        teamId,
        {
          name: teamName.trim() || undefined,
          slug: trimmedSlug || undefined,
          logo: teamLogo.trim() || null,
        },
        authHeader,
      )
      setTeam(updated)
      setTeamName(updated.name || '')
      setTeamSlug(updated.slug || '')
      setTeamLogo(updated.logo || '')
      setIsTeamModalOpen(false)
      setSuccess('Team parameters updated successfully.')
    } catch (cause) {
      setTeamError(cause instanceof Error ? cause.message : 'Failed to update team parameters')
    } finally {
      setUpdatingTeam(false)
    }
  }

  async function handleAddMember(evt: React.FormEvent) {
    evt.preventDefault()
    if (!selectedUserId) {
      setMemberError('Please select a system user.')
      return
    }
    if (!authHeader) return

    setAddingMember(true)
    setMemberError(null)
    try {
      const updated = await addAdminTeamMember(
        teamId,
        {
          userId: selectedUserId,
          role: selectedRole,
        },
        authHeader,
      )
      setTeam(updated)
      setIsMemberModalOpen(false)
      setSuccess('Competitor added to team successfully.')
      void fetchRoster()
    } catch (cause) {
      setMemberError(cause instanceof Error ? cause.message : 'Failed to add team member')
    } finally {
      setAddingMember(false)
    }
  }

  async function handleRemoveMember(memberUserId: string) {
    if (!authHeader) return
    if (!confirm('Are you sure you want to remove this member from the team?')) return

    setError(null)
    setSuccess(null)
    try {
      const updated = await removeAdminTeamMember(teamId, memberUserId, authHeader)
      setTeam(updated)
      setSuccess('Member removed from team successfully.')
      void fetchRoster()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to remove member')
    }
  }

  async function handleChangeRole(memberUserId: string, newRole: string) {
    if (!authHeader) return

    setError(null)
    setSuccess(null)
    try {
      const updated = await updateAdminTeamMemberRole(teamId, memberUserId, newRole, authHeader)
      setTeam(updated)
      setSuccess(`Member role updated to ${newRole} successfully.`)
      void fetchRoster()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to change member role')
    }
  }

  const roleOptions = [
    { value: 'member', label: 'Member' },
    { value: 'administrator', label: 'Administrator' },
  ]

  const actions = (
    <div style={{ display: 'flex', gap: '8px' }}>
      <button
        type="button"
        onClick={() => {
          setTeamError(null)
          setIsTeamModalOpen(true)
        }}
        className="slds-button slds-button_neutral"
      >
        Edit Team Parameters
      </button>
      <button
        type="button"
        onClick={() => {
          setStatsError(null)
          setIsStatsModalOpen(true)
        }}
        className="slds-button slds-button_neutral"
      >
        Edit Statistics
      </button>
      <button
        type="button"
        onClick={() => {
          setMemberError(null)
          setIsMemberModalOpen(true)
        }}
        className="slds-button slds-button_brand"
      >
        Add Team Member
      </button>
    </div>
  )

  return (
    <AdminLayout
      title={team ? team.name : 'Team Detail'}
      subtitle={team ? `Manage demographics, statistics, and organizational roles for team: ${team.slug}` : 'Demographics and roles details'}
      actions={team ? actions : undefined}
    >
      <div className="slds-grid slds-wrap slds-gutters">
        {error && (
          <div className="slds-col slds-size_1-of-1 slds-m-bottom_medium">
            <AlertBanner variant="error">{error}</AlertBanner>
          </div>
        )}
        {success && (
          <div className="slds-col slds-size_1-of-1 slds-m-bottom_medium">
            <AlertBanner variant="success">{success}</AlertBanner>
          </div>
        )}

        {loading ? (
          <div className="slds-col slds-size_1-of-1 slds-align_absolute-center slds-p-around_large text-slate-500" style={{ textAlign: 'center' }}>
            <p>Loading team detail panel...</p>
          </div>
        ) : team ? (
          <>
            {/* Left Column: Demographics & Stats summary */}
            <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-3 slds-m-bottom_medium">
              <article className="slds-card" style={{ border: '1px solid #dddbda', height: '100%' }}>
                <div className="slds-card__header slds-grid">
                  <header className="slds-media slds-media_center slds-has-flexi-truncate">
                    <div className="slds-media__body">
                      <h2 className="slds-card__header-title">
                        <span className="slds-card__header-link slds-truncate font-semibold" style={{ fontWeight: 'bold' }}>
                          Team Profile & Statistics
                        </span>
                      </h2>
                    </div>
                  </header>
                </div>

                <div className="slds-card__body slds-card__body_inner" style={{ padding: '1.25rem' }}>
                  {/* Administrator Slots Remaining info */}
                  <div className="slds-box slds-m-bottom_medium" style={{ background: team.administratorSlotsRemaining > 0 ? '#ecfdf5' : '#fef2f2', border: team.administratorSlotsRemaining > 0 ? '1px solid #a7f3d0' : '1px solid #fecaca', borderRadius: '4px' }}>
                    <p className="font-bold text-sm" style={{ fontWeight: 'bold', color: team.administratorSlotsRemaining > 0 ? '#065f46' : '#991b1b' }}>
                      Administrator Slots Remaining
                    </p>
                    <p className="text-xl font-extrabold slds-m-top_xx-small" style={{ fontSize: '1.5rem', fontWeight: 'bold', color: team.administratorSlotsRemaining > 0 ? '#047857' : '#dc2626' }}>
                      {team.administratorSlotsRemaining} / 3 slots
                    </p>
                    <p className="text-xs slds-m-top_xx-small text-slate-500">
                      An organization may have at most three administrators belonging to it.
                    </p>
                  </div>

                  <div className="slds-m-bottom_medium">
                    <p className="slds-text-title text-slate-500" style={{ fontSize: '11px', textTransform: 'uppercase' }}>Slug Identifier</p>
                    <p className="font-semibold text-slate-900">{team.slug}</p>
                  </div>

                  <div className="slds-m-bottom_medium" style={{ borderTop: '1px solid #dddbda', paddingTop: '10px' }}>
                    <h3 className="font-bold text-slate-700 slds-m-bottom_small" style={{ fontWeight: 'bold' }}>Historical Statistics</h3>

                    <div className="slds-grid slds-wrap slds-gutters">
                      <div className="slds-col slds-size_1-of-2 slds-m-bottom_small">
                        <p className="slds-text-title text-slate-500" style={{ fontSize: '11px' }}>Season Rank</p>
                        <p className="text-lg font-bold">{team.stats.seasonRank ?? 'None'}</p>
                      </div>
                      <div className="slds-col slds-size_1-of-2 slds-m-bottom_small">
                        <p className="slds-text-title text-slate-500" style={{ fontSize: '11px' }}>Points Average</p>
                        <p className="text-lg font-bold">{team.stats.pointsAverage ?? 'None'}</p>
                      </div>
                      <div className="slds-col slds-size_1-of-2 slds-m-bottom_small">
                        <p className="slds-text-title text-slate-500" style={{ fontSize: '11px' }}>Ranking Average</p>
                        <p className="text-lg font-bold">{team.stats.rankingAverage ?? 'None'}</p>
                      </div>
                      <div className="slds-col slds-size_1-of-2 slds-m-bottom_small">
                        <p className="slds-text-title text-slate-500" style={{ fontSize: '11px' }}>Points / Event</p>
                        <p className="text-lg font-bold">{team.stats.averagePointsPerEvent ?? 'None'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            </div>

            {/* Right Column: Members list with roles & actions */}
            <div className="slds-col slds-size_1-of-1 slds-medium-size_2-of-3 slds-m-bottom_medium">
              <article className="slds-card" style={{ border: '1px solid #dddbda', height: '100%' }}>
                <div className="slds-card__header slds-grid">
                  <header className="slds-media slds-media_center slds-has-flexi-truncate">
                    <div className="slds-media__body">
                      <h2 className="slds-card__header-title">
                        <span className="slds-card__header-link slds-truncate font-semibold" style={{ fontWeight: 'bold' }}>
                          Team Roster ({totalMembers} Competitors)
                        </span>
                      </h2>
                    </div>
                  </header>
                </div>

                <div className="slds-card__body slds-card__body_inner" style={{ padding: '1.5rem' }}>
                  {/* Search Bar */}
                  <div className="slds-form-element slds-m-bottom_medium" style={{ maxWidth: '300px' }}>
                    <div className="slds-form-element__control">
                      <input
                        type="text"
                        placeholder="Search roster by name/slug..."
                        value={memberSearch}
                        onChange={(e) => {
                          setMemberSearch(e.target.value)
                          setMemberPage(1)
                        }}
                        className="slds-input"
                        style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px' }}
                      />
                    </div>
                  </div>

                  {members.length > 0 ? (
                    <>
                      <div style={{ overflowX: 'auto', border: '1px solid #dddbda', borderRadius: '4px' }}>
                        <table className="slds-table slds-table_cell-buffer slds-table_bordered" aria-label="Team Roster Table" style={{ width: '100%' }}>
                          <thead>
                            <tr className="slds-line-height_reset" style={{ background: '#f3f2f1' }}>
                              <th scope="col" style={{ width: '250px' }}>
                                <div className="slds-truncate font-bold" title="Competitor Name" style={{ fontWeight: 'bold' }}>Competitor Name</div>
                              </th>
                              <th scope="col" style={{ width: '250px' }}>
                                <div className="slds-truncate font-bold" title="Roster Role" style={{ fontWeight: 'bold' }}>Roster Role</div>
                              </th>
                              <th scope="col" style={{ width: '150px' }}>
                                <div className="slds-truncate font-bold" title="Role Action" style={{ fontWeight: 'bold' }}>Change Role</div>
                              </th>
                              <th scope="col" style={{ width: '120px' }}>
                                <div className="slds-truncate font-bold" title="Actions" style={{ fontWeight: 'bold' }}>Actions</div>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {members.map((member) => (
                              <tr key={member.userId} className="slds-hint-parent hover:bg-slate-50">
                                <th scope="row">
                                  <div className="slds-truncate font-bold" title={member.name}>
                                    <Link
                                      to="/admin/users/$userId"
                                      params={{ userId: member.userId }}
                                      className="text-blue-600 hover:underline font-bold"
                                    >
                                      {member.name}
                                    </Link>
                                    {member.slug && (
                                      <span style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 'normal' }}>
                                        @{member.slug}
                                      </span>
                                    )}
                                  </div>
                                </th>
                                <td>
                                  <span className={`slds-badge ${member.role === 'administrator' ? 'slds-theme_success' : 'slds-theme_light'}`} style={{ padding: '2px 8px', borderRadius: '4px' }}>
                                    {member.role}
                                  </span>
                                </td>
                                <td>
                                  <select
                                    value={member.role}
                                    onChange={(e) => handleChangeRole(member.userId, e.target.value)}
                                    className="slds-select"
                                    style={{ padding: '2px 8px', height: '28px', fontSize: '12px', minWidth: '150px' }}
                                  >
                                    {roleOptions.map((opt) => (
                                      <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveMember(member.userId)}
                                    className="slds-button slds-button_destructive"
                                    style={{ fontSize: '12px', padding: '2px 10px', background: '#d32f2f', color: '#fff' }}
                                  >
                                    Remove
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <Pagination
                        page={memberPage}
                        pageSize={memberPageSize}
                        total={totalMembers}
                        onPageChange={setMemberPage}
                        onPageSizeChange={setMemberPageSize}
                      />
                    </>
                  ) : (
                    <div className="slds-align_absolute-center text-slate-500 slds-p-around_large" style={{ textAlign: 'center', border: '1px dashed #dddbda', borderRadius: '4px' }}>
                      <p>This team does not have any roster members. Click "Add Team Member" to populate the team roster.</p>
                    </div>
                  )}
                </div>

                <footer className="slds-card__footer" style={{ borderTop: '1px solid #f3f2f1', padding: '1rem' }}>
                  <Link to="/admin/teams" className="slds-button slds-button_neutral" style={{ textDecoration: 'none' }}>
                    Back to Team Directory
                  </Link>
                </footer>
              </article>
            </div>
          </>
        ) : (
          <div className="slds-col slds-size_1-of-1 slds-align_absolute-center slds-p-around_large text-slate-500" style={{ textAlign: 'center' }}>
            <p>Team data structure could not be mapped.</p>
          </div>
        )}
      </div>

      {/* Edit Stats Modal */}
      {isStatsModalOpen && (
        <>
          <section role="dialog" tabIndex={-1} aria-modal="true" className="slds-modal slds-fade-in-open" style={{ zIndex: 9001 }}>
            <div className="slds-modal__container" style={{ maxWidth: '40rem', width: '90%' }}>
              <header className="slds-modal__header">
                <button
                  type="button"
                  onClick={() => setIsStatsModalOpen(false)}
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
                  Configure Team Historical Statistics
                </h2>
              </header>

              <form onSubmit={(e) => void handleUpdateStats(e)}>
                <div className="slds-modal__content slds-p-around_medium" style={{ background: '#fff' }}>
                  {statsError && (
                    <div className="slds-m-bottom_medium">
                      <AlertBanner variant="error">{statsError}</AlertBanner>
                    </div>
                  )}

                  <div className="slds-form slds-form_stacked">
                    <div className="slds-grid slds-wrap slds-gutters">
                      <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-m-bottom_medium">
                        <div className="slds-form-element">
                          <label className="slds-form-element__label font-bold text-slate-700" style={{ fontWeight: 'bold' }} htmlFor="season-rank-input">
                            Season Rank
                          </label>
                          <div className="slds-form-element__control">
                            <input
                              id="season-rank-input"
                              type="number"
                              value={seasonRank}
                              onChange={(e) => setSeasonRank(e.target.value)}
                              placeholder="e.g. 1"
                              className="slds-input"
                              style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px' }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-m-bottom_medium">
                        <div className="slds-form-element">
                          <label className="slds-form-element__label font-bold text-slate-700" style={{ fontWeight: 'bold' }} htmlFor="points-average-input">
                            Points Average
                          </label>
                          <div className="slds-form-element__control">
                            <input
                              id="points-average-input"
                              type="number"
                              step="any"
                              value={pointsAverage}
                              onChange={(e) => setPointsAverage(e.target.value)}
                              placeholder="e.g. 112.4"
                              className="slds-input"
                              style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px' }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-m-bottom_medium">
                        <div className="slds-form-element">
                          <label className="slds-form-element__label font-bold text-slate-700" style={{ fontWeight: 'bold' }} htmlFor="ranking-average-input">
                            Ranking Average
                          </label>
                          <div className="slds-form-element__control">
                            <input
                              id="ranking-average-input"
                              type="number"
                              step="any"
                              value={rankingAverage}
                              onChange={(e) => setRankingAverage(e.target.value)}
                              placeholder="e.g. 3.2"
                              className="slds-input"
                              style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px' }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-m-bottom_medium">
                        <div className="slds-form-element">
                          <label className="slds-form-element__label font-bold text-slate-700" style={{ fontWeight: 'bold' }} htmlFor="avg-pts-event-input">
                            Average Points Per Event
                          </label>
                          <div className="slds-form-element__control">
                            <input
                              id="avg-pts-event-input"
                              type="number"
                              step="any"
                              value={averagePointsPerEvent}
                              onChange={(e) => setAveragePointsPerEvent(e.target.value)}
                              placeholder="e.g. 14.5"
                              className="slds-input"
                              style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px' }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <footer className="slds-modal__footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setIsStatsModalOpen(false)}
                    className="slds-button slds-button_neutral"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updatingStats}
                    className="slds-button slds-button_brand"
                  >
                    {updatingStats ? 'Updating...' : 'Save Statistics'}
                  </button>
                </footer>
              </form>
            </div>
          </section>
          <div className="slds-backdrop slds-backdrop_open" style={{ zIndex: 9000 }}></div>
        </>
      )}

      {/* Add Member Modal */}
      {isMemberModalOpen && (
        <>
          <section role="dialog" tabIndex={-1} aria-modal="true" className="slds-modal slds-fade-in-open" style={{ zIndex: 9001 }}>
            <div className="slds-modal__container" style={{ maxWidth: '40rem', width: '90%' }}>
              <header className="slds-modal__header">
                <button
                  type="button"
                  onClick={() => setIsMemberModalOpen(false)}
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
                  Add Team Member
                </h2>
              </header>

              <form onSubmit={(e) => void handleAddMember(e)}>
                <div className="slds-modal__content slds-p-around_medium" style={{ background: '#fff' }}>
                  {memberError && (
                    <div className="slds-m-bottom_medium">
                      <AlertBanner variant="error">{memberError}</AlertBanner>
                    </div>
                  )}

                  <div className="slds-form slds-form_stacked">
                    <div className="slds-form-element slds-m-bottom_medium">
                      <label className="slds-form-element__label font-bold text-slate-700" style={{ fontWeight: 'bold' }} htmlFor="select-user-dropdown">
                        Select System Competitor
                      </label>
                      <div className="slds-form-element__control">
                        <UserSearchCombobox
                          value={selectedUserId}
                          onChange={(val) => setSelectedUserId(val)}
                        />
                      </div>
                    </div>

                    <div className="slds-form-element">
                      <label className="slds-form-element__label font-bold text-slate-700" style={{ fontWeight: 'bold' }} htmlFor="select-role-dropdown">
                        Initial Roster Role
                      </label>
                      <div className="slds-form-element__control">
                        <select
                          id="select-role-dropdown"
                          value={selectedRole}
                          onChange={(e) => setSelectedRole(e.target.value)}
                          className="slds-select"
                          style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px' }}
                        >
                          {roleOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                <footer className="slds-modal__footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setIsMemberModalOpen(false)}
                    className="slds-button slds-button_neutral"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addingMember}
                    className="slds-button slds-button_brand"
                  >
                    {addingMember ? 'Adding...' : 'Add Member'}
                  </button>
                </footer>
              </form>
            </div>
          </section>
          <div className="slds-backdrop slds-backdrop_open" style={{ zIndex: 9000 }}></div>
        </>
      )}

      {/* Edit Team Modal */}
      {isTeamModalOpen && (
        <>
          <section role="dialog" tabIndex={-1} aria-modal="true" className="slds-modal slds-fade-in-open" style={{ zIndex: 9001 }}>
            <div className="slds-modal__container" style={{ maxWidth: '40rem', width: '90%' }}>
              <header className="slds-modal__header">
                <button
                  type="button"
                  onClick={() => setIsTeamModalOpen(false)}
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
                  Configure Team Parameters
                </h2>
              </header>

              <form onSubmit={(e) => void handleUpdateTeam(e)}>
                <div className="slds-modal__content slds-p-around_medium" style={{ background: '#fff' }}>
                  {teamError && (
                    <div className="slds-m-bottom_medium">
                      <AlertBanner variant="error">{teamError}</AlertBanner>
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
                          value={teamName}
                          onChange={(e) => setTeamName(e.target.value)}
                          placeholder="e.g. My Racing Team"
                          className="slds-input"
                          style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px' }}
                          required
                        />
                      </div>
                    </div>

                    <div className="slds-form-element slds-m-bottom_medium">
                      <label className="slds-form-element__label font-bold text-slate-700" style={{ fontWeight: 'bold' }} htmlFor="team-slug-input">
                        Team Slug
                      </label>
                      <div className="slds-form-element__control">
                        <input
                          id="team-slug-input"
                          type="text"
                          value={teamSlug}
                          onChange={(e) => setTeamSlug(e.target.value)}
                          placeholder="e.g. my-racing-team"
                          className="slds-input"
                          style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px' }}
                          required
                        />
                      </div>
                      <div className="slds-m-top_xx-small text-slate-400" style={{ fontSize: '11px' }}>
                        Slug must be 24 characters or fewer.
                      </div>
                    </div>

                    <div className="slds-form-element">
                      <label className="slds-form-element__label font-bold text-slate-700" style={{ fontWeight: 'bold' }} htmlFor="team-logo-input">
                        Team Logo URL
                      </label>
                      <div className="slds-form-element__control">
                        <input
                          id="team-logo-input"
                          type="text"
                          value={teamLogo}
                          onChange={(e) => setTeamLogo(e.target.value)}
                          placeholder="e.g. https://example.com/logo.png"
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
                    onClick={() => setIsTeamModalOpen(false)}
                    className="slds-button slds-button_neutral"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updatingTeam}
                    className="slds-button slds-button_brand"
                  >
                    {updatingTeam ? 'Updating...' : 'Save Parameters'}
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
