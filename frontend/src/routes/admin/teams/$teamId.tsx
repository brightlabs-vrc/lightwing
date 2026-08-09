import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
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
  listAdminTeamMembers,
} from '../../../lib/admin-api'
import { AdminLayout } from '../-AdminLayout'
import { AlertBanner } from '../../../components/AlertBanner'
import { UserSearchCombobox } from '../../../components/UserSearchCombobox'
import { PaginationBar } from '../../../components/Pagination'
import { UserLink } from '../../../components/UserLink'
import { Heading, Text, Label, Button, TextInput, FormControl, Spinner, Dialog, Select } from '@primer/react'
import type { teammanager } from '../../../lib/client'

export const Route = createFileRoute('/admin/teams/$teamId')({
  beforeLoad: async ({ location }) => {
    await requireSiteAdmin(location)
  },
  component: AdminTeamDetailPage,
})

function AdminTeamDetailPage() {
  const { teamId } = Route.useParams()
  const { session } = useAuth()
  const navigate = useNavigate()
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
      <Button
        onClick={() => {
          setTeamError(null)
          setIsTeamModalOpen(true)
        }}
      >
        Edit Team Parameters
      </Button>
      <Button
        onClick={() => {
          setStatsError(null)
          setIsStatsModalOpen(true)
        }}
      >
        Edit Statistics
      </Button>
      <Button
        variant="primary"
        onClick={() => {
          setMemberError(null)
          setIsMemberModalOpen(true)
        }}
      >
        Add Team Member
      </Button>
    </div>
  )

  return (
    <AdminLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {error && (
          <AlertBanner variant="error">{error}</AlertBanner>
        )}
        {success && (
          <AlertBanner variant="success">{success}</AlertBanner>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '3rem', gap: '0.5rem', color: 'var(--color-fg-muted)' }}>
            <Spinner size="small" />
            <span>Loading team detail panel...</span>
          </div>
        ) : team ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '1.5rem',
            alignItems: 'start'
          }}>
            {/* Left Column: Demographics & Stats summary */}
            <div style={{
              border: '1px solid var(--color-border-default)',
              borderRadius: '6px',
              backgroundColor: 'var(--color-canvas-default)',
              boxShadow: 'var(--color-shadow-small)',
              overflow: 'hidden'
            }}>
              <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--color-border-default)' }}>
                <Heading as="h2" style={{ fontSize: '18px', margin: 0 }}>
                  Team Profile & Statistics
                </Heading>
              </div>

              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Administrator Slots Remaining info */}
                <div style={{
                  backgroundColor: team.administratorSlotsRemaining > 0 ? '#ecfdf5' : '#fef2f2',
                  border: team.administratorSlotsRemaining > 0 ? '1px solid #a7f3d0' : '1px solid #fecaca',
                  borderRadius: '6px',
                  padding: '1rem'
                }}>
                  <p style={{ fontWeight: 'bold', margin: 0, fontSize: '14px', color: team.administratorSlotsRemaining > 0 ? 'var(--color-success-emphasis)' : 'var(--color-danger-emphasis)' }}>
                    Administrator Slots Remaining
                  </p>
                  <p style={{ fontSize: '24px', fontWeight: 'bold', margin: '4px 0 0 0', color: team.administratorSlotsRemaining > 0 ? 'var(--color-success-fg)' : 'var(--color-danger-fg)' }}>
                    {team.administratorSlotsRemaining} / 3 slots
                  </p>
                  <p style={{ fontSize: '12px', margin: '4px 0 0 0', color: 'var(--color-fg-muted)' }}>
                    An organization may have at most three administrators belonging to it.
                  </p>
                </div>

                <div>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-fg-muted)', fontWeight: 'bold', display: 'block', marginBottom: '0.25rem' }}>Slug Identifier</span>
                  <span style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--color-fg-default)' }}>{team.slug}</span>
                </div>

                <div style={{ borderTop: '1px solid var(--color-border-default)', paddingTop: '1rem' }}>
                  <Heading as="h3" style={{ fontSize: '16px', marginBottom: '1rem' }}>Historical Statistics</Heading>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-fg-muted)', fontWeight: 'bold', display: 'block', marginBottom: '0.25rem' }}>Season Rank</span>
                      <span style={{ fontSize: '16px', fontWeight: 'bold' }}>{team.stats.seasonRank ?? 'None'}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-fg-muted)', fontWeight: 'bold', display: 'block', marginBottom: '0.25rem' }}>Points Average</span>
                      <span style={{ fontSize: '16px', fontWeight: 'bold' }}>{team.stats.pointsAverage ?? 'None'}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-fg-muted)', fontWeight: 'bold', display: 'block', marginBottom: '0.25rem' }}>Ranking Average</span>
                      <span style={{ fontSize: '16px', fontWeight: 'bold' }}>{team.stats.rankingAverage ?? 'None'}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-fg-muted)', fontWeight: 'bold', display: 'block', marginBottom: '0.25rem' }}>Points / Event</span>
                      <span style={{ fontSize: '16px', fontWeight: 'bold' }}>{team.stats.averagePointsPerEvent ?? 'None'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Members list with roles & actions */}
            <div style={{
              border: '1px solid var(--color-border-default)',
              borderRadius: '6px',
              backgroundColor: 'var(--color-canvas-default)',
              boxShadow: 'var(--color-shadow-small)',
              overflow: 'hidden'
            }}>
              <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--color-border-default)' }}>
                <Heading as="h2" style={{ fontSize: '18px', margin: 0 }}>
                  Team Roster ({totalMembers} Competitors)
                </Heading>
              </div>

              <div style={{ padding: '1.5rem' }}>
                {/* Search Bar */}
                <div style={{ maxWidth: '300px', marginBottom: '1.5rem' }}>
                  <TextInput
                    placeholder="Search roster by name/slug..."
                    value={memberSearch}
                    onChange={(e) => {
                      setMemberSearch(e.target.value)
                      setMemberPage(1)
                    }}
                    width="100%"
                  />
                </div>

                {members.length > 0 ? (
                  <>
                    <div style={{ overflowX: 'auto', border: '1px solid #d0d7de', borderRadius: '6px', marginBottom: '1rem' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                        <thead>
                          <tr style={{ background: '#f6f8fa', borderBottom: '1px solid #d0d7de' }}>
                            <th style={{ padding: '12px', fontWeight: 'bold' }}>Competitor Name</th>
                            <th style={{ padding: '12px', fontWeight: 'bold' }}>Roster Role</th>
                            <th style={{ padding: '12px', fontWeight: 'bold' }}>Change Role</th>
                            <th style={{ padding: '12px', fontWeight: 'bold' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {members.map((member) => (
                            <tr key={member.userId} style={{ borderBottom: '1px solid #d0d7de' }}>
                              <td style={{ padding: '12px', fontWeight: 'bold' }}>
                                <UserLink userId={member.userId} name={member.name} />
                                {member.slug && (
                                  <span style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 'normal' }}>
                                    @{member.slug}
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '12px' }}>
                                <Label variant={member.role === 'administrator' ? 'success' : 'default'}>
                                  {member.role}
                                </Label>
                              </td>
                              <td style={{ padding: '12px' }}>
                                <Select
                                  value={member.role}
                                  onChange={(e) => handleChangeRole(member.userId, e.target.value)}
                                  size="small"
                                >
                                  {roleOptions.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </Select>
                              </td>
                              <td style={{ padding: '12px' }}>
                                <Button
                                  variant="danger"
                                  size="small"
                                  onClick={() => handleRemoveMember(member.userId)}
                                >
                                  Remove
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <PaginationBar
                      page={memberPage}
                      pageSize={memberPageSize}
                      total={totalMembers}
                      onPageChange={setMemberPage}
                      onPageSizeChange={setMemberPageSize}
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
                    <p>This team does not have any roster members. Click "Add Team Member" to populate the team roster.</p>
                  </div>
                )}
              </div>

              <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--color-border-default)', backgroundColor: 'var(--color-canvas-subtle)' }}>
                <Button as={Link} to="/admin/teams">
                  Back to Team Directory
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-fg-muted)', border: '1px dashed var(--color-border-default)', borderRadius: '6px' }}>
            <p>Team data structure could not be mapped.</p>
          </div>
        )}
      </div>

      {/* Edit Stats Modal */}
      {isStatsModalOpen && (
        <Dialog
          onClose={() => setIsStatsModalOpen(false)}
          title="Configure Team Historical Statistics"
        >
          <form onSubmit={(e) => void handleUpdateStats(e)}>
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {statsError && (
                <AlertBanner variant="error">{statsError}</AlertBanner>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <FormControl>
                  <FormControl.Label style={{ fontWeight: 'bold' }}>Season Rank</FormControl.Label>
                  <TextInput
                    type="number"
                    value={seasonRank}
                    onChange={(e) => setSeasonRank(e.target.value)}
                    placeholder="e.g. 1"
                    width="100%"
                  />
                </FormControl>

                <FormControl>
                  <FormControl.Label style={{ fontWeight: 'bold' }}>Points Average</FormControl.Label>
                  <TextInput
                    type="number"
                    step="any"
                    value={pointsAverage}
                    onChange={(e) => setPointsAverage(e.target.value)}
                    placeholder="e.g. 112.4"
                    width="100%"
                  />
                </FormControl>

                <FormControl>
                  <FormControl.Label style={{ fontWeight: 'bold' }}>Ranking Average</FormControl.Label>
                  <TextInput
                    type="number"
                    step="any"
                    value={rankingAverage}
                    onChange={(e) => setRankingAverage(e.target.value)}
                    placeholder="e.g. 3.2"
                    width="100%"
                  />
                </FormControl>

                <FormControl>
                  <FormControl.Label style={{ fontWeight: 'bold' }}>Average Points Per Event</FormControl.Label>
                  <TextInput
                    type="number"
                    step="any"
                    value={averagePointsPerEvent}
                    onChange={(e) => setAveragePointsPerEvent(e.target.value)}
                    placeholder="e.g. 14.5"
                    width="100%"
                  />
                </FormControl>
              </div>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              padding: '1rem 1.5rem',
              borderTop: '1px solid var(--color-border-default)',
              backgroundColor: 'var(--color-canvas-subtle)',
            }}>
              <Button type="button" onClick={() => setIsStatsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={updatingStats}>
                {updatingStats ? 'Updating...' : 'Save Statistics'}
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* Add Member Modal */}
      {isMemberModalOpen && (
        <Dialog
          onClose={() => setIsMemberModalOpen(false)}
          title="Add Team Member"
        >
          <form onSubmit={(e) => void handleAddMember(e)}>
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {memberError && (
                <AlertBanner variant="error">{memberError}</AlertBanner>
              )}

              <FormControl required>
                <FormControl.Label style={{ fontWeight: 'bold' }}>Select System Competitor</FormControl.Label>
                <UserSearchCombobox
                  value={selectedUserId}
                  onChange={(val) => setSelectedUserId(val)}
                />
              </FormControl>

              <FormControl>
                <FormControl.Label style={{ fontWeight: 'bold' }}>Initial Roster Role</FormControl.Label>
                <Select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  width="100%"
                >
                  {roleOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
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
              <Button type="button" onClick={() => setIsMemberModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={addingMember}>
                {addingMember ? 'Adding...' : 'Add Member'}
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* Edit Team Modal */}
      {isTeamModalOpen && (
        <Dialog
          onClose={() => setIsTeamModalOpen(false)}
          title="Configure Team Parameters"
        >
          <form onSubmit={(e) => void handleUpdateTeam(e)}>
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {teamError && (
                <AlertBanner variant="error">{teamError}</AlertBanner>
              )}

              <FormControl required>
                <FormControl.Label style={{ fontWeight: 'bold' }}>Team Name</FormControl.Label>
                <TextInput
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="e.g. My Racing Team"
                  required
                  width="100%"
                />
              </FormControl>

              <FormControl required>
                <FormControl.Label style={{ fontWeight: 'bold' }}>Team Slug</FormControl.Label>
                <TextInput
                  type="text"
                  value={teamSlug}
                  onChange={(e) => setTeamSlug(e.target.value)}
                  placeholder="e.g. my-racing-team"
                  required
                  width="100%"
                />
                <FormControl.Caption>
                  Slug must be 24 characters or fewer.
                </FormControl.Caption>
              </FormControl>

              <FormControl>
                <FormControl.Label style={{ fontWeight: 'bold' }}>Team Logo URL</FormControl.Label>
                <TextInput
                  type="text"
                  value={teamLogo}
                  onChange={(e) => setTeamLogo(e.target.value)}
                  placeholder="e.g. https://example.com/logo.png"
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
              <Button type="button" onClick={() => setIsTeamModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={updatingTeam}>
                {updatingTeam ? 'Updating...' : 'Save Parameters'}
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </AdminLayout>
  )
}
