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
  submitTeamApplication,
  listAdminEvents,
  createAdminEvent,
  updateAdminEvent,
  deleteAdminEvent,
  restoreAdminEvent,
  listAdminApplications,
  reviewAdminApplication,
  updateAdminOrganization,
} from '../../lib/admin-api'
import { UserSearchCombobox } from '../../components/UserSearchCombobox'
import { Pagination } from '../../components/Pagination'
import { UserLink } from '../../components/UserLink'
import { MarkdownView } from '../../components/MarkdownView'
import type { teammanager, eventmanager } from '../../lib/client'
import {
  PixelContainer,
  PixelStack,
  PixelCard,
  PixelButton,
  PixelBadge,
  PixelSectionHeader,
  PixelAlert,
  PixelInput,
  PixelTextarea,
  PixelModal,
  PixelTable,
  type PixelTableColumn,
  useToast,
} from '@pxlkit/ui-kit'
import { ManagementLayout } from './-ManagementLayout'

export const Route = createFileRoute('/teams/manage/$id')({
  beforeLoad: async ({ location }) => {
    await requireAuth(location)
  },
  component: ManageOrgPage,
})

type TabType = 'overview' | 'events' | 'approvals'

function ManageOrgPage() {
  const { id: teamId } = Route.useParams()
  const { session, signOutUser } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState<TabType>('overview')

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

  // Events state
  const [events, setEvents] = useState<eventmanager.EventListItem[]>([])
  const [loadingEvents, setLoadingEvents] = useState(false)

  // Applications state
  const [applications, setApplications] = useState<teammanager.TeamApplicationView[]>([])
  const [loadingApplications, setLoadingApplications] = useState(false)

  // Modals state
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false)
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false)
  const [isLinkOrgModalOpen, setIsLinkOrgModalOpen] = useState(false)
  const [isApplyOrgModalOpen, setIsApplyOrgModalOpen] = useState(false)
  const [isCreateEventModalOpen, setIsCreateEventModalOpen] = useState(false)
  const [isEditEventModalOpen, setIsEditEventModalOpen] = useState(false)
  const [selectedEventToEdit, setSelectedEventToEdit] = useState<eventmanager.EventListItem | null>(null)

  // Metadata form state
  const [teamName, setTeamName] = useState('')
  const [teamSlug, setTeamSlug] = useState('')
  const [teamLogo, setTeamLogo] = useState('')
  const [teamDescription, setTeamDescription] = useState('')
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

  // Event form state
  const [eventName, setEventName] = useState('')
  const [eventDescription, setEventDescription] = useState('')
  const [eventScoringType, setEventScoringType] = useState(1)
  const [eventClassRestriction, setEventClassRestriction] = useState('')
  const [eventGranular, setEventGranular] = useState(true)
  const [creatingEvent, setCreatingEvent] = useState(false)
  const [eventError, setEventError] = useState<string | null>(null)

  const authHeader = useMemo(() => {
    const token = session?.session.token
    return token ? `Bearer ${token}` : null
  }, [session?.session.token])

  const userManagedOrgs = useMemo(() => {
    const list: Array<{ id: string; name: string; slug: string }> = []
    if (session?.user?.teams) {
      for (const t of session.user.teams) {
        list.push({ id: t.organizationId, name: t.name, slug: t.slug })
      }
    }
    if (approvedOrgs.length > 0) {
      for (const ao of approvedOrgs) {
        if (!list.some((x) => x.id === ao.id)) {
          list.push({ id: ao.id, name: ao.name, slug: ao.slug })
        }
      }
    }
    return list
  }, [session?.user?.teams, approvedOrgs])

  async function loadTeamData() {
    setLoading(true)
    setError(null)
    try {
      const loadedTeam = await getAdminTeam(teamId)
      setTeam(loadedTeam)

      setTeamName(loadedTeam.name || '')
      setTeamSlug(loadedTeam.slug || '')
      setTeamLogo(loadedTeam.logo || '')
      setTeamDescription(loadedTeam.description || '')

      const orgsRes = await listApprovedOrganizations()
      setApprovedOrgs(orgsRes.organizations || [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load organization/team details')
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

  async function fetchOrgEvents() {
    setLoadingEvents(true)
    try {
      const res = await listAdminEvents(teamId, undefined, 50, 0, undefined, undefined, true)
      setEvents(res.events || [])
    } catch (cause) {
      console.error('Failed to load org events', cause)
    } finally {
      setLoadingEvents(false)
    }
  }

  async function fetchApplications() {
    if (!authHeader) return
    setLoadingApplications(true)
    try {
      const res = await listAdminApplications(authHeader)
      setApplications((res.teams || []).filter((app) => app.primaryOrganization.id === teamId))
    } catch (cause) {
      console.error('Failed to load applications', cause)
    } finally {
      setLoadingApplications(false)
    }
  }

  useEffect(() => {
    void loadTeamData()
  }, [teamId, authHeader])

  useEffect(() => {
    if (activeTab === 'overview') {
      void fetchRoster()
    } else if (activeTab === 'events') {
      void fetchOrgEvents()
    } else if (activeTab === 'approvals') {
      void fetchApplications()
    }
  }, [teamId, activeTab, memberPage, memberPageSize, memberSearch])

  async function handleUpdateTeam(evt: React.FormEvent) {
    evt.preventDefault()
    if (!authHeader) return

    setUpdatingTeam(true)
    setTeamError(null)
    try {
      let updated: teammanager.Team
      try {
        await updateAdminOrganization(
          teamId,
          {
            name: teamName.trim() || undefined,
            slug: teamSlug.trim() || undefined,
            logo: teamLogo.trim() || null,
            clearLogo: !teamLogo.trim(),
            description: teamDescription.trim() || null,
            clearDescription: !teamDescription.trim(),
          },
          authHeader
        )
        updated = await getAdminTeam(teamId)
      } catch {
        updated = await updateAdminTeam(
          teamId,
          {
            name: teamName.trim() || undefined,
            slug: teamSlug.trim() || undefined,
            logo: teamLogo.trim() || null,
            description: teamDescription.trim() || null,
          },
          authHeader
        )
      }

      setTeam(updated)
      setIsTeamModalOpen(false)
      setSuccess('Organization details updated successfully.')
      toast({ tone: 'green', title: 'Organization details updated successfully.' })
    } catch (cause) {
      setTeamError(cause instanceof Error ? cause.message : 'Failed to update metadata')
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
        authHeader
      )
      setTeam(updated)
      setIsMemberModalOpen(false)
      setSuccess('Member added successfully.')
      toast({ tone: 'green', title: 'Member added successfully.' })
      void fetchRoster()
    } catch (cause) {
      setMemberError(cause instanceof Error ? cause.message : 'Failed to add member')
    } finally {
      setAddingMember(false)
    }
  }

  async function handleRemoveMember(memberUserId: string) {
    if (!authHeader) return
    if (!confirm('Are you sure you want to remove this member?')) return

    setError(null)
    setSuccess(null)
    try {
      const updated = await removeAdminTeamMember(teamId, memberUserId, authHeader)
      setTeam(updated)
      setSuccess('Member removed successfully.')
      toast({ tone: 'green', title: 'Member removed.' })
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
      toast({ tone: 'green', title: `Member role updated to ${newRole}.` })
      void fetchRoster()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to change member role')
    }
  }

  async function handleCreateEvent(evt: React.FormEvent) {
    evt.preventDefault()
    if (!authHeader) return

    setCreatingEvent(true)
    setEventError(null)
    try {
      await createAdminEvent(
        {
          name: eventName,
          description: eventDescription || null,
          ownerType: 'ORGANIZATION',
          organizationId: teamId,
          scoringType: eventScoringType,
          classRestriction: (eventClassRestriction as any) || null,
          granularParticipation: eventGranular,
        },
        authHeader
      )
      setIsCreateEventModalOpen(false)
      setEventName('')
      setEventDescription('')
      setSuccess('Organization event created successfully.')
      toast({ tone: 'green', title: 'Event created successfully.' })
      void fetchOrgEvents()
    } catch (cause) {
      setEventError(cause instanceof Error ? cause.message : 'Failed to create event')
    } finally {
      setCreatingEvent(false)
    }
  }

  async function handleUpdateEvent(evt: React.FormEvent) {
    evt.preventDefault()
    if (!authHeader || !selectedEventToEdit) return

    setCreatingEvent(true)
    setEventError(null)
    try {
      await updateAdminEvent(
        selectedEventToEdit.id,
        {
          name: eventName,
          description: eventDescription || null,
          classRestriction: (eventClassRestriction as any) || null,
        },
        authHeader
      )
      setIsEditEventModalOpen(false)
      setSelectedEventToEdit(null)
      setSuccess('Event updated successfully.')
      toast({ tone: 'green', title: 'Event updated.' })
      void fetchOrgEvents()
    } catch (cause) {
      setEventError(cause instanceof Error ? cause.message : 'Failed to update event')
    } finally {
      setCreatingEvent(false)
    }
  }

  async function handleDeleteEvent(eventId: string) {
    if (!authHeader) return
    if (!confirm('Are you sure you want to soft-delete this event?')) return

    try {
      await deleteAdminEvent(eventId, authHeader, false)
      toast({ tone: 'green', title: 'Event moved to pending deletion.' })
      void fetchOrgEvents()
    } catch (cause) {
      toast({ tone: 'red', title: cause instanceof Error ? cause.message : 'Failed to delete event' })
    }
  }

  async function handleRestoreEvent(eventId: string) {
    if (!authHeader) return

    try {
      await restoreAdminEvent(eventId, authHeader)
      toast({ tone: 'green', title: 'Event restored.' })
      void fetchOrgEvents()
    } catch (cause) {
      toast({ tone: 'red', title: cause instanceof Error ? cause.message : 'Failed to restore event' })
    }
  }

  async function handleReviewApplication(appId: string, action: 'APPROVE' | 'REJECT') {
    if (!authHeader) return

    try {
      await reviewAdminApplication(appId, 'TEAM', action, authHeader)
      toast({ tone: 'green', title: `Team application ${action.toLowerCase()}d.` })
      void fetchApplications()
    } catch (cause) {
      toast({ tone: 'red', title: cause instanceof Error ? cause.message : 'Failed to review application' })
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
      toast({ tone: 'green', title: 'Secondary organization linked.' })
    } catch (cause) {
      setLinkError(cause instanceof Error ? cause.message : 'Failed to link organization')
    } finally {
      setLinkingOrg(false)
    }
  }

  async function handleUnlinkSecondaryOrg(orgId: string) {
    if (!authHeader) return
    if (!confirm('Are you sure you want to unlink this secondary organization?')) return

    try {
      const updated = await unlinkSecondaryOrganization(teamId, orgId, authHeader)
      setTeam(updated)
      toast({ tone: 'green', title: 'Secondary organization unlinked.' })
    } catch (cause) {
      toast({ tone: 'red', title: cause instanceof Error ? cause.message : 'Failed to unlink organization' })
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
        authHeader
      )
      setIsApplyOrgModalOpen(false)
      setSuccess('Application to join organization submitted successfully.')
      toast({ tone: 'green', title: 'Application submitted.' })
      void loadTeamData()
    } catch (cause) {
      setApplyError(cause instanceof Error ? cause.message : 'Failed to submit application')
    } finally {
      setApplyingOrg(false)
    }
  }

  const roleOptions = [
    { value: 'member', label: 'Member' },
    { value: 'eventAdmin', label: 'Event Admin' },
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
        <PixelBadge tone={m.role === 'administrator' ? 'purple' : m.role.toLowerCase().includes('event') ? 'cyan' : 'neutral'}>
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
    <ManagementLayout>
      <PixelContainer maxWidth="full" padding="md">
        <PixelStack gap={6}>
          {/* Header Card & Navigation Tabs */}
          <PixelCard className="bg-retro-surface">
            <PixelStack gap={4}>
              <PixelStack direction="row" gap={4} align="center" justify="between" wrap>
                <PixelStack gap={1}>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-2xl font-pixel text-retro-text font-bold">
                      {team ? team.name.toUpperCase() : 'ORGANIZATION MANAGEMENT'}
                    </h1>
                    {team && (
                      <PixelBadge tone="purple">
                        {!team.primaryOrganizationId || team.primaryOrganizationId === team.id
                          ? 'ORGANIZATION'
                          : 'TEAM'}
                      </PixelBadge>
                    )}
                  </div>
                  {team && (
                    <div className="text-xs font-pixel text-retro-muted">
                      SLUG: @{team.slug} | ID: {team.id}
                    </div>
                  )}
                </PixelStack>

                <PixelStack direction="row" gap={2} wrap>
                  <PixelButton
                    variant="ghost"
                    tone="neutral"
                    size="sm"
                    onClick={() => {
                      setTeamError(null)
                      setIsTeamModalOpen(true)
                    }}
                  >
                    EDIT METADATA
                  </PixelButton>
                  <PixelButton
                    variant="solid"
                    tone="purple"
                    size="sm"
                    onClick={() => {
                      setMemberError(null)
                      setIsMemberModalOpen(true)
                    }}
                  >
                    + ADD MEMBER
                  </PixelButton>
                </PixelStack>
              </PixelStack>

              {/* Management Tabs */}
              <div className="flex items-center gap-2 border-b-2 border-retro-border pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('overview')}
                  className={`px-4 py-2 font-pixel text-xs font-bold transition-colors border-b-2 -mb-[2px] ${
                    activeTab === 'overview'
                      ? 'border-retro-primary text-retro-primary bg-retro-bg'
                      : 'border-transparent text-retro-muted hover:text-retro-text'
                  }`}
                >
                  OVERVIEW & ROSTER
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('events')}
                  className={`px-4 py-2 font-pixel text-xs font-bold transition-colors border-b-2 -mb-[2px] ${
                    activeTab === 'events'
                      ? 'border-retro-primary text-retro-primary bg-retro-bg'
                      : 'border-transparent text-retro-muted hover:text-retro-text'
                  }`}
                >
                  EVENTS & RACES
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('approvals')}
                  className={`px-4 py-2 font-pixel text-xs font-bold transition-colors border-b-2 -mb-[2px] ${
                    activeTab === 'approvals'
                      ? 'border-retro-primary text-retro-primary bg-retro-bg'
                      : 'border-transparent text-retro-muted hover:text-retro-text'
                  }`}
                >
                  TEAM APPROVALS {applications.length > 0 ? `(${applications.length})` : ''}
                </button>
              </div>
            </PixelStack>
          </PixelCard>

          {error && <PixelAlert tone="red" message={error} />}
          {success && <PixelAlert tone="green" message={success} />}

          {loading ? (
            <div className="font-pixel text-xs text-retro-muted">LOADING DETAILS...</div>
          ) : team ? (
            <>
              {/* TAB 1: OVERVIEW & ROSTER */}
              {activeTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column: Details & Linked Organizations */}
                  <div className="lg:col-span-1 space-y-6">
                    <PixelCard className="bg-retro-surface">
                      <PixelStack gap={4}>
                        <PixelSectionHeader title="DESCRIPTION" size="sm" />
                        <div className="font-sans text-xs text-retro-text leading-relaxed">
                          <MarkdownView
                            content={team.description}
                            fallbackText="No description details set. Click Edit Metadata to add markdown."
                          />
                        </div>
                      </PixelStack>
                    </PixelCard>

                    <PixelCard className="bg-retro-surface">
                      <PixelStack gap={4}>
                        <PixelStack direction="row" align="center" justify="between">
                          <PixelSectionHeader title="LINKED ORGANIZATIONS" size="sm" />
                          <PixelButton
                            variant="ghost"
                            tone="purple"
                            size="sm"
                            onClick={() => {
                              setLinkError(null)
                              setIsLinkOrgModalOpen(true)
                            }}
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

                        <PixelButton
                          variant="ghost"
                          tone="neutral"
                          size="sm"
                          onClick={() => {
                            setApplyError(null)
                            setIsApplyOrgModalOpen(true)
                          }}
                        >
                          APPLY TO JOIN ANOTHER ORG
                        </PixelButton>
                      </PixelStack>
                    </PixelCard>
                  </div>

                  {/* Right Column: Roster Table */}
                  <div className="lg:col-span-2">
                    <PixelCard className="bg-retro-surface">
                      <PixelStack gap={4}>
                        <PixelStack direction="row" align="center" justify="between" wrap>
                          <PixelSectionHeader title={`ROSTER (${totalMembers})`} size="sm" />
                          <input
                            type="text"
                            placeholder="Search roster..."
                            value={memberSearch}
                            onChange={(e) => {
                              setMemberSearch(e.target.value)
                              setMemberPage(1)
                            }}
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
              )}

              {/* TAB 2: EVENTS & RACES */}
              {activeTab === 'events' && (
                <PixelCard className="bg-retro-surface">
                  <PixelStack gap={4}>
                    <PixelStack direction="row" align="center" justify="between" wrap>
                      <PixelSectionHeader title={`ORGANIZATION EVENTS (${events.length})`} size="sm" />
                      <PixelButton
                        variant="solid"
                        tone="purple"
                        size="sm"
                        onClick={() => {
                          setEventError(null)
                          setIsCreateEventModalOpen(true)
                        }}
                      >
                        + CREATE EVENT
                      </PixelButton>
                    </PixelStack>

                    {loadingEvents ? (
                      <div className="font-pixel text-xs text-retro-muted py-4">LOADING EVENTS...</div>
                    ) : events.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {events.map((evt) => (
                          <PixelCard
                            key={evt.id}
                            className="bg-retro-bg p-4 border border-retro-border hover:border-retro-primary transition-all flex flex-col justify-between"
                          >
                            <PixelStack gap={2}>
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <h3 className="font-pixel text-sm font-bold text-retro-text truncate">
                                  {evt.name}
                                </h3>
                                <PixelBadge
                                  tone={
                                    evt.status === 'ONGOING'
                                      ? 'green'
                                      : evt.status === 'CONCLUDED'
                                      ? 'neutral'
                                      : evt.status === 'PENDING_DELETION'
                                      ? 'pink'
                                      : 'purple'
                                  }
                                >
                                  {evt.status}
                                </PixelBadge>
                              </div>

                              <p className="font-sans text-xs text-retro-muted line-clamp-2">
                                {evt.description || 'No description provided.'}
                              </p>

                              <div className="flex items-center gap-3 font-pixel text-[10px] text-retro-muted flex-wrap">
                                <span>RACES: {evt.raceCount}</span>
                                <span>MEMBERS: {evt.memberCount}</span>
                                <span>TYPE: {evt.scoringTypeLabel.toUpperCase()}</span>
                              </div>
                            </PixelStack>

                            <div className="flex items-center justify-end gap-2 pt-4 mt-2 border-t border-retro-border">
                              <PixelButton asChild variant="ghost" tone="neutral" size="sm">
                                <Link to="/events/$eventId" params={{ eventId: evt.id }}>
                                  VIEW
                                </Link>
                              </PixelButton>
                              <PixelButton
                                variant="ghost"
                                tone="purple"
                                size="sm"
                                onClick={() => {
                                  setSelectedEventToEdit(evt)
                                  setEventName(evt.name)
                                  setEventDescription(evt.description || '')
                                  setEventClassRestriction(evt.classRestriction || '')
                                  setEventError(null)
                                  setIsEditEventModalOpen(true)
                                }}
                              >
                                EDIT
                              </PixelButton>
                              {evt.status === 'PENDING_DELETION' ? (
                                <PixelButton
                                  variant="ghost"
                                  tone="green"
                                  size="sm"
                                  onClick={() => handleRestoreEvent(evt.id)}
                                >
                                  RESTORE
                                </PixelButton>
                              ) : (
                                <PixelButton
                                  variant="ghost"
                                  tone="red"
                                  size="sm"
                                  onClick={() => handleDeleteEvent(evt.id)}
                                >
                                  DELETE
                                </PixelButton>
                              )}
                            </div>
                          </PixelCard>
                        ))}
                      </div>
                    ) : (
                      <span className="font-pixel text-xs text-retro-muted">
                        NO EVENTS CREATED UNDER THIS ORGANIZATION YET.
                      </span>
                    )}
                  </PixelStack>
                </PixelCard>
              )}

              {/* TAB 3: TEAM APPROVALS */}
              {activeTab === 'approvals' && (
                <PixelCard className="bg-retro-surface">
                  <PixelStack gap={4}>
                    <PixelSectionHeader title={`PENDING TEAM APPLICATIONS (${applications.length})`} size="sm" />

                    {loadingApplications ? (
                      <div className="font-pixel text-xs text-retro-muted py-4">LOADING APPLICATIONS...</div>
                    ) : applications.length > 0 ? (
                      <div className="space-y-4">
                        {applications.map((app) => (
                          <div
                            key={app.id}
                            className="p-4 bg-retro-bg border-2 border-retro-border rounded flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                          >
                            <PixelStack gap={1} className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-pixel text-sm font-bold text-retro-text">{app.name}</span>
                                <span className="font-sans text-xs text-retro-muted">@{app.slug}</span>
                              </div>
                              <span className="font-sans text-xs text-retro-muted">
                                Submitted by User ID: {app.submittedByUserId} | Members: {app.members?.length || 0}
                              </span>
                            </PixelStack>

                            <PixelStack direction="row" gap={2}>
                              <PixelButton
                                variant="solid"
                                tone="green"
                                size="sm"
                                onClick={() => handleReviewApplication(app.id, 'APPROVE')}
                              >
                                APPROVE
                              </PixelButton>
                              <PixelButton
                                variant="ghost"
                                tone="red"
                                size="sm"
                                onClick={() => handleReviewApplication(app.id, 'REJECT')}
                              >
                                REJECT
                              </PixelButton>
                            </PixelStack>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="font-pixel text-xs text-retro-muted">
                        NO PENDING TEAM APPLICATIONS FOR THIS ORGANIZATION.
                      </span>
                    )}
                  </PixelStack>
                </PixelCard>
              )}
            </>
          ) : null}

          {/* EDIT METADATA MODAL */}
          {isTeamModalOpen && (
            <PixelModal
              open={isTeamModalOpen}
              onClose={() => setIsTeamModalOpen(false)}
              title="EDIT METADATA"
            >
              <form onSubmit={handleUpdateTeam} className="space-y-4">
                {teamError && <PixelAlert tone="red" message={teamError} />}

                <PixelInput
                  label="NAME"
                  required
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                />

                <PixelInput
                  label="SLUG"
                  required
                  value={teamSlug}
                  onChange={(e) => setTeamSlug(e.target.value)}
                />

                <PixelInput
                  label="LOGO URL"
                  value={teamLogo}
                  onChange={(e) => setTeamLogo(e.target.value)}
                />

                <PixelTextarea
                  label="DESCRIPTION (MARKDOWN SUPPORTED)"
                  value={teamDescription}
                  onChange={(e) => setTeamDescription(e.target.value)}
                  rows={4}
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
              onClose={() => setIsMemberModalOpen(false)}
              title="ADD MEMBER"
            >
              <form onSubmit={handleAddMember} className="space-y-4">
                {memberError && <PixelAlert tone="red" message={memberError} />}

                <div>
                  <label className="block font-pixel text-xs text-retro-text mb-1">SELECT USER</label>
                  <UserSearchCombobox value={selectedUserId} onChange={setSelectedUserId} />
                </div>

                <div>
                  <label className="block font-pixel text-xs text-retro-text mb-1">ROLE</label>
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
                    ADD MEMBER
                  </PixelButton>
                </div>
              </form>
            </PixelModal>
          )}

          {/* CREATE EVENT MODAL */}
          {isCreateEventModalOpen && (
            <PixelModal
              open={isCreateEventModalOpen}
              onClose={() => setIsCreateEventModalOpen(false)}
              title="CREATE ORGANIZATION EVENT"
            >
              <form onSubmit={handleCreateEvent} className="space-y-4">
                {eventError && <PixelAlert tone="red" message={eventError} />}

                <PixelInput
                  label="EVENT NAME"
                  required
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                />

                <PixelTextarea
                  label="DESCRIPTION"
                  value={eventDescription}
                  onChange={(e) => setEventDescription(e.target.value)}
                  rows={3}
                />

                <div>
                  <label className="block font-pixel text-xs text-retro-text mb-1">SCORING TYPE</label>
                  <select
                    value={eventScoringType}
                    onChange={(e) => setEventScoringType(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-retro-bg border-2 border-retro-border rounded font-sans text-sm text-retro-text"
                  >
                    <option value={1}>Points-based (Season points)</option>
                    <option value={2}>Ladder-Elo (Global Elo ranking)</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="granular"
                    checked={eventGranular}
                    onChange={(e) => setEventGranular(e.target.checked)}
                    className="w-4 h-4 accent-retro-primary"
                  />
                  <label htmlFor="granular" className="font-pixel text-xs text-retro-text cursor-pointer">
                    Granular Participation (Per-race member enrollment)
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-retro-border">
                  <PixelButton variant="ghost" tone="neutral" onClick={() => setIsCreateEventModalOpen(false)}>
                    CANCEL
                  </PixelButton>
                  <PixelButton variant="solid" tone="purple" type="submit" loading={creatingEvent}>
                    CREATE EVENT
                  </PixelButton>
                </div>
              </form>
            </PixelModal>
          )}

          {/* EDIT EVENT MODAL */}
          {isEditEventModalOpen && selectedEventToEdit && (
            <PixelModal
              open={isEditEventModalOpen}
              onClose={() => setIsEditEventModalOpen(false)}
              title="EDIT ORGANIZATION EVENT"
            >
              <form onSubmit={handleUpdateEvent} className="space-y-4">
                {eventError && <PixelAlert tone="red" message={eventError} />}

                <PixelInput
                  label="EVENT NAME"
                  required
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                />

                <PixelTextarea
                  label="DESCRIPTION"
                  value={eventDescription}
                  onChange={(e) => setEventDescription(e.target.value)}
                  rows={3}
                />

                <div className="flex justify-end gap-2 pt-4 border-t border-retro-border">
                  <PixelButton variant="ghost" tone="neutral" onClick={() => setIsEditEventModalOpen(false)}>
                    CANCEL
                  </PixelButton>
                  <PixelButton variant="solid" tone="purple" type="submit" loading={creatingEvent}>
                    SAVE CHANGES
                  </PixelButton>
                </div>
              </form>
            </PixelModal>
          )}

          {/* APPLY TO ORGANIZATION MODAL */}
          {isApplyOrgModalOpen && (
            <PixelModal
              open={isApplyOrgModalOpen}
              onClose={() => setIsApplyOrgModalOpen(false)}
              title="APPLY TO ORGANIZATION"
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
                    className="w-full px-3 py-2 bg-retro-bg border-2 border-retro-border rounded font-sans text-sm text-retro-text"
                    required
                  >
                    <option value="">-- Choose Target Organization --</option>
                    {approvedOrgs.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name} (@{o.slug})
                      </option>
                    ))}
                  </select>
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
              onClose={() => setIsLinkOrgModalOpen(false)}
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
                    className="w-full px-3 py-2 bg-retro-bg border-2 border-retro-border rounded font-sans text-sm text-retro-text"
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
    </ManagementLayout>
  )
}
