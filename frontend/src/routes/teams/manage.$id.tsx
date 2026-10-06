import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { requireAuth } from '../../lib/auth-guard'
import {
  getAdminTeam,
  updateAdminTeam,
  addAdminTeamMember,
  updateAdminTeamMemberRole,
  removeAdminTeamMember,
  listAdminTeamMembers,
  linkSecondaryOrganization,
  unlinkSecondaryOrganization,
  listApprovedOrganizations,
} from '../../lib/admin-api'
import { AlertBanner } from '../../components/AlertBanner'
import { UserSearchCombobox } from '../../components/UserSearchCombobox'
import { Pagination } from '../../components/Pagination'
import { UserLink } from '../../components/UserLink'
import type { teammanager } from '../../lib/client'

export const Route = createFileRoute('/teams/manage/$id')({
  beforeLoad: async ({ location }) => {
    await requireAuth(location)
  },
  component: ManageTeamPage,
})

function ManageTeamPage() {
  const { id: teamId } = Route.useParams()
  const { session } = useAuth()
  const navigate = useNavigate()

  const [team, setTeam] = useState<teammanager.Team | null>(null)
  const [approvedOrgs, setApprovedOrgs] = useState<teammanager.LinkedOrganization[]>([])
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
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false)
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false)
  const [isLinkOrgModalOpen, setIsLinkOrgModalOpen] = useState(false)

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

  // Secondary Org Link form state
  const [targetOrgId, setTargetOrgId] = useState('')
  const [linkingOrg, setLinkingOrg] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)

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

      // Prepopulate team parameters form
      setTeamName(loadedTeam.name || '')
      setTeamSlug(loadedTeam.slug || '')
      setTeamLogo(loadedTeam.logo || '')

      const orgsRes = await listApprovedOrganizations()
      setApprovedOrgs(orgsRes.organizations || [])
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

  async function handleUpdateTeam(evt: React.FormEvent) {
    evt.preventDefault()
    if (!authHeader) return

    setUpdatingTeam(true)
    setTeamError(null)
    try {
      const updated = await updateAdminTeam(
        teamId,
        {
          name: teamName.trim() || undefined,
          slug: teamSlug.trim() || undefined,
          logo: teamLogo.trim() || null,
        },
        authHeader,
      )
      setTeam(updated)
      setIsTeamModalOpen(false)
      setSuccess('Team metadata updated successfully.')
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
      setSuccess('Member added to team successfully.')
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

  async function handleLinkSecondaryOrg(evt: React.FormEvent) {
    evt.preventDefault()
    if (!targetOrgId || !authHeader) return

    setLinkingOrg(true)
    setLinkError(null)
    try {
      const updated = await linkSecondaryOrganization(teamId, targetOrgId, authHeader)
      setTeam(updated)
      setIsLinkOrgModalOpen(false)
      setSuccess('Secondary organization linked successfully.')
    } catch (cause) {
      setLinkError(cause instanceof Error ? cause.message : 'Failed to link secondary organization')
    } finally {
      setLinkingOrg(false)
    }
  }

  async function handleUnlinkSecondaryOrg(orgId: string) {
    if (!authHeader) return
    if (!confirm('Are you sure you want to unlink this secondary organization?')) return

    setError(null)
    setSuccess(null)
    try {
      const updated = await unlinkSecondaryOrganization(teamId, orgId, authHeader)
      setTeam(updated)
      setSuccess('Secondary organization unlinked successfully.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to unlink secondary organization')
    }
  }

  const roleOptions = [
    { value: 'member', label: 'Member' },
    { value: 'administrator', label: 'Administrator' },
  ]

  return (
    <div className="slds-scope p-6 bg-slate-100 min-h-screen" style={{ padding: '2rem 1rem', background: '#f3f2f1', minHeight: '100vh' }}>
      <div className="max-w-6xl mx-auto" style={{ maxWidth: '72rem', margin: '0 auto' }}>
        {/* Page Header */}
        <div className="slds-page-header slds-m-bottom_medium" style={{ borderRadius: '6px', border: '1px solid #dddbda', background: '#fff', padding: '1.25rem' }}>
          <div className="slds-grid slds-grid_align-spread" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 className="slds-text-heading_large font-bold text-slate-900" style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                {team ? `Manage Team: ${team.name}` : 'Team Management'}
              </h1>
              {team && (
                <p className="slds-text-body_small text-slate-500" style={{ color: '#514f4d', marginTop: '4px' }}>
                  Slug: @{team.slug} | Primary Org ID: {team.primaryOrganizationId}
                </p>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => { setTeamError(null); setIsTeamModalOpen(true); }}
                className="slds-button slds-button_neutral"
              >
                Edit Metadata
              </button>
              <button
                type="button"
                onClick={() => { setMemberError(null); setIsMemberModalOpen(true); }}
                className="slds-button slds-button_brand"
              >
                Add Competitor
              </button>
            </div>
          </div>
        </div>

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

        {loading ? (
          <p className="text-slate-500">Loading team details...</p>
        ) : team ? (
          <div className="slds-grid slds-wrap slds-gutters" style={{ display: 'flex', gap: '16px' }}>
            {/* Left Column: Linked Organizations */}
            <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-3" style={{ flex: '1 1 300px' }}>
              <article className="slds-card" style={{ border: '1px solid #dddbda', borderRadius: '6px', background: '#fff', padding: '1.25rem' }}>
                <div className="slds-grid slds-grid_align-spread slds-m-bottom_medium" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 className="slds-text-heading_small font-bold" style={{ fontWeight: 'bold' }}>
                    Linked Organizations
                  </h2>
                  <button
                    type="button"
                    onClick={() => { setLinkError(null); setIsLinkOrgModalOpen(true); }}
                    className="slds-button slds-button_neutral"
                    style={{ fontSize: '11px', padding: '2px 8px' }}
                  >
                    + Link Org
                  </button>
                </div>

                <ul className="slds-has-dividers_bottom-space" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                  {(team.organizations || []).map((org) => (
                    <li key={org.id} className="slds-item slds-p-vertical_small" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f3f2f1' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="font-bold text-slate-900" style={{ fontWeight: 'bold' }}>{org.name}</span>
                          {org.isPrimary && (
                            <span className="slds-badge slds-theme_success" style={{ fontSize: '10px', padding: '2px 6px', background: '#2e7d32', color: '#fff', borderRadius: '3px' }}>
                              Primary
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500" style={{ fontSize: '11px', color: '#64748b' }}>@{org.slug}</span>
                      </div>

                      {!org.isPrimary && (
                        <button
                          type="button"
                          onClick={() => handleUnlinkSecondaryOrg(org.id)}
                          className="slds-button slds-button_destructive"
                          style={{ fontSize: '11px', padding: '2px 8px' }}
                        >
                          Unlink
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </article>
            </div>

            {/* Right Column: Team Roster Table */}
            <div className="slds-col slds-size_1-of-1 slds-medium-size_2-of-3" style={{ flex: '2 1 500px' }}>
              <article className="slds-card" style={{ border: '1px solid #dddbda', borderRadius: '6px', background: '#fff', padding: '1.25rem' }}>
                <div className="slds-grid slds-grid_align-spread slds-m-bottom_medium" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 className="slds-text-heading_small font-bold" style={{ fontWeight: 'bold' }}>
                    Team Roster ({totalMembers})
                  </h2>

                  <input
                    type="text"
                    placeholder="Search roster..."
                    value={memberSearch}
                    onChange={(e) => { setMemberSearch(e.target.value); setMemberPage(1); }}
                    className="slds-input"
                    style={{ padding: '4px 8px', fontSize: '12px', border: '1px solid #dddbda', borderRadius: '4px', maxWidth: '200px' }}
                  />
                </div>

                {members.length > 0 ? (
                  <>
                    <div style={{ overflowX: 'auto', border: '1px solid #dddbda', borderRadius: '4px' }}>
                      <table className="slds-table slds-table_cell-buffer slds-table_bordered" style={{ width: '100%', tableLayout: 'fixed' }}>
                        <thead>
                          <tr style={{ background: '#f3f2f1' }}>
                            <th style={{ width: '40%' }}>Competitor</th>
                            <th style={{ width: '25%' }}>Role</th>
                            <th style={{ width: '20%' }}>Change Role</th>
                            <th style={{ width: '15%' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {members.map((member) => (
                            <tr key={member.userId}>
                              <td>
                                <UserLink userId={member.userId} name={member.name} />
                                {member.slug && (
                                  <span style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>@{member.slug}</span>
                                )}
                              </td>
                              <td>
                                <span className={`slds-badge ${member.role === 'administrator' ? 'slds-theme_success' : 'slds-theme_light'}`}>
                                  {member.role}
                                </span>
                              </td>
                              <td>
                                <select
                                  value={member.role}
                                  onChange={(e) => handleChangeRole(member.userId, e.target.value)}
                                  className="slds-select"
                                  style={{ padding: '2px 6px', fontSize: '12px' }}
                                >
                                  {roleOptions.map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMember(member.userId)}
                                  className="slds-button slds-button_destructive"
                                  style={{ fontSize: '11px', padding: '2px 8px' }}
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
                  <p className="text-slate-500 text-sm">No roster members found.</p>
                )}
              </article>
            </div>
          </div>
        ) : null}
      </div>

      {/* EDIT TEAM METADATA MODAL */}
      {isTeamModalOpen && (
        <section role="dialog" tabIndex={-1} className="slds-modal slds-fade-in-open" style={{ zIndex: 9001 }}>
          <div className="slds-modal__container" style={{ maxWidth: '36rem', width: '90%' }}>
            <header className="slds-modal__header">
              <button onClick={() => setIsTeamModalOpen(false)} className="slds-button slds-modal__close">✕</button>
              <h2 className="slds-modal__title font-bold">Edit Team Metadata</h2>
            </header>
            <form onSubmit={handleUpdateTeam}>
              <div className="slds-modal__content slds-p-around_medium" style={{ background: '#fff' }}>
                {teamError && <AlertBanner variant="error">{teamError}</AlertBanner>}
                <div className="slds-form-element slds-m-bottom_medium">
                  <label className="slds-form-element__label font-bold">Team Name</label>
                  <input type="text" required value={teamName} onChange={(e) => setTeamName(e.target.value)} className="slds-input" />
                </div>
                <div className="slds-form-element slds-m-bottom_medium">
                  <label className="slds-form-element__label font-bold">Team Slug</label>
                  <input type="text" required value={teamSlug} onChange={(e) => setTeamSlug(e.target.value)} className="slds-input" />
                </div>
                <div className="slds-form-element">
                  <label className="slds-form-element__label font-bold">Logo URL</label>
                  <input type="url" value={teamLogo} onChange={(e) => setTeamLogo(e.target.value)} className="slds-input" />
                </div>
              </div>
              <footer className="slds-modal__footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setIsTeamModalOpen(false)} className="slds-button slds-button_neutral">Cancel</button>
                <button type="submit" disabled={updatingTeam} className="slds-button slds-button_brand">{updatingTeam ? 'Saving...' : 'Save Changes'}</button>
              </footer>
            </form>
          </div>
        </section>
      )}

      {/* ADD MEMBER MODAL */}
      {isMemberModalOpen && (
        <section role="dialog" tabIndex={-1} className="slds-modal slds-fade-in-open" style={{ zIndex: 9001 }}>
          <div className="slds-modal__container" style={{ maxWidth: '36rem', width: '90%' }}>
            <header className="slds-modal__header">
              <button onClick={() => setIsMemberModalOpen(false)} className="slds-button slds-modal__close">✕</button>
              <h2 className="slds-modal__title font-bold">Add Team Competitor</h2>
            </header>
            <form onSubmit={handleAddMember}>
              <div className="slds-modal__content slds-p-around_medium" style={{ background: '#fff' }}>
                {memberError && <AlertBanner variant="error">{memberError}</AlertBanner>}
                <div className="slds-form-element slds-m-bottom_medium">
                  <label className="slds-form-element__label font-bold">Select User</label>
                  <UserSearchCombobox value={selectedUserId} onChange={setSelectedUserId} />
                </div>
                <div className="slds-form-element">
                  <label className="slds-form-element__label font-bold">Initial Role</label>
                  <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)} className="slds-select">
                    {roleOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                  </select>
                </div>
              </div>
              <footer className="slds-modal__footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setIsMemberModalOpen(false)} className="slds-button slds-button_neutral">Cancel</button>
                <button type="submit" disabled={addingMember} className="slds-button slds-button_brand">{addingMember ? 'Adding...' : 'Add Competitor'}</button>
              </footer>
            </form>
          </div>
        </section>
      )}

      {/* LINK SECONDARY ORG MODAL */}
      {isLinkOrgModalOpen && (
        <section role="dialog" tabIndex={-1} className="slds-modal slds-fade-in-open" style={{ zIndex: 9001 }}>
          <div className="slds-modal__container" style={{ maxWidth: '36rem', width: '90%' }}>
            <header className="slds-modal__header">
              <button onClick={() => setIsLinkOrgModalOpen(false)} className="slds-button slds-modal__close">✕</button>
              <h2 className="slds-modal__title font-bold">Link Secondary Organization</h2>
            </header>
            <form onSubmit={handleLinkSecondaryOrg}>
              <div className="slds-modal__content slds-p-around_medium" style={{ background: '#fff' }}>
                {linkError && <AlertBanner variant="error">{linkError}</AlertBanner>}
                <div className="slds-form-element">
                  <label className="slds-form-element__label font-bold">Target Organization</label>
                  <select value={targetOrgId} onChange={(e) => setTargetOrgId(e.target.value)} className="slds-select" required>
                    <option value="">-- Choose Organization --</option>
                    {approvedOrgs
                      .filter((o) => !(team?.organizations || []).some((linked) => linked.id === o.id))
                      .map((o) => (
                        <option key={o.id} value={o.id}>{o.name} ({o.slug})</option>
                      ))}
                  </select>
                  <p className="slds-text-body_small text-slate-500" style={{ fontSize: '11px', marginTop: '4px' }}>
                    Note: You must hold administrator permissions on both the primary organization AND the target organization.
                  </p>
                </div>
              </div>
              <footer className="slds-modal__footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setIsLinkOrgModalOpen(false)} className="slds-button slds-button_neutral">Cancel</button>
                <button type="submit" disabled={linkingOrg} className="slds-button slds-button_brand">{linkingOrg ? 'Linking...' : 'Link Organization'}</button>
              </footer>
            </form>
          </div>
        </section>
      )}
    </div>
  )
}
