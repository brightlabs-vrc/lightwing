import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { Button, CounterLabel, Dialog, FormControl, Label, Select, TextInput } from '@primer/react'
import { ArrowLeftIcon, PencilIcon, PersonAddIcon, PlusIcon, SearchIcon, TrashIcon } from '@primer/octicons-react'
import { useAuth } from '../../../hooks/useAuth'
import { requireAdminPanel } from '../../../lib/auth-guard'
import {
  addAdminTeamMember,
  deleteAdminOrganization,
  getAdminOrganization,
  listAdminTeamMembers,
  listOrgClassGrades,
  removeAdminTeamMember,
  updateAdminOrganization,
  updateAdminTeamMemberRole,
  updateAdminUserClass,
} from '../../../lib/admin-api'
import { AdminLayout } from '../-AdminLayout'
import { AlertBanner } from '../../../components/AlertBanner'
import { UserSearchCombobox } from '../../../components/UserSearchCombobox'
import { Pagination } from '../../../components/Pagination'
import { UserLink } from '../../../components/UserLink'
import { PrimerSkeletonDetail } from '../../../components/LoadingSkeleton'
import { DangerZoneDeleteDialog } from '../../../components/DangerZoneDeleteDialog'
import type { eventmanager, teammanager } from '../../../lib/client'
import type { ClassTier } from '../../../types'

export const Route = createFileRoute('/admin/organizations/$orgId')({
  beforeLoad: async ({ location }) => {
    await requireAdminPanel(location)
  },
  component: AdminOrgDetailPage,
})

