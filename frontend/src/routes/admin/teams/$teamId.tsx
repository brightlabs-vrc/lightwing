import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { Button, CounterLabel, Dialog, FormControl, Label, Select, TextInput } from '@primer/react'
import { ArrowLeftIcon, ArrowSwitchIcon, PencilIcon, PersonAddIcon, SearchIcon, TrashIcon } from '@primer/octicons-react'
import { useAuth } from '../../../hooks/useAuth'
import { requireAdminPanel } from '../../../lib/auth-guard'
import {
  addAdminTeamMember,
  convertAdminTeamToOrg,
  deleteAdminTeam,
  getAdminTeam,
  listAdminTeamMembers,
  removeAdminTeamMember,
  updateAdminTeam,
  updateAdminTeamMemberRole,
  updateAdminTeamStats,
} from '../../../lib/admin-api'
import { AdminLayout } from '../-AdminLayout'
import { AlertBanner } from '../../../components/AlertBanner'
import { UserSearchCombobox } from '../../../components/UserSearchCombobox'
import { Pagination } from '../../../components/Pagination'
import { UserLink } from '../../../components/UserLink'
import { PrimerSkeletonDetail } from '../../../components/LoadingSkeleton'
import { DangerZoneDeleteDialog } from '../../../components/DangerZoneDeleteDialog'
import type { teammanager } from '../../../lib/client'

export const Route = createFileRoute('/admin/teams/$teamId')({
  beforeLoad: async ({ location }) => {
    await requireAdminPanel(location)
  },
  component: AdminTeamDetailPage,
})

