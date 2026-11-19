import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../../hooks/useAuth'
import { requireAdminPanel } from '../../../lib/auth-guard'
import {
  getAdminOrganization,
  updateAdminOrganization,
  addAdminTeamMember,
  updateAdminTeamMemberRole,
  removeAdminTeamMember,
  listAdminTeamMembers,
} from '../../../lib/admin-api'
import { AdminLayout } from '../-AdminLayout'
import { AlertBanner } from '../../../components/AlertBanner'
import { UserSearchCombobox } from '../../../components/UserSearchCombobox'
import { Pagination } from '../../../components/Pagination'
import { UserLink } from '../../../components/UserLink'
import type { teammanager } from '../../../lib/client'

export const Route = createFileRoute('/admin/organizations/$orgId')({
  beforeLoad: async ({ location }) => {
    await requireAdminPanel(location)
  },
  component: AdminOrgDetailPage,
})

function AdminOrgDetailPage() {
  const { orgId } = Route.useParams()
  const { session } = useAuth()
  const [org, setOrg] = useState<teammanager.AdminOrganizationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Staff roster state
  const [members, setMembers] = useState<Array<{ userId: string; name: string; slug: string | null; role: string }>>([])
  const [totalMembers, setTotalMembers] = useState(0)
  const [memberPage, setMemberPage] = useState(1)
  const [memberPageSize, setMemberPageSize] = useState(10)
  const [memberSearch, setMemberSearch] = useState('')

  // Modals state
  const [isOrgModalOpen, setIsOrgModalOpen] = useState(false)
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false)

  // Edit Org Metadata form state
  const [orgName, setOrgName] = useState('')
  const [orgSlug, setOrgSlug] = useState('')
  const [orgLogo, setOrgLogo] = useState('')
  const [discordInvite, setDiscordInvite] = useState('')
  const [vrchatGroupId, setVrchatGroupId] = useState('')
  const [updatingOrg, setUpdatingOrg] = useState(false)
  const [orgError, setOrgError] = useState<string | null>(null)

  // Add Staff Member form state
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedRole, setSelectedRole] = useState('administrator')
  const [addingMember, setAddingMember] = useState(false)
  const [memberError, setMemberError] = useState<string | null>(null)

  const authHeader = useMemo(() => {
    const token = session?.session.token
    return token ? `Bearer ${token}` : null
  }, [session?.session.token])

  async function loadOrgData() {
    setLoading(true)
    setError(null)
    try {
      const loadedOrg = await getAdminOrganization(orgId)
      setOrg(loadedOrg)

      setOrgName(loadedOrg.name || '')
      setOrgSlug(loadedOrg.slug || '')
      setOrgLogo(loadedOrg.logo || '')
      setDiscordInvite(loadedOrg.discordInvite || '')
      setVrchatGroupId(loadedOrg.vrchatGroupId || '')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load organization details')
    } finally {
      setLoading(false)
    }
  }

  async function fetchRoster() {
    try {
      const offset = (memberPage - 1) * memberPageSize
      const response = await listAdminTeamMembers(orgId, memberSearch, memberPageSize, offset)
      setMembers(response.members)
      setTotalMembers(response.total)
    } catch (cause) {
      console.error('Failed to load roster', cause)
    }
  }

  useEffect(() => {
    void loadOrgData()
  }, [orgId, authHeader])

  useEffect(() => {
    void fetchRoster()
  }, [orgId, memberPage, memberPageSize, memberSearch])

  async function handleUpdateOrg(evt: React.FormEvent) {
    evt.preventDefault()
    if (!authHeader) return

    setUpdatingOrg(true)
    setOrgError(null)
    try {
      const updated = await updateAdminOrganization(
        orgId,
        {
          name: orgName.trim() || undefined,
          slug: orgSlug.trim() || undefined,
          logo: orgLogo.trim() || null,
          discordInvite: discordInvite.trim() || null,
          vrchatGroupId: vrchatGroupId.trim() || null,
        },
        authHeader,
      )
      setOrg(updated)
      setOrgName(updated.name || '')
      setOrgSlug(updated.slug || '')
      setOrgLogo(updated.logo || '')
      setIsOrgModalOpen(false)
      setSuccess('Organization details updated successfully.')
    } catch (cause) {
      setOrgError(cause instanceof Error ? cause.message : 'Failed to update organization')
    } finally {
      setUpdatingOrg(false)
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
      await addAdminTeamMember(
        orgId,
        {
          userId: selectedUserId,
          role: selectedRole,
        },
        authHeader,
      )
      setIsMemberModalOpen(false)
      setSuccess('Staff member added successfully.')
      void fetchRoster()
      void loadOrgData()
    } catch (cause) {
      setMemberError(cause instanceof Error ? cause.message : 'Failed to add staff member')
    } finally {
      setAddingMember(false)
    }
  }

  async function handleRemoveMember(memberUserId: string) {
    if (!authHeader) return
    if (!confirm('Are you sure you want to remove this staff member from the organization?')) return

    setError(null)
    setSuccess(null)
    try {
      await removeAdminTeamMember(orgId, memberUserId, authHeader)
      setSuccess('Staff member removed successfully.')
      void fetchRoster()
      void loadOrgData()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to remove staff member')
    }
  }

  async function handleChangeRole(memberUserId: string, newRole: string) {
    if (!authHeader) return

    setError(null)
    setSuccess(null)
    try {
      await updateAdminTeamMemberRole(orgId, memberUserId, newRole, authHeader)
      setSuccess(`Staff role updated to ${newRole} successfully.`)
      void fetchRoster()
      void loadOrgData()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to change staff role')
    }
  }

  const roleOptions = [
    { value: 'administrator', label: 'Administrator' },
    { value: 'member', label: 'Member / Staff' },
  ]

  const actions = (
    <div style={{ display: 'flex', gap: '8px' }}>
      <button
        type="button"
        onClick={() => {
          setOrgError(null)
          setIsOrgModalOpen(true)
        }}
        className="slds-button slds-button_neutral"
      >
        Edit Organization Details
      </button>
      <button
        type="button"
        onClick={() => {
          setMemberError(null)
          setIsMemberModalOpen(true)
        }}
        className="slds-button slds-button_brand"
      >
        Add Staff Member
      </button>
    </div>
  )

  return (
    <AdminLayout
      title={org ? org.name : 'Organization Detail'}
      subtitle={org ? `Manage demographics and staff roles for organization: @${org.slug}` : 'Demographics and staff details'}
      actions={org ? actions : undefined}
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
            <p>Loading organization detail panel...</p>
          </div>
        ) : org ? (
          <>
            {/* Left Column: Organization Summary */}
            <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-3 slds-m-bottom_medium">
              <article className="slds-card" style={{ border: '1px solid #dddbda', height: '100%' }}>
                <div className="slds-card__header slds-grid">
                  <header className="slds-media slds-media_center slds-has-flexi-truncate">
                    <div className="slds-media__body">
                      <h2 className="slds-card__header-title">
                        <span className="slds-card__header-link slds-truncate font-semibold" style={{ fontWeight: 'bold' }}>
                          Organization Profile
                        </span>
                      </h2>
                    </div>
                  </header>
                </div>

                <div className="slds-card__body slds-card__body_inner" style={{ padding: '1.25rem' }}>
                  <div className="slds-box slds-m-bottom_medium" style={{ background: org.administratorSlotsRemaining > 0 ? '#ecfdf5' : '#fef2f2', border: org.administratorSlotsRemaining > 0 ? '1px solid #a7f3d0' : '1px solid #fecaca', borderRadius: '4px' }}>
                    <p className="font-bold text-sm" style={{ fontWeight: 'bold', color: org.administratorSlotsRemaining > 0 ? '#065f46' : '#991b1b' }}>
                      Administrator Slots Remaining
                    </p>
                    <p className="text-xl font-extrabold slds-m-top_xx-small" style={{ fontSize: '1.5rem', fontWeight: 'bold', color: org.administratorSlotsRemaining > 0 ? '#047857' : '#dc2626' }}>
                      {org.administratorSlotsRemaining} / 3 slots
                    </p>
                    <p className="text-xs slds-m-top_xx-small text-slate-500">
                      An organization may have at most three administrators belonging to it.
                    </p>
                  </div>

                  <div className="slds-m-bottom_medium">
                    <p className="slds-text-title text-slate-500" style={{ fontSize: '11px', textTransform: 'uppercase' }}>Slug Identifier</p>
                    <p className="font-semibold text-slate-900">@{org.slug}</p>
                  </div>

                  <div className="slds-m-bottom_medium">
                    <p className="slds-text-title text-slate-500" style={{ fontSize: '11px', textTransform: 'uppercase' }}>Organization Status</p>
                    <span className="slds-badge slds-theme_success" style={{ padding: '2px 8px', borderRadius: '4px' }}>
                      {org.status || 'APPROVED'}
                    </span>
                  </div>
                </div>
              </article>
            </div>

            {/* Right Column: Staff Roster Table */}
            <div className="slds-col slds-size_1-of-1 slds-medium-size_2-of-3 slds-m-bottom_medium">
              <article className="slds-card" style={{ border: '1px solid #dddbda', height: '100%' }}>
                <div className="slds-card__header slds-grid">
                  <header className="slds-media slds-media_center slds-has-flexi-truncate">
                    <div className="slds-media__body">
                      <h2 className="slds-card__header-title">
                        <span className="slds-card__header-link slds-truncate font-semibold" style={{ fontWeight: 'bold' }}>
                          Staff Roster ({totalMembers} Members)
                        </span>
                      </h2>
                    </div>
                  </header>
                </div>

                <div className="slds-card__body slds-card__body_inner" style={{ padding: '1.5rem' }}>
                  <div className="slds-form-element slds-m-bottom_medium" style={{ maxWidth: '300px' }}>
                    <div className="slds-form-element__control">
                      <input
                        type="text"
                        placeholder="Search staff by name/slug..."
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
                        <table className="slds-table slds-table_cell-buffer slds-table_bordered" aria-label="Staff Roster Table" style={{ width: '100%', tableLayout: 'fixed', minWidth: '600px' }}>
                          <thead>
                            <tr className="slds-line-height_reset" style={{ background: '#f3f2f1' }}>
                              <th scope="col" style={{ width: '35%', minWidth: '160px' }}>
                                <div className="slds-truncate font-bold" title="Staff Name" style={{ fontWeight: 'bold' }}>Staff Name</div>
                              </th>
                              <th scope="col" style={{ width: '140px' }}>
                                <div className="slds-truncate font-bold" title="Role" style={{ fontWeight: 'bold' }}>Role</div>
                              </th>
                              <th scope="col" style={{ width: '160px' }}>
                                <div className="slds-truncate font-bold" title="Change Role" style={{ fontWeight: 'bold' }}>Change Role</div>
                              </th>
                              <th scope="col" style={{ width: '100px' }}>
                                <div className="slds-truncate font-bold" title="Actions" style={{ fontWeight: 'bold' }}>Actions</div>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {members.map((member) => (
                              <tr key={member.userId} className="slds-hint-parent hover:bg-slate-50">
                                <th scope="row">
                                  <div className="slds-truncate font-bold" title={`${member.name}${member.slug ? ` (@${member.slug})` : ''}`}>
                                    <UserLink userId={member.userId} name={member.name} />
                                    {member.slug && (
                                      <span className="slds-truncate" style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 'normal' }}>
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
                                    style={{ padding: '2px 8px', height: '28px', fontSize: '12px', width: '100%' }}
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
                      <p>This organization does not have any staff members. Click "Add Staff Member" to populate the roster.</p>
                    </div>
                  )}
                </div>

                <footer className="slds-card__footer" style={{ borderTop: '1px solid #f3f2f1', padding: '1rem' }}>
                  <Link to="/admin/organizations" className="slds-button slds-button_neutral" style={{ textDecoration: 'none' }}>
                    Back to Organizations Directory
                  </Link>
                </footer>
              </article>
            </div>
          </>
        ) : null}
      </div>

      {/* Edit Org Modal */}
      {isOrgModalOpen && (
        <>
          <section role="dialog" tabIndex={-1} aria-modal="true" className="slds-modal slds-fade-in-open" style={{ zIndex: 9001 }}>
            <div className="slds-modal__container" style={{ maxWidth: '40rem', width: '90%' }}>
              <header className="slds-modal__header">
                <button
                  type="button"
                  onClick={() => setIsOrgModalOpen(false)}
                  className="slds-button slds-button_icon slds-modal__close"
                  title="Close"
                >
                  X
                </button>
                <h2 className="slds-modal__title font-bold text-slate-900" style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                  Configure Organization Details
                </h2>
              </header>

              <form onSubmit={(e) => void handleUpdateOrg(e)}>
                <div className="slds-modal__content slds-p-around_medium" style={{ background: '#fff' }}>
                  {orgError && (
                    <div className="slds-m-bottom_medium">
                      <AlertBanner variant="error">{orgError}</AlertBanner>
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
                          value={orgName}
                          onChange={(e) => setOrgName(e.target.value)}
                          className="slds-input"
                          style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px' }}
                          required
                        />
                      </div>
                    </div>

                    <div className="slds-form-element slds-m-bottom_medium">
                      <label className="slds-form-element__label font-bold text-slate-700" htmlFor="org-slug-input">
                        Organization Slug
                      </label>
                      <div className="slds-form-element__control">
                        <input
                          id="org-slug-input"
                          type="text"
                          value={orgSlug}
                          onChange={(e) => setOrgSlug(e.target.value)}
                          className="slds-input"
                          style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px' }}
                          required
                        />
                      </div>
                    </div>

                    <div className="slds-form-element slds-m-bottom_medium">
                      <label className="slds-form-element__label font-bold text-slate-700" htmlFor="org-logo-input">
                        Logo URL
                      </label>
                      <div className="slds-form-element__control">
                        <input
                          id="org-logo-input"
                          type="text"
                          value={orgLogo}
                          onChange={(e) => setOrgLogo(e.target.value)}
                          className="slds-input"
                          style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px' }}
                        />
                      </div>
                    </div>

                    <div className="slds-form-element slds-m-bottom_medium">
                      <label className="slds-form-element__label font-bold text-slate-700" htmlFor="discord-invite-input">
                        Discord Invite Link
                      </label>
                      <div className="slds-form-element__control">
                        <input
                          id="discord-invite-input"
                          type="text"
                          value={discordInvite}
                          onChange={(e) => setDiscordInvite(e.target.value)}
                          placeholder="https://discord.gg/..."
                          className="slds-input"
                          style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px' }}
                        />
                      </div>
                    </div>

                    <div className="slds-form-element">
                      <label className="slds-form-element__label font-bold text-slate-700" htmlFor="vrchat-group-input">
                        VRChat Group ID
                      </label>
                      <div className="slds-form-element__control">
                        <input
                          id="vrchat-group-input"
                          type="text"
                          value={vrchatGroupId}
                          onChange={(e) => setVrchatGroupId(e.target.value)}
                          placeholder="grp_..."
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
                    onClick={() => setIsOrgModalOpen(false)}
                    className="slds-button slds-button_neutral"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updatingOrg}
                    className="slds-button slds-button_brand"
                  >
                    {updatingOrg ? 'Updating...' : 'Save Details'}
                  </button>
                </footer>
              </form>
            </div>
          </section>
          <div className="slds-backdrop slds-backdrop_open" style={{ zIndex: 9000 }}></div>
        </>
      )}

      {/* Add Staff Member Modal */}
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
                >
                  X
                </button>
                <h2 className="slds-modal__title font-bold text-slate-900" style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                  Add Staff Member
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
                      <label className="slds-form-element__label font-bold text-slate-700">
                        Select System User
                      </label>
                      <div className="slds-form-element__control">
                        <UserSearchCombobox
                          value={selectedUserId}
                          onChange={(val) => setSelectedUserId(val)}
                        />
                      </div>
                    </div>

                    <div className="slds-form-element">
                      <label className="slds-form-element__label font-bold text-slate-700">
                        Initial Staff Role
                      </label>
                      <div className="slds-form-element__control">
                        <select
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
                    {addingMember ? 'Adding...' : 'Add Staff Member'}
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