function AdminOrgDetailPage() {
  const { orgId } = Route.useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const isSiteAdmin = session?.user.siteRole === 'SITE_ADMIN'

  const [org, setOrg] = useState<teammanager.AdminOrganizationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [members, setMembers] = useState<Array<{ userId: string; name: string; slug: string | null; role: string }>>([])
  const [totalMembers, setTotalMembers] = useState(0)
  const [memberPage, setMemberPage] = useState(1)
  const [memberPageSize, setMemberPageSize] = useState(10)
  const [memberSearch, setMemberSearch] = useState('')

  const [classGrades, setClassGrades] = useState<eventmanager.OrgClassEntry[]>([])
  const [totalClassGrades, setTotalClassGrades] = useState(0)
  const [gradePage, setGradePage] = useState(1)
  const [gradePageSize, setGradePageSize] = useState(10)
  const [gradeSearch, setGradeSearch] = useState('')
  const [newGradeUserId, setNewGradeUserId] = useState('')
  const [newGradeTier, setNewGradeTier] = useState<ClassTier>('G3')
  const [savingGrade, setSavingGrade] = useState(false)

  const [isOrgModalOpen, setIsOrgModalOpen] = useState(false)
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false)

  const [orgName, setOrgName] = useState('')
  const [orgSlug, setOrgSlug] = useState('')
  const [orgLogo, setOrgLogo] = useState('')
  const [discordInvite, setDiscordInvite] = useState('')
  const [vrchatGroupId, setVrchatGroupId] = useState('')
  const [updatingOrg, setUpdatingOrg] = useState(false)
  const [orgError, setOrgError] = useState<string | null>(null)

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

  async function fetchClassGrades() {
    try {
      const offset = (gradePage - 1) * gradePageSize
      const response = await listOrgClassGrades(orgId, gradeSearch, gradePageSize, offset)
      setClassGrades(response.entries)
      setTotalClassGrades(response.total)
    } catch (cause) {
      console.error('Failed to load org class grades', cause)
    }
  }

  async function handleAssignClassGrade(userId: string, tier: ClassTier | null) {
    if (!authHeader || !userId) return
    setSavingGrade(true)
    setError(null)
    setSuccess(null)
    try {
      await updateAdminUserClass(userId, orgId, tier, authHeader)
      await fetchClassGrades()
      setSuccess(tier ? 'Updated participant class grade.' : 'Cleared participant class grade.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update participant class grade.')
    } finally {
      setSavingGrade(false)
    }
  }

  useEffect(() => {
    void loadOrgData()
  }, [orgId, authHeader])

  useEffect(() => {
    void fetchRoster()
  }, [orgId, memberPage, memberPageSize, memberSearch])

  useEffect(() => {
    void fetchClassGrades()
  }, [orgId, gradePage, gradePageSize, gradeSearch])

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
      await addAdminTeamMember(orgId, { userId: selectedUserId, role: selectedRole }, authHeader)
      setIsMemberModalOpen(false)
      setSelectedUserId('')
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
      setSuccess(`Staff role updated to ${newRole}.`)
      void fetchRoster()
      void loadOrgData()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to change staff role')
    }
  }

  async function handleDeleteOrg() {
    if (!org || !authHeader) return
    await deleteAdminOrganization(org.id, authHeader)
    void navigate({ to: '/admin/organizations' })
  }

  const roleOptions = [
    { value: 'administrator', label: 'Administrator' },
    { value: 'member', label: 'Member / Staff' },
  ]

  return (
    <AdminLayout
      title={org ? org.name : 'Organization Detail'}
      subtitle={org ? `Manage demographics, staff roles, and class grades for @${org.slug}` : 'Organization details'}
      breadcrumbs={[
        { label: 'Admin', to: '/admin' },
        { label: 'Organizations', to: '/admin/organizations' },
        { label: org ? org.name : orgId },
      ]}
      actions={
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Link to="/admin/organizations" style={{ textDecoration: 'none' }}>
            <Button leadingVisual={ArrowLeftIcon}>Back</Button>
          </Link>
          {org && (
            <>
              <Button
                type="button"
                leadingVisual={PencilIcon}
                onClick={() => {
                  setOrgError(null)
                  setIsOrgModalOpen(true)
                }}
              >
                Edit Details
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
                Add Staff
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
      ) : org ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Organization Profile Summary */}
          <section className="primer-box">
            <div className="primer-box-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Organization Profile</h2>
              <Label variant="success">{org.status || 'APPROVED'}</Label>
            </div>
            <div
              style={{
                padding: '16px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
              }}
            >
              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: 'var(--fgColor-muted, #636c76)' }}>
                  Slug Identifier
                </div>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>@{org.slug}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: 'var(--fgColor-muted, #636c76)' }}>
                  Administrator Slots
                </div>
                <div style={{ marginTop: '2px' }}>
                  <Label variant={org.administratorSlotsRemaining > 0 ? 'success' : 'danger'}>
                    {org.administratorSlotsRemaining} / 3 slots remaining
                  </Label>
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: 'var(--fgColor-muted, #636c76)' }}>
                  Discord Invite
                </div>
                <div style={{ fontSize: '13px', wordBreak: 'break-all' }}>{org.discordInvite || 'Not configured'}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: 'var(--fgColor-muted, #636c76)' }}>
                  VRChat Group ID
                </div>
                <code style={{ fontSize: '12px', color: 'var(--fgColor-muted, #636c76)' }}>{org.vrchatGroupId || 'Not configured'}</code>
              </div>
            </div>
          </section>

          {/* Staff Roster */}
          <section className="primer-box">
            <div
              className="primer-box-header"
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Staff Roster</h2>
                <CounterLabel>{totalMembers}</CounterLabel>
              </div>
              <div style={{ minWidth: '220px' }}>
                <TextInput
                  size="small"
                  block
                  leadingVisual={SearchIcon}
                  placeholder="Search staff..."
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
                  <table className="primer-table" aria-label="Staff Roster Table" style={{ minWidth: '580px' }}>
                    <thead>
                      <tr>
                        <th>Staff Name</th>
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
                No staff members found. Click &quot;Add Staff&quot; to populate the roster.
              </div>
            )}
          </section>

          {/* Participant Class Grades */}
          <section className="primer-box">
            <div
              className="primer-box-header"
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Participant Class Grades</h2>
                <CounterLabel>{totalClassGrades}</CounterLabel>
              </div>
              <div style={{ minWidth: '220px' }}>
                <TextInput
                  size="small"
                  block
                  leadingVisual={SearchIcon}
                  placeholder="Search participant..."
                  value={gradeSearch}
                  onChange={(e) => {
                    setGradeSearch(e.target.value)
                    setGradePage(1)
                  }}
                />
              </div>
            </div>

            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 260px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    Assign Class Grade to Participant
                  </label>
                  <UserSearchCombobox
                    value={newGradeUserId}
                    onChange={setNewGradeUserId}
                    placeholder="Search participant by name, @username or email..."
                  />
                </div>
                <Select
                  size="small"
                  value={newGradeTier}
                  onChange={(e) => setNewGradeTier(e.target.value as ClassTier)}
                >
                  <Select.Option value="G3">G3</Select.Option>
                  <Select.Option value="G2">G2</Select.Option>
                  <Select.Option value="G1">G1</Select.Option>
                </Select>
                <Button
                  type="button"
                  size="small"
                  variant="primary"
                  leadingVisual={PlusIcon}
                  disabled={!newGradeUserId || savingGrade}
                  onClick={() => {
                    if (!newGradeUserId) return
                    void handleAssignClassGrade(newGradeUserId, newGradeTier)
                    setNewGradeUserId('')
                  }}
                >
                  Assign Grade
                </Button>
              </div>

              {classGrades.length > 0 ? (
                <>
                  <div style={{ overflowX: 'auto', border: '1px solid var(--borderColor-default, #d0d7de)', borderRadius: '6px' }}>
                    <table className="primer-table">
                      <thead>
                        <tr>
                          <th>Participant</th>
                          <th style={{ width: '160px' }}>Class Grade</th>
                          <th style={{ width: '100px', textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {classGrades.map((cg) => (
                          <tr key={cg.userId}>
                            <td>
                              <UserLink userId={cg.userId} name={cg.name} slug={cg.slug} />
                              {cg.slug && (
                                <div style={{ fontSize: '11px', color: 'var(--fgColor-muted, #636c76)' }}>
                                  @{cg.slug}
                                </div>
                              )}
                            </td>
                            <td>
                              <Select
                                size="small"
                                value={cg.classTier || ''}
                                disabled={savingGrade}
                                onChange={(e) => {
                                  const v = e.target.value as ClassTier | ''
                                  void handleAssignClassGrade(cg.userId, v === '' ? null : v)
                                }}
                              >
                                <Select.Option value="">OPEN (Clear)</Select.Option>
                                <Select.Option value="G3">G3</Select.Option>
                                <Select.Option value="G2">G2</Select.Option>
                                <Select.Option value="G1">G1</Select.Option>
                              </Select>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <Button
                                type="button"
                                size="small"
                                variant="danger"
                                disabled={savingGrade}
                                onClick={() => void handleAssignClassGrade(cg.userId, null)}
                              >
                                Clear
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pagination
                    page={gradePage}
                    pageSize={gradePageSize}
                    total={totalClassGrades}
                    onPageChange={setGradePage}
                    onPageSizeChange={setGradePageSize}
                  />
                </>
              ) : (
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--fgColor-muted, #636c76)' }}>
                  No organization-scoped class grades assigned yet.
                </p>
              )}
            </div>
          </section>

          {/* Danger Zone (SITE_ADMIN only) */}
          {isSiteAdmin && (
            <DangerZoneDeleteDialog
              entityType="organization"
              entityName={org.name}
              confirmText={org.slug}
              cardDescription="Permanently delete this organization, its staff roster, organization-owned events, newsletters, and class grades."
              consequences={[
                'All staff memberships and administrator roles for this organization.',
                'All competition events, races, and newsletters owned by this organization.',
                'All organization-scoped participant class grades and team affiliations.',
              ]}
              onConfirmDelete={handleDeleteOrg}
            />
          )}
        </div>
      ) : null}

      {isOrgModalOpen && (
        <Dialog title="Edit Organization Details" onClose={() => setIsOrgModalOpen(false)} width="medium">
          <form onSubmit={(e) => void handleUpdateOrg(e)} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {orgError && <AlertBanner variant="error">{orgError}</AlertBanner>}

            <FormControl required>
              <FormControl.Label>Organization Name</FormControl.Label>
              <TextInput block required value={orgName} onChange={(e) => setOrgName(e.target.value)} />
            </FormControl>

            <FormControl required>
              <FormControl.Label>Organization Slug</FormControl.Label>
              <TextInput block required value={orgSlug} onChange={(e) => setOrgSlug(e.target.value)} />
            </FormControl>

            <FormControl>
              <FormControl.Label>Logo URL</FormControl.Label>
              <TextInput block value={orgLogo} onChange={(e) => setOrgLogo(e.target.value)} />
            </FormControl>

            <FormControl>
              <FormControl.Label>Discord Invite Link</FormControl.Label>
              <TextInput block value={discordInvite} onChange={(e) => setDiscordInvite(e.target.value)} placeholder="https://discord.gg/..." />
            </FormControl>

            <FormControl>
              <FormControl.Label>VRChat Group ID</FormControl.Label>
              <TextInput block value={vrchatGroupId} onChange={(e) => setVrchatGroupId(e.target.value)} placeholder="grp_..." />
            </FormControl>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '8px', borderTop: '1px solid var(--borderColor-muted, #d8dee4)' }}>
              <Button type="button" onClick={() => setIsOrgModalOpen(false)} disabled={updatingOrg}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={updatingOrg}>
                {updatingOrg ? 'Saving...' : 'Save Details'}
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {isMemberModalOpen && (
        <Dialog title="Add Staff Member" onClose={() => setIsMemberModalOpen(false)} width="medium">
          <form onSubmit={(e) => void handleAddMember(e)} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {memberError && <AlertBanner variant="error">{memberError}</AlertBanner>}

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Select System User
              </label>
              <UserSearchCombobox value={selectedUserId} onChange={(val) => setSelectedUserId(val)} />
            </div>

            <FormControl>
              <FormControl.Label>Initial Staff Role</FormControl.Label>
              <Select block value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
                {roleOptions.map((opt) => (
                  <Select.Option key={opt.value} value={opt.value}>
                    {opt.label}
                  </Select.Option>
                ))}
              </Select>
            </FormControl>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '8px', borderTop: '1px solid var(--borderColor-muted, #d8dee4)' }}>
              <Button type="button" onClick={() => setIsMemberModalOpen(false)} disabled={addingMember}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={addingMember}>
                {addingMember ? 'Adding...' : 'Add Staff Member'}
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </AdminLayout>
  )
}