function AdminTeamDetailPage() {
  const { teamId } = Route.useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const isSiteAdmin = session?.user.siteRole === 'SITE_ADMIN'

  const [team, setTeam] = useState<teammanager.Team | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [members, setMembers] = useState<Array<{ userId: string; name: string; slug: string | null; role: string }>>([])
  const [totalMembers, setTotalMembers] = useState(0)
  const [memberPage, setMemberPage] = useState(1)
  const [memberPageSize, setMemberPageSize] = useState(10)
  const [memberSearch, setMemberSearch] = useState('')

  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false)
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false)
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false)

  const [seasonRank, setSeasonRank] = useState('')
  const [pointsAverage, setPointsAverage] = useState('')
  const [rankingAverage, setRankingAverage] = useState('')
  const [averagePointsPerEvent, setAveragePointsPerEvent] = useState('')
  const [updatingStats, setUpdatingStats] = useState(false)
  const [statsError, setStatsError] = useState<string | null>(null)

  const [convertingOrg, setConvertingOrg] = useState(false)

  const [teamName, setTeamName] = useState('')
  const [teamSlug, setTeamSlug] = useState('')
  const [teamLogo, setTeamLogo] = useState('')
  const [updatingTeam, setUpdatingTeam] = useState(false)
  const [teamError, setTeamError] = useState<string | null>(null)

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
      setSeasonRank(loadedTeam.stats.seasonRank !== null ? String(loadedTeam.stats.seasonRank) : '')
      setPointsAverage(loadedTeam.stats.pointsAverage !== null ? String(loadedTeam.stats.pointsAverage) : '')
      setRankingAverage(loadedTeam.stats.rankingAverage !== null ? String(loadedTeam.stats.rankingAverage) : '')
      setAveragePointsPerEvent(loadedTeam.stats.averagePointsPerEvent !== null ? String(loadedTeam.stats.averagePointsPerEvent) : '')
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
      const updated = await addAdminTeamMember(teamId, { userId: selectedUserId, role: selectedRole }, authHeader)
      setTeam(updated)
      setIsMemberModalOpen(false)
      setSelectedUserId('')
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
      setSuccess(`Member role updated to ${newRole}.`)
      void fetchRoster()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to change member role')
    }
  }

  async function handleConvertToOrg() {
    if (!authHeader || !team) return
    if (!confirm('Are you sure you want to promote/convert this team into an organization?')) return
    setConvertingOrg(true)
    setError(null)
    setSuccess(null)
    try {
      const updatedOrg = await convertAdminTeamToOrg(teamId, authHeader)
      setSuccess('Team converted to organization successfully.')
      void navigate({ to: '/admin/organizations/$orgId', params: { orgId: updatedOrg.id } })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to convert team to organization')
    } finally {
      setConvertingOrg(false)
    }
  }

  async function handleDeleteTeam() {
    if (!team || !authHeader) return
    await deleteAdminTeam(team.id, authHeader)
    void navigate({ to: '/admin/teams' })
  }

  const roleOptions = [
    { value: 'member', label: 'Member' },
    { value: 'administrator', label: 'Administrator' },
  ]

  return (
    <AdminLayout
      title={team ? team.name : 'Team Detail'}
      subtitle={team ? `Manage demographics, statistics, and roster for @${team.slug}` : 'Team details'}
      breadcrumbs={[
        { label: 'Admin', to: '/admin' },
        { label: 'Teams', to: '/admin/teams' },
        { label: team ? team.name : teamId },
      ]}
      actions={
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Link to="/admin/teams" style={{ textDecoration: 'none' }}>
            <Button leadingVisual={ArrowLeftIcon}>Back</Button>
          </Link>
          {team && (
            <>
              <Button
                type="button"
                leadingVisual={ArrowSwitchIcon}
                disabled={convertingOrg}
                onClick={() => void handleConvertToOrg()}
              >
                {convertingOrg ? 'Converting...' : 'Convert to Org'}
              </Button>
              <Button
                type="button"
                leadingVisual={PencilIcon}
                onClick={() => {
                  setTeamError(null)
                  setIsTeamModalOpen(true)
                }}
              >
                Edit Team
              </Button>
              <Button
                type="button"
                variant="primary"
                leadingVisual={PersonAddIcon}
                onClick={() => {
                  setMemberError(null)
                  setIsMemberModalOpen(true)
                }}
              >
                Add Member
              </Button>
            </>
          )}
        </div>
      }
    >
      {error && <AlertBanner variant="error">{error}</AlertBanner>}
      {success && <AlertBanner variant="success">{success}</AlertBanner>}

      {loading ? (
        <PrimerSkeletonDetail />
      ) : team ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Team Summary & Stats */}
          <section className="primer-box">
            <div className="primer-box-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Team Profile &amp; Statistics</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Label variant="success">{team.status || 'APPROVED'}</Label>
                <Button size="small" onClick={() => setIsStatsModalOpen(true)}>
                  Edit Stats
                </Button>
              </div>
            </div>
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: 'var(--fgColor-muted, #636c76)' }}>Slug</div>
                  <div style={{ fontSize: '14px', fontWeight: 600 }}>@{team.slug}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: 'var(--fgColor-muted, #636c76)' }}>Season Rank</div>
                  <div style={{ fontSize: '16px', fontWeight: 600 }}>{team.stats.seasonRank ?? '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: 'var(--fgColor-muted, #636c76)' }}>Points Avg</div>
                  <div style={{ fontSize: '16px', fontWeight: 600 }}>{team.stats.pointsAverage ?? '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: 'var(--fgColor-muted, #636c76)' }}>Ranking Avg</div>
                  <div style={{ fontSize: '16px', fontWeight: 600 }}>{team.stats.rankingAverage ?? '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: 'var(--fgColor-muted, #636c76)' }}>Pts / Event</div>
                  <div style={{ fontSize: '16px', fontWeight: 600 }}>{team.stats.averagePointsPerEvent ?? '—'}</div>
                </div>
              </div>

              {(team.organizations?.length ?? 0) > 0 && (
                <div style={{ borderTop: '1px solid var(--borderColor-muted, #d8dee4)', paddingTop: '12px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: 'var(--fgColor-muted, #636c76)' }}>
                    Linked Organizations ({team.organizations?.length || 0})
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {(team.organizations || []).map((org) => (
                      <Link
                        key={org.id}
                        to="/admin/organizations/$orgId"
                        params={{ orgId: org.id }}
                        style={{
                          textDecoration: 'none',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: '1px solid var(--borderColor-default, #d0d7de)',
                          backgroundColor: 'var(--bgColor-muted, #f6f8fa)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          color: 'var(--fgColor-default, #1f2328)',
                          fontSize: '13px',
                        }}
                      >
                        <strong>{org.name}</strong>
                        <Label variant={org.isPrimary ? 'success' : 'secondary'} size="small">
                          {org.isPrimary ? 'Primary' : 'Secondary'}
                        </Label>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Team Roster */}
          <section className="primer-box">
            <div
              className="primer-box-header"
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Team Roster</h2>
                <CounterLabel>{totalMembers}</CounterLabel>
              </div>
              <div style={{ minWidth: '220px' }}>
                <TextInput
                  size="small"
                  block
                  leadingVisual={SearchIcon}
                  placeholder="Search roster..."
                  value={memberSearch}
                  onChange={(e) => {
                    setMemberSearch(e.target.value)
                    setMemberPage(1)
                  }}
                />
              </div>
            </div>

            {members.length > 0 ? (
              <>
                <div style={{ overflowX: 'auto' }}>
                  <table className="primer-table" aria-label="Team Roster Table" style={{ minWidth: '580px' }}>
                    <thead>
                      <tr>
                        <th>Competitor</th>
                        <th style={{ width: '130px' }}>Role</th>
                        <th style={{ width: '170px' }}>Change Role</th>
                        <th style={{ width: '100px', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((member) => (
                        <tr key={member.userId}>
                          <td>
                            <div style={{ fontWeight: 600 }}>
                              <UserLink userId={member.userId} name={member.name} />
                            </div>
                            {member.slug && (
                              <div style={{ fontSize: '11px', color: 'var(--fgColor-muted, #636c76)' }}>
                                @{member.slug}
                              </div>
                            )}
                          </td>
                          <td>
                            <Label variant={member.role === 'administrator' ? 'accent' : 'secondary'} size="small">
                              {member.role}
                            </Label>
                          </td>
                          <td>
                            <Select
                              size="small"
                              block
                              value={member.role}
                              onChange={(e) => void handleChangeRole(member.userId, e.target.value)}
                            >
                              {roleOptions.map((opt) => (
                                <Select.Option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </Select.Option>
                              ))}
                            </Select>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <Button
                              type="button"
                              size="small"
                              variant="danger"
                              leadingVisual={TrashIcon}
                              onClick={() => void handleRemoveMember(member.userId)}
                            >
                              Remove
                            </Button>
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
              <div style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: 'var(--fgColor-muted, #636c76)' }}>
                This team does not have any roster members yet.
              </div>
            )}
          </section>

          {/* Danger Zone (SITE_ADMIN only) */}
          {isSiteAdmin && (
            <DangerZoneDeleteDialog
              entityType="team"
              entityName={team.name}
              confirmText={team.slug}
              cardDescription="Permanently delete this competitive team, its roster memberships, and linked organization associations."
              consequences={[
                'The competitive team profile and its historical display metadata.',
                'All team roster memberships and linked organization associations.',
              ]}
              onConfirmDelete={handleDeleteTeam}
            />
          )}
        </div>
      ) : (
        <div className="primer-box" style={{ padding: '32px', textAlign: 'center', color: 'var(--fgColor-muted, #636c76)' }}>
          Team not found.
        </div>
      )}

      {isStatsModalOpen && (
        <Dialog title="Configure Team Statistics" onClose={() => setIsStatsModalOpen(false)} width="medium">
          <form onSubmit={(e) => void handleUpdateStats(e)} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {statsError && <AlertBanner variant="error">{statsError}</AlertBanner>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <FormControl>
                <FormControl.Label>Season Rank</FormControl.Label>
                <TextInput block type="number" value={seasonRank} onChange={(e) => setSeasonRank(e.target.value)} placeholder="e.g. 1" />
              </FormControl>
              <FormControl>
                <FormControl.Label>Points Average</FormControl.Label>
                <TextInput block type="number" step="any" value={pointsAverage} onChange={(e) => setPointsAverage(e.target.value)} placeholder="e.g. 112.4" />
              </FormControl>
              <FormControl>
                <FormControl.Label>Ranking Average</FormControl.Label>
                <TextInput block type="number" step="any" value={rankingAverage} onChange={(e) => setRankingAverage(e.target.value)} placeholder="e.g. 3.2" />
              </FormControl>
              <FormControl>
                <FormControl.Label>Avg Points / Event</FormControl.Label>
                <TextInput block type="number" step="any" value={averagePointsPerEvent} onChange={(e) => setAveragePointsPerEvent(e.target.value)} placeholder="e.g. 14.5" />
              </FormControl>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '8px', borderTop: '1px solid var(--borderColor-muted, #d8dee4)' }}>
              <Button type="button" onClick={() => setIsStatsModalOpen(false)} disabled={updatingStats}>Cancel</Button>
              <Button type="submit" variant="primary" disabled={updatingStats}>{updatingStats ? 'Saving...' : 'Save Statistics'}</Button>
            </div>
          </form>
        </Dialog>
      )}

      {isMemberModalOpen && (
        <Dialog title="Add Team Member" onClose={() => setIsMemberModalOpen(false)} width="medium">
          <form onSubmit={(e) => void handleAddMember(e)} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {memberError && <AlertBanner variant="error">{memberError}</AlertBanner>}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Select Competitor</label>
              <UserSearchCombobox value={selectedUserId} onChange={(val) => setSelectedUserId(val)} />
            </div>
            <FormControl>
              <FormControl.Label>Initial Roster Role</FormControl.Label>
              <Select block value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
                {roleOptions.map((opt) => (
                  <Select.Option key={opt.value} value={opt.value}>{opt.label}</Select.Option>
                ))}
              </Select>
            </FormControl>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '8px', borderTop: '1px solid var(--borderColor-muted, #d8dee4)' }}>
              <Button type="button" onClick={() => setIsMemberModalOpen(false)} disabled={addingMember}>Cancel</Button>
              <Button type="submit" variant="primary" disabled={addingMember}>{addingMember ? 'Adding...' : 'Add Member'}</Button>
            </div>
          </form>
        </Dialog>
      )}

      {isTeamModalOpen && (
        <Dialog title="Edit Team Parameters" onClose={() => setIsTeamModalOpen(false)} width="medium">
          <form onSubmit={(e) => void handleUpdateTeam(e)} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {teamError && <AlertBanner variant="error">{teamError}</AlertBanner>}
            <FormControl required>
              <FormControl.Label>Team Name</FormControl.Label>
              <TextInput block required value={teamName} onChange={(e) => setTeamName(e.target.value)} />
            </FormControl>
            <FormControl required>
              <FormControl.Label>Team Slug</FormControl.Label>
              <TextInput block required value={teamSlug} onChange={(e) => setTeamSlug(e.target.value)} />
            </FormControl>
            <FormControl>
              <FormControl.Label>Logo URL</FormControl.Label>
              <TextInput block value={teamLogo} onChange={(e) => setTeamLogo(e.target.value)} />
            </FormControl>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '8px', borderTop: '1px solid var(--borderColor-muted, #d8dee4)' }}>
              <Button type="button" onClick={() => setIsTeamModalOpen(false)} disabled={updatingTeam}>Cancel</Button>
              <Button type="submit" variant="primary" disabled={updatingTeam}>{updatingTeam ? 'Saving...' : 'Save Parameters'}</Button>
            </div>
          </form>
        </Dialog>
      )}
    </AdminLayout>
  )
}
