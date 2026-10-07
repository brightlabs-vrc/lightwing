import { createFileRoute } from '@tanstack/react-router'
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
  submitTeamApplication,
} from '../../lib/admin-api'
import { UserSearchCombobox } from '../../components/UserSearchCombobox'
import { Pagination } from '../../components/Pagination'
import { UserLink } from '../../components/UserLink'
import type { teammanager } from '../../lib/client'
import {
  PixelContainer,
  PixelStack,
  PixelCard,
  PixelButton,
  PixelBadge,
  PixelSectionHeader,
  PixelAlert,
  PixelInput,
  PixelModal,
  PixelTable,
  type PixelTableColumn,
  useToast,
} from '@pxlkit/ui-kit'

export const Route = createFileRoute('/teams/manage/$id')({
  beforeLoad: async ({ location }) => {
    await requireAuth(location)
  },
  component: ManageTeamPage,
})

function ManageTeamPage() {
  const { id: teamId } = Route.useParams()
  const { session } = useAuth()
  const { toast } = useToast()

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
  const [isApplyOrgModalOpen, setIsApplyOrgModalOpen] = useState(false)

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

  // Apply to Org form state
  const [applyTargetOrgId, setApplyTargetOrgId] = useState('')
  const [applyingOrg, setApplyingOrg] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)

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
      toast({ tone: 'green', title: 'Team metadata updated successfully.' })
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
      toast({ tone: 'green', title: 'Member added to team successfully.' })
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
      toast({ tone: 'green', title: 'Member removed from team.' })
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
      toast({ tone: 'green', title: `Member role updated to ${newRole}.` })
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
      toast({ tone: 'green', title: 'Secondary organization linked successfully.' })
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
      toast({ tone: 'green', title: 'Secondary organization unlinked.' })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to unlink secondary organization')
    }
  }

  async function handleApplyToOrg(evt: React.FormEvent) {
    evt.preventDefault()
    if (!applyTargetOrgId || !authHeader || !team) return

    setApplyingOrg(true)
    setApplyError(null)
    try {
      await submitTeamApplication(
        {
          teamId: team.id,
          name: team.name,
          slug: team.slug,
          primaryOrganizationId: applyTargetOrgId,
        },
        authHeader,
      )
      setIsApplyOrgModalOpen(false)
      setSuccess('Application to join organization submitted successfully. Awaiting administrative review.')
      toast({ tone: 'green', title: 'Application to join organization submitted.' })
      void loadTeamData()
    } catch (cause) {
      setApplyError(cause instanceof Error ? cause.message : 'Failed to submit organization application')
    } finally {
      setApplyingOrg(false)
    }
  }

  const roleOptions = [
    { value: 'member', label: 'Member' },
    { value: 'administrator', label: 'Administrator' },
  ]

  const rosterColumns: PixelTableColumn<(typeof members)[0]>[] = [
    {
      key: 'userId',
      header: 'COMPETITOR',
      width: '40%',
      render: (m) => (
        <div>
          <UserLink userId={m.userId} name={m.name} slug={m.slug} />
          {m.slug && <span className="block text-xs text-retro-muted">@{m.slug}</span>}
        </div>
      ),
    },
    {
      key: 'role',
      header: 'ROLE',
      width: '20%',
      render: (m) => (
        <PixelBadge tone={m.role === 'administrator' ? 'purple' : 'neutral'}>
          {m.role}
        </PixelBadge>
      ),
    },
    {
      key: 'changeRole',
      header: 'CHANGE ROLE',
      width: '25%',
      render: (m) => (
        <select
          value={m.role}
          onChange={(e) => handleChangeRole(m.userId, e.target.value)}
          className="px-2 py-1 bg-retro-bg border border-retro-border rounded font-sans text-xs text-retro-text"
        >
          {roleOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ),
    },
    {
      key: 'actions',
      header: 'ACTION',
      width: '15%',
      render: (m) => (
        <PixelButton
          variant="ghost"
          tone="red"
          size="sm"
          onClick={() => handleRemoveMember(m.userId)}
        >
          REMOVE
        </PixelButton>
      ),
    },
  ]

  return (
    <PixelContainer maxWidth="full" padding="md">
      <PixelStack gap={6}>
        {/* Header Card */}
        <PixelCard className="bg-retro-surface">
          <PixelStack direction="row" gap={4} align="center" justify="between" wrap>
            <PixelStack gap={1}>
              <h1 className="text-2xl font-pixel text-retro-text font-bold">
                {team ? `MANAGE TEAM: ${team.name.toUpperCase()}` : 'TEAM MANAGEMENT'}
              </h1>
              {team && (
                <div className="text-xs font-pixel text-retro-muted">
                  SLUG: @{team.slug} | PRIMARY ORG ID: {team.primaryOrganizationId}
                </div>
              )}
            </PixelStack>

            <PixelStack direction="row" gap={2} wrap>
              <PixelButton
                variant="ghost"
                tone="neutral"
                size="sm"
                onClick={() => { setApplyError(null); setIsApplyOrgModalOpen(true); }}
              >
                APPLY TO ORG
              </PixelButton>
              <PixelButton
                variant="ghost"
                tone="neutral"
                size="sm"
                onClick={() => { setTeamError(null); setIsTeamModalOpen(true); }}
              >
                EDIT METADATA
              </PixelButton>
              <PixelButton
                variant="solid"
                tone="purple"
                size="sm"
                onClick={() => { setMemberError(null); setIsMemberModalOpen(true); }}
              >
                + ADD COMPETITOR
              </PixelButton>
            </PixelStack>
          </PixelStack>
        </PixelCard>

        {error && <PixelAlert tone="red" message={error} />}
        {success && <PixelAlert tone="green" message={success} />}

        {loading ? (
          <div className="font-pixel text-xs text-retro-muted">LOADING TEAM DETAILS...</div>
        ) : team ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Linked Organizations */}
            <div className="lg:col-span-1">
              <PixelCard className="bg-retro-surface">
                <PixelStack gap={4}>
                  <PixelStack direction="row" align="center" justify="between">
                    <PixelSectionHeader title="LINKED ORGANIZATIONS" size="sm" />
                    <PixelButton
                      variant="ghost"
                      tone="purple"
                      size="sm"
                      onClick={() => { setLinkError(null); setIsLinkOrgModalOpen(true); }}
                    >
                      + LINK ORG
                    </PixelButton>
                  </PixelStack>

                  <div className="flex flex-col gap-2">
                    {(team.organizations || [])
                      .filter((org) => org.id !== team.id)
                      .map((org) => (
                        <div
                          key={org.id}
                          className="flex justify-between items-center p-3 rounded bg-retro-bg border border-retro-border"
                        >
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-pixel text-xs text-retro-text font-bold truncate">
                                {org.name}
                              </span>
                              {org.isPrimary && <PixelBadge tone="green">PRIMARY</PixelBadge>}
                            </div>
                            <span className="text-xs font-sans text-retro-muted">@{org.slug}</span>
                          </div>

                          {!org.isPrimary && (
                            <PixelButton
                              variant="ghost"
                              tone="red"
                              size="sm"
                              onClick={() => handleUnlinkSecondaryOrg(org.id)}
                            >
                              UNLINK
                            </PixelButton>
                          )}
                        </div>
                      ))}
                    {(team.organizations || []).filter((org) => org.id !== team.id).length === 0 && (
                      <span className="font-pixel text-xs text-retro-muted">
                        NO EXTERNAL PARENT ORGANIZATIONS LINKED.
                      </span>
                    )}
                  </div>
                </PixelStack>
              </PixelCard>
            </div>

            {/* Right Column: Team Roster */}
            <div className="lg:col-span-2">
              <PixelCard className="bg-retro-surface">
                <PixelStack gap={4}>
                  <PixelStack direction="row" align="center" justify="between" wrap>
                    <PixelSectionHeader title={`ROSTER (${totalMembers})`} size="sm" />
                    <input
                      type="text"
                      placeholder="Search roster..."
                      value={memberSearch}
                      onChange={(e) => { setMemberSearch(e.target.value); setMemberPage(1); }}
                      className="px-3 py-1 bg-retro-bg border border-retro-border rounded font-sans text-xs text-retro-text focus:outline-none focus:border-retro-primary w-48"
                    />
                  </PixelStack>

                  {members.length > 0 ? (
                    <>
                      <div className="public-table">
                        <PixelTable
                          columns={rosterColumns}
                          data={members}
                          emptyState={<span className="font-pixel text-xs text-retro-muted">NO ROSTER MEMBERS FOUND</span>}
                        />
                      </div>

                      <Pagination
                        page={memberPage}
                        pageSize={memberPageSize}
                        total={totalMembers}
                        onPageChange={setMemberPage}
                        onPageSizeChange={setMemberPageSize}
                        variant="pixel"
                      />
                    </>
                  ) : (
                    <span className="font-pixel text-xs text-retro-muted">NO ROSTER MEMBERS FOUND</span>
                  )}
                </PixelStack>
              </PixelCard>
            </div>
          </div>
        ) : null}

        {/* EDIT TEAM METADATA MODAL */}
        {isTeamModalOpen && (
          <PixelModal
            open={isTeamModalOpen}
            onOpenChange={setIsTeamModalOpen}
            title="EDIT TEAM METADATA"
          >
            <form onSubmit={handleUpdateTeam} className="space-y-4">
              {teamError && <PixelAlert tone="red" message={teamError} />}

              <PixelInput
                label="TEAM NAME"
                required
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
              />

              <PixelInput
                label="TEAM SLUG"
                required
                value={teamSlug}
                onChange={(e) => setTeamSlug(e.target.value)}
              />

              <PixelInput
                label="LOGO URL"
                value={teamLogo}
                onChange={(e) => setTeamLogo(e.target.value)}
              />

              <div className="flex justify-end gap-2 pt-4 border-t border-retro-border">
                <PixelButton variant="ghost" tone="neutral" onClick={() => setIsTeamModalOpen(false)}>
                  CANCEL
                </PixelButton>
                <PixelButton variant="solid" tone="purple" type="submit" loading={updatingTeam}>
                  SAVE CHANGES
                </PixelButton>
              </div>
            </form>
          </PixelModal>
        )}

        {/* ADD MEMBER MODAL */}
        {isMemberModalOpen && (
          <PixelModal
            open={isMemberModalOpen}
            onOpenChange={setIsMemberModalOpen}
            title="ADD TEAM COMPETITOR"
          >
            <form onSubmit={handleAddMember} className="space-y-4">
              {memberError && <PixelAlert tone="red" message={memberError} />}

              <div>
                <label className="block font-pixel text-xs text-retro-text mb-1">SELECT USER</label>
                <UserSearchCombobox value={selectedUserId} onChange={setSelectedUserId} />
              </div>

              <div>
                <label className="block font-pixel text-xs text-retro-text mb-1">INITIAL ROLE</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full px-3 py-2 bg-retro-bg border-2 border-retro-border rounded font-sans text-sm text-retro-text focus:border-retro-primary focus:outline-none"
                >
                  {roleOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-retro-border">
                <PixelButton variant="ghost" tone="neutral" onClick={() => setIsMemberModalOpen(false)}>
                  CANCEL
                </PixelButton>
                <PixelButton variant="solid" tone="purple" type="submit" loading={addingMember}>
                  ADD COMPETITOR
                </PixelButton>
              </div>
            </form>
          </PixelModal>
        )}

        {/* APPLY TO ORGANIZATION MODAL */}
        {isApplyOrgModalOpen && (
          <PixelModal
            open={isApplyOrgModalOpen}
            onOpenChange={setIsApplyOrgModalOpen}
            title="APPLY TEAM TO ORGANIZATION"
          >
            <form onSubmit={handleApplyToOrg} className="space-y-4">
              {applyError && <PixelAlert tone="red" message={applyError} />}

              <div>
                <label className="block font-pixel text-xs text-retro-text mb-1">
                  TARGET ORGANIZATION
                </label>
                <select
                  value={applyTargetOrgId}
                  onChange={(e) => setApplyTargetOrgId(e.target.value)}
                  className="w-full px-3 py-2 bg-retro-bg border-2 border-retro-border rounded font-sans text-sm text-retro-text focus:border-retro-primary focus:outline-none"
                  required
                >
                  <option value="">-- Choose Target Organization --</option>
                  {approvedOrgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} (@{o.slug})
                    </option>
                  ))}
                </select>
                <p className="text-xs font-sans text-retro-muted mt-1">
                  Submitting will send an application for this team to join the selected organization, subject to review by system administrators.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-retro-border">
                <PixelButton variant="ghost" tone="neutral" onClick={() => setIsApplyOrgModalOpen(false)}>
                  CANCEL
                </PixelButton>
                <PixelButton variant="solid" tone="purple" type="submit" loading={applyingOrg}>
                  SUBMIT APPLICATION
                </PixelButton>
              </div>
            </form>
          </PixelModal>
        )}

        {/* LINK SECONDARY ORG MODAL */}
        {isLinkOrgModalOpen && (
          <PixelModal
            open={isLinkOrgModalOpen}
            onOpenChange={setIsLinkOrgModalOpen}
            title="LINK SECONDARY ORGANIZATION"
          >
            <form onSubmit={handleLinkSecondaryOrg} className="space-y-4">
              {linkError && <PixelAlert tone="red" message={linkError} />}

              <div>
                <label className="block font-pixel text-xs text-retro-text mb-1">
                  TARGET ORGANIZATION
                </label>
                <select
                  value={targetOrgId}
                  onChange={(e) => setTargetOrgId(e.target.value)}
                  className="w-full px-3 py-2 bg-retro-bg border-2 border-retro-border rounded font-sans text-sm text-retro-text focus:border-retro-primary focus:outline-none"
                  required
                >
                  <option value="">-- Choose Organization --</option>
                  {approvedOrgs
                    .filter((o) => !(team?.organizations || []).some((linked) => linked.id === o.id))
                    .map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name} ({o.slug})
                      </option>
                    ))}
                </select>
                <p className="text-xs font-sans text-retro-muted mt-1">
                  Note: You must hold administrator permissions on both the primary organization AND the target organization.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-retro-border">
                <PixelButton variant="ghost" tone="neutral" onClick={() => setIsLinkOrgModalOpen(false)}>
                  CANCEL
                </PixelButton>
                <PixelButton variant="solid" tone="purple" type="submit" loading={linkingOrg}>
                  LINK ORGANIZATION
                </PixelButton>
              </div>
            </form>
          </PixelModal>
        )}
      </PixelStack>
    </PixelContainer>
  )
}
