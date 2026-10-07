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
  listAdminDatasets,
  createAdminDataset,
  updateAdminDatasetStatus,
  createRaceEvent,
  addEventMember,
} from '../../lib/admin-api'
import { UserSearchCombobox } from '../../components/UserSearchCombobox'
import { RaceMemberCombobox } from '../../components/RaceDetailPane'
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
  PixelSpinner,
  type PixelTableColumn,
  useToast,
} from '@pxlkit/ui-kit'
import { ManagementLayout } from './-ManagementLayout'
import { useEventDetail } from '../../hooks/useEventDetail'
import { EventScoringTablesEditor } from '../../components/EventScoringTablesEditor'
import { StandingsEditor } from '../../components/StandingsEditor'
import { DEFAULT_SCORING_TABLES } from '../../lib/scoringDefaults'
import { toLocalISOString } from '../../lib/datetime'
import type { ClassTier, EventStatus, EventTag } from '../../types'

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
  const isOrg = team
    ? (team.isOrganization ?? (!team.primaryOrganizationId || team.primaryOrganizationId === team.id))
    : true

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
  const [selectedManagedEventId, setSelectedManagedEventId] = useState<string | null>(null)

  // Applications state
  const [applications, setApplications] = useState<teammanager.TeamApplicationView[]>([])
  const [loadingApplications, setLoadingApplications] = useState(false)

  // Modals state
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false)
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false)
  const [isLinkOrgModalOpen, setIsLinkOrgModalOpen] = useState(false)
  const [isApplyOrgModalOpen, setIsApplyOrgModalOpen] = useState(false)
  const [isCreateEventModalOpen, setIsCreateEventModalOpen] = useState(false)

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
  const eventTag: EventTag = 'OFFICIAL'
  const [eventScoringType, setEventScoringType] = useState<number>(1)
  const [eventClassRestriction, setEventClassRestriction] = useState<string>('')
  const [eventGranular, setEventGranular] = useState(true)
  const [eventScheduledAt, setEventScheduledAt] = useState('')
  const [eventParticipantLimit, setEventParticipantLimit] = useState('')
  const [eventMaxConcurrent, setEventMaxConcurrent] = useState('')
  const [eventScoringRulesMode, setEventScoringRulesMode] = useState<'STANDARD' | 'CUSTOM'>('STANDARD')
  const [eventCustomScoringTables, setEventCustomScoringTables] = useState<Record<string, Record<number, number>>>(DEFAULT_SCORING_TABLES)
  const [creatingEvent, setCreatingEvent] = useState(false)
  const [eventError, setEventError] = useState<string | null>(null)

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
    if (!isOrg && activeTab !== 'overview') {
      setActiveTab('overview')
    }
  }, [isOrg, activeTab])

  useEffect(() => {
    if (activeTab === 'overview') {
      void fetchRoster()
    } else if (activeTab === 'events' && isOrg) {
      void fetchOrgEvents()
    } else if (activeTab === 'approvals' && isOrg) {
      void fetchApplications()
    }
  }, [teamId, activeTab, memberPage, memberPageSize, memberSearch, isOrg])

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
      const limitNum = eventParticipantLimit.trim() ? Number(eventParticipantLimit) : null
      const maxConcurrentNum = eventMaxConcurrent.trim() ? Number(eventMaxConcurrent) : null

      await createAdminEvent(
        {
          name: eventName,
          description: eventDescription || null,
          ownerType: 'ORGANIZATION',
          organizationId: teamId,
          tag: eventTag,
          scoringType: eventScoringType,
          classRestriction: (eventClassRestriction as any) || null,
          granularParticipation: eventGranular,
          scoringRulesMode: eventScoringType === 1 ? eventScoringRulesMode : null,
          customScoringTables: eventScoringType === 1 && eventScoringRulesMode === 'CUSTOM' ? eventCustomScoringTables : null,
          scheduledAt: eventScheduledAt ? new Date(eventScheduledAt).toISOString() : null,
          participantLimit: !eventGranular ? limitNum : null,
          maxConcurrentRaceParticipations: eventGranular ? maxConcurrentNum : null,
        },
        authHeader
      )
      setIsCreateEventModalOpen(false)
      setEventName('')
      setEventDescription('')
      setEventClassRestriction('')
      setEventScheduledAt('')
      setEventParticipantLimit('')
      setEventMaxConcurrent('')
      setEventScoringRulesMode('STANDARD')
      setEventCustomScoringTables(DEFAULT_SCORING_TABLES)
      setSuccess('Organization event created successfully.')
      toast({ tone: 'green', title: 'Event created successfully.' })
      void fetchOrgEvents()
    } catch (cause) {
      setEventError(cause instanceof Error ? cause.message : 'Failed to create event')
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

  const roleOptions = isOrg
    ? [
        { value: 'member', label: 'Member' },
        { value: 'eventAdmin', label: 'Event Admin' },
        { value: 'administrator', label: 'Administrator' },
      ]
    : [
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
                      {team ? team.name.toUpperCase() : 'MANAGEMENT CONSOLE'}
                    </h1>
                    {team && (
                      <PixelBadge tone="purple">
                        {isOrg ? 'ORGANIZATION' : 'TEAM'}
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
                {isOrg && (
                  <>
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
                  </>
                )}
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
                selectedManagedEventId ? (
                  <OrgEventDetailView
                    eventId={selectedManagedEventId}
                    authHeader={authHeader}
                    onBack={() => {
                      setSelectedManagedEventId(null)
                      void fetchOrgEvents()
                    }}
                  />
                ) : (
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
                                  <div className="flex items-center gap-1">
                                    <PixelBadge tone={evt.tag === 'OFFICIAL' ? 'purple' : 'cyan'}>
                                      {evt.tag || 'OFFICIAL'}
                                    </PixelBadge>
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
                                <PixelButton
                                  variant="solid"
                                  tone="purple"
                                  size="sm"
                                  onClick={() => setSelectedManagedEventId(evt.id)}
                                >
                                  MANAGE EVENT
                                </PixelButton>
                                <PixelButton asChild variant="ghost" tone="neutral" size="sm">
                                  <Link to="/events/$eventId" params={{ eventId: evt.id }}>
                                    PUBLIC VIEW
                                  </Link>
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
                )
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
              <form onSubmit={handleCreateEvent} className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
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

                <div>
                  <label className="block font-pixel text-xs text-retro-text mb-1">CLASS TIER RESTRICTION</label>
                  <select
                    value={eventClassRestriction}
                    onChange={(e) => setEventClassRestriction(e.target.value)}
                    className="w-full px-3 py-2 bg-retro-bg border-2 border-retro-border rounded font-sans text-sm text-retro-text"
                  >
                    <option value="">Any Tier Eligibility (None)</option>
                    <option value="G3">G3</option>
                    <option value="G2">G2</option>
                    <option value="G1">G1</option>
                  </select>
                </div>

                {eventScoringType === 1 && (
                  <div>
                    <label className="block font-pixel text-xs text-retro-text mb-1">POINTS SCORING RULES MODE</label>
                    <select
                      value={eventScoringRulesMode}
                      onChange={(e) => setEventScoringRulesMode(e.target.value as any)}
                      className="w-full px-3 py-2 bg-retro-bg border-2 border-retro-border rounded font-sans text-sm text-retro-text"
                    >
                      <option value="STANDARD">Standard Default Tables</option>
                      <option value="CUSTOM">Custom Event Tables (Configure below)</option>
                    </select>

                    {eventScoringRulesMode === 'CUSTOM' && (
                      <div className="mt-2">
                        <EventScoringTablesEditor
                          value={eventCustomScoringTables}
                          onChange={setEventCustomScoringTables}
                        />
                      </div>
                    )}
                  </div>
                )}

                <PixelInput
                  label="SCHEDULED DATE / TIME"
                  type="datetime-local"
                  value={eventScheduledAt}
                  onChange={(e) => setEventScheduledAt(e.target.value)}
                />

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

                {!eventGranular ? (
                  <PixelInput
                    label="PARTICIPANT LIMIT"
                    type="number"
                    placeholder="e.g. 20"
                    value={eventParticipantLimit}
                    onChange={(e) => setEventParticipantLimit(e.target.value)}
                  />
                ) : (
                  <PixelInput
                    label="MAX RACES PER PARTICIPANT"
                    type="number"
                    placeholder="e.g. 3"
                    value={eventMaxConcurrent}
                    onChange={(e) => setEventMaxConcurrent(e.target.value)}
                  />
                )}

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

function OrgEventDetailView({
  eventId,
  authHeader,
  onBack,
}: {
  eventId: string
  authHeader: string | null
  onBack: () => void
}) {
  const { toast } = useToast()
  const detail = useEventDetail(eventId)
  const {
    selectedEvent,
    activeTab,
    setActiveTab,
    races,
    selectedRaceId,
    selectedRace,
    loadingEventDetail,
    loadingResults,
    savingBatch,
    eventStatusSaving,
    signupsLockedSaving,
    globalError,
    globalSuccess,
    derivedStates,
    changeSummary,
    handleUpdateEventStatus,
    handleSetSignupsLocked,
    handleUpdateEventDetails,
    handleRecomputeEventPoints,
    handleDeleteEvent,
    handleRestoreEvent,
    handleAddMember,
    handleRemoveMember,
    handleAddRaceMember,
    handleRemoveRaceMember,
    handleCreateRace,
    handleStartRace,
    handleEndRace,
    handleDeleteRace,
    handleSelectRace,
    handleResultChange,
    togglePendingDeletion,
    handleUndoRow,
    resetStandingsDraft,
    handleInferFinishTimes,
    handleCancelStandingsEdit,
    handleUnifiedSave,
  } = detail

  // Edit Event Modal State
  const [showEditModal, setShowEditModal] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editClassRestriction, setEditClassRestriction] = useState('')
  const [editScheduledAt, setEditScheduledAt] = useState('')
  const [editParticipantLimit, setEditParticipantLimit] = useState('')
  const [editMaxConcurrent, setEditMaxConcurrent] = useState('')
  const [editSignupsLocked, setEditSignupsLocked] = useState(false)
  const [editScoringRulesMode, setEditScoringRulesMode] = useState<'STANDARD' | 'CUSTOM'>('STANDARD')
  const [editCustomScoringTables, setEditCustomScoringTables] = useState<Record<string, Record<number, number>>>(DEFAULT_SCORING_TABLES)

  // Member Add State
  const [addMemberUserId, setAddMemberUserId] = useState('')

  // Create Race Modal State
  const [showCreateRaceModal, setShowCreateRaceModal] = useState(false)
  const [raceName, setRaceName] = useState('')
  const [raceTrackType, setRaceTrackType] = useState('Turf')
  const [raceLocation, setRaceLocation] = useState('')
  const [raceDistance, setRaceDistance] = useState(1200)
  const [raceGrade, setRaceGrade] = useState('')

  // Race Member Add State
  const [addRaceMemberUserId, setAddRaceMemberUserId] = useState('')

  // Datasets State
  const [datasets, setDatasets] = useState<eventmanager.DatasetView[]>([])
  const [loadingDatasets, setLoadingDatasets] = useState(false)
  const [showCreateDatasetModal, setShowCreateDatasetModal] = useState(false)
  const [datasetSource, setDatasetSource] = useState('')
  const [datasetRows, setDatasetRows] = useState(10)

  useEffect(() => {
    if (selectedEvent) {
      setEditName(selectedEvent.name)
      setEditDescription(selectedEvent.description ?? '')
      setEditClassRestriction(selectedEvent.classRestriction ?? '')
      setEditScheduledAt(selectedEvent.scheduledAt ? toLocalISOString(selectedEvent.scheduledAt) : '')
      setEditParticipantLimit(selectedEvent.participantLimit !== null ? String(selectedEvent.participantLimit) : '')
      setEditMaxConcurrent(selectedEvent.maxConcurrentRaceParticipations !== null ? String(selectedEvent.maxConcurrentRaceParticipations) : '')
      setEditSignupsLocked(selectedEvent.signupsLocked)
      setEditScoringRulesMode((selectedEvent.scoringRulesMode as 'STANDARD' | 'CUSTOM') || 'STANDARD')
      if (selectedEvent.customScoringTables) {
        setEditCustomScoringTables(selectedEvent.customScoringTables as Record<string, Record<number, number>>)
      } else {
        setEditCustomScoringTables(DEFAULT_SCORING_TABLES)
      }
    }
  }, [selectedEvent, showEditModal])

  useEffect(() => {
    if (activeTab === 'datasets' && eventId) {
      void fetchDatasets()
    }
  }, [activeTab, eventId])

  async function fetchDatasets() {
    setLoadingDatasets(true)
    try {
      const res = await listAdminDatasets(eventId)
      setDatasets(res.datasets || [])
    } catch (err) {
      console.error('Failed to load datasets', err)
    } finally {
      setLoadingDatasets(false)
    }
  }

  async function handleCreateDataset(e: React.FormEvent) {
    e.preventDefault()
    if (!authHeader || !datasetSource) return
    try {
      await createAdminDataset(eventId, datasetSource, datasetRows, 'PENDING', authHeader)
      setShowCreateDatasetModal(false)
      setDatasetSource('')
      toast({ tone: 'green', title: 'Dataset created.' })
      void fetchDatasets()
    } catch (err) {
      toast({ tone: 'red', title: err instanceof Error ? err.message : 'Failed to create dataset' })
    }
  }

  async function handleUpdateDatasetStatus(dsId: string, status: string) {
    if (!authHeader) return
    try {
      await updateAdminDatasetStatus(eventId, dsId, status, authHeader)
      toast({ tone: 'green', title: 'Dataset status updated.' })
      void fetchDatasets()
    } catch (err) {
      toast({ tone: 'red', title: err instanceof Error ? err.message : 'Failed to update dataset status' })
    }
  }

  async function onSaveEditDetails(e: React.FormEvent) {
    e.preventDefault()
    const limitNum = editParticipantLimit.trim() ? Number(editParticipantLimit) : null
    const maxConcurrentNum = editMaxConcurrent.trim() ? Number(editMaxConcurrent) : null

    await handleUpdateEventDetails({
      name: editName,
      description: editDescription || null,
      classRestriction: (editClassRestriction as any) || null,
      scheduledAt: editScheduledAt ? new Date(editScheduledAt).toISOString() : null,
      participantLimit: limitNum,
      maxConcurrentRaceParticipations: maxConcurrentNum,
      scoringRulesMode: editScoringRulesMode,
      customScoringTables: editScoringRulesMode === 'CUSTOM' ? editCustomScoringTables : null,
    })
    if (selectedEvent && editSignupsLocked !== selectedEvent.signupsLocked) {
      await handleSetSignupsLocked(editSignupsLocked)
    }
    setShowEditModal(false)
  }

  async function onCreateRaceSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!authHeader || !raceName) return
    try {
      await createRaceEvent(
        eventId,
        {
          name: raceName,
          trackType: raceTrackType,
          location: raceLocation,
          distanceMeters: raceDistance,
          classRestriction: null,
          grade: raceGrade || 'OP',
        },
        authHeader,
      )
      await detail.reloadCurrentEvent()
      setShowCreateRaceModal(false)
      setRaceName('')
      setRaceLocation('')
      setRaceGrade('')
      toast({ tone: 'green', title: `Successfully created race event "${raceName}".` })
    } catch (err) {
      toast({ tone: 'red', title: err instanceof Error ? err.message : 'Failed to create race' })
    }
  }

  if (loadingEventDetail) {
    return (
      <PixelCard className="bg-retro-surface">
        <div className="flex items-center gap-3 p-4 font-pixel text-xs text-retro-muted">
          <PixelSpinner size="sm" /> LOADING EVENT DETAILS...
        </div>
      </PixelCard>
    )
  }

  if (!selectedEvent) {
    return (
      <PixelCard className="bg-retro-surface p-4">
        <PixelAlert tone="red" message="Event not found or failed to load." />
        <PixelButton variant="ghost" tone="neutral" size="sm" onClick={onBack} className="mt-4">
          &lt; BACK TO EVENTS LIST
        </PixelButton>
      </PixelCard>
    )
  }

  const STATUS_OPTIONS: EventStatus[] = ['DRAFT', 'PENDING', 'ONGOING', 'CONCLUDED', 'PENDING_DELETION']
  const TAG_OPTIONS: EventTag[] = ['OFFICIAL', 'COMMUNITY']

  return (
    <PixelStack gap={6}>
      {/* Top Header Card */}
      <PixelCard className="bg-retro-surface">
        <PixelStack gap={4}>
          <PixelStack direction="row" align="center" justify="between" wrap gap={4}>
            <PixelStack gap={1}>
              <div className="flex items-center gap-2">
                <PixelButton variant="ghost" tone="neutral" size="sm" onClick={onBack}>
                  &lt; BACK
                </PixelButton>
                <h2 className="text-xl font-pixel font-bold text-retro-text truncate">
                  {selectedEvent.name}
                </h2>
              </div>
              <div className="font-pixel text-[10px] text-retro-muted">
                ID: {selectedEvent.id} | TYPE: {selectedEvent.scoringTypeLabel.toUpperCase()}
              </div>
            </PixelStack>

            <PixelStack direction="row" gap={2} align="center" wrap>
              <PixelBadge tone={selectedEvent.tag === 'OFFICIAL' ? 'purple' : 'cyan'}>
                {selectedEvent.tag || 'OFFICIAL'}
              </PixelBadge>
              <PixelBadge
                tone={
                  selectedEvent.status === 'ONGOING'
                    ? 'green'
                    : selectedEvent.status === 'CONCLUDED'
                    ? 'neutral'
                    : selectedEvent.status === 'PENDING_DELETION'
                    ? 'pink'
                    : 'cyan'
                }
              >
                {selectedEvent.status}
              </PixelBadge>
            </PixelStack>
          </PixelStack>

          {/* Controls Bar */}
          <div className="flex items-center justify-between gap-4 pt-3 border-t border-retro-border flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 font-pixel text-xs text-retro-text">
                <span>STATUS:</span>
                <select
                  disabled={eventStatusSaving}
                  value={selectedEvent.status}
                  onChange={(e) => void handleUpdateEventStatus({ status: e.target.value as any })}
                  className="px-2 py-1 bg-retro-bg border border-retro-border rounded font-sans text-xs text-retro-text"
                >
                  {STATUS_OPTIONS.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <PixelButton
                variant="ghost"
                tone={selectedEvent.signupsLocked ? 'pink' : 'purple'}
                size="sm"
                disabled={signupsLockedSaving}
                onClick={() => void handleSetSignupsLocked(!selectedEvent.signupsLocked)}
              >
                {selectedEvent.signupsLocked ? 'SIGNUPS LOCKED' : 'SIGNUPS OPEN'}
              </PixelButton>

              {selectedEvent.scoringType === 1 && (
                <PixelButton
                  variant="ghost"
                  tone="neutral"
                  size="sm"
                  onClick={() => void handleRecomputeEventPoints()}
                >
                  RECOMPUTE POINTS
                </PixelButton>
              )}
            </div>

            <div className="flex items-center gap-2">
              {selectedEvent.status === 'PENDING_DELETION' ? (
                <PixelButton variant="solid" tone="green" size="sm" onClick={() => void handleRestoreEvent()}>
                  RESTORE
                </PixelButton>
              ) : (
                <PixelButton
                  variant="ghost"
                  tone="red"
                  size="sm"
                  onClick={() => {
                    if (confirm('Move this event to Pending Deletion?')) {
                      void handleDeleteEvent(false)
                    }
                  }}
                >
                  DELETE EVENT
                </PixelButton>
              )}
            </div>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="flex items-center gap-2 border-b-2 border-retro-border pt-2">
            {[
              { id: 'details', label: 'OVERVIEW & DETAILS' },
              { id: 'members', label: `MEMBERS (${selectedEvent.members.length})` },
              { id: 'races', label: `RACES (${races.length})` },
              { id: 'datasets', label: 'DATASETS' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 font-pixel text-xs font-bold transition-colors border-b-2 -mb-[2px] ${
                  activeTab === tab.id
                    ? 'border-retro-primary text-retro-primary bg-retro-bg'
                    : 'border-transparent text-retro-muted hover:text-retro-text'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </PixelStack>
      </PixelCard>

      {globalError && <PixelAlert tone="red" message={globalError} />}
      {globalSuccess && <PixelAlert tone="green" message={globalSuccess} />}

      {/* SUB-TAB 1: OVERVIEW & DETAILS */}
      {activeTab === 'details' && (
        <PixelStack gap={6}>
          <PixelCard className="bg-retro-surface">
            <PixelStack gap={4}>
              <PixelStack direction="row" align="center" justify="between">
                <PixelSectionHeader title="EVENT INFORMATION" size="sm" />
                <PixelButton variant="solid" tone="purple" size="sm" onClick={() => setShowEditModal(true)}>
                  EDIT DETAILS
                </PixelButton>
              </PixelStack>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-sans text-xs text-retro-text">
                <div className="p-3 bg-retro-bg rounded border border-retro-border">
                  <div className="font-pixel text-[10px] text-retro-muted uppercase">SCHEDULED AT</div>
                  <div className="font-bold mt-1">
                    {selectedEvent.scheduledAt ? new Date(selectedEvent.scheduledAt).toLocaleString() : 'Unscheduled'}
                  </div>
                </div>

                <div className="p-3 bg-retro-bg rounded border border-retro-border">
                  <div className="font-pixel text-[10px] text-retro-muted uppercase">CLASS RESTRICTION</div>
                  <div className="font-bold mt-1">
                    {selectedEvent.classRestriction || 'Open to All'}
                  </div>
                </div>

                <div className="p-3 bg-retro-bg rounded border border-retro-border">
                  <div className="font-pixel text-[10px] text-retro-muted uppercase">PARTICIPATION MODEL</div>
                  <div className="font-bold mt-1">
                    {selectedEvent.granularParticipation ? 'Granular (Per-Race)' : 'Regular (Event-wide)'}
                  </div>
                </div>
              </div>

              <div className="p-4 bg-retro-bg rounded border border-retro-border">
                <div className="font-pixel text-xs text-retro-muted uppercase mb-2">DESCRIPTION</div>
                <MarkdownView
                  content={selectedEvent.description}
                  fallbackText="No description details registered for this event."
                />
              </div>
            </PixelStack>
          </PixelCard>

          {/* Standings Overview */}
          <PixelCard className="bg-retro-surface">
            <PixelStack gap={4}>
              <PixelSectionHeader title="OVERALL EVENT LEADERBOARD" size="sm" />
              {selectedEvent.scoringType === 1 ? (
                selectedEvent.pointsOverview && selectedEvent.pointsOverview.length > 0 ? (
                  <PixelTable
                    columns={[
                      { key: 'rank', header: '#', width: '10%', render: (_, idx) => idx + 1 },
                      {
                        key: 'name',
                        header: 'COMPETITOR',
                        width: '60%',
                        render: (p) => <UserLink userId={p.userId} name={p.name} />,
                      },
                      { key: 'points', header: 'POINTS', width: '30%', render: (p) => `${p.points} pts` },
                    ]}
                    data={selectedEvent.pointsOverview}
                  />
                ) : (
                  <span className="font-pixel text-xs text-retro-muted">NO POINTS STANDINGS RECORDED YET</span>
                )
              ) : (
                selectedEvent.ladderOverview && selectedEvent.ladderOverview.length > 0 ? (
                  <PixelTable
                    columns={[
                      { key: 'rank', header: 'RANK', width: '10%', render: (l) => l.rank },
                      {
                        key: 'name',
                        header: 'COMPETITOR',
                        width: '50%',
                        render: (l) => <UserLink userId={l.userId} name={l.name} />,
                      },
                      { key: 'elo', header: 'ELO', width: '20%', render: (l) => l.elo },
                      { key: 'wl', header: 'W-L', width: '20%', render: (l) => `${l.wins}W - ${l.losses}L` },
                    ]}
                    data={selectedEvent.ladderOverview}
                  />
                ) : (
                  <span className="font-pixel text-xs text-retro-muted">NO LADDER RECORDS FOUND</span>
                )
              )}
            </PixelStack>
          </PixelCard>
        </PixelStack>
      )}

      {/* SUB-TAB 2: EVENT MEMBERS */}
      {activeTab === 'members' && (
        <PixelCard className="bg-retro-surface">
          <PixelStack gap={4}>
            <PixelSectionHeader title={`EVENT MEMBERS (${selectedEvent.members.length})`} size="sm" />

            {selectedEvent.granularParticipation ? (
              <PixelAlert
                tone="cyan"
                message="Granular Per-Race Participation Enabled. In granular events, competitors enroll directly into individual races on the Races & Tracks tab. Removing a participant below will un-enroll them from all registered races and remove them from the event."
              />
            ) : (
              <div className="flex items-center gap-3 p-3 bg-retro-bg rounded border border-retro-border">
                <div className="flex-1">
                  <UserSearchCombobox value={addMemberUserId} onChange={setAddMemberUserId} />
                </div>
                <PixelButton
                  variant="solid"
                  tone="purple"
                  size="sm"
                  disabled={!addMemberUserId}
                  onClick={async () => {
                    if (!addMemberUserId || !authHeader) return
                    try {
                      await addEventMember(eventId, addMemberUserId, authHeader)
                      await detail.reloadCurrentEvent()
                      setAddMemberUserId('')
                      toast({ tone: 'green', title: 'Member enrolled in event.' })
                    } catch (err) {
                      toast({ tone: 'red', title: err instanceof Error ? err.message : 'Failed to enroll member' })
                    }
                  }}
                >
                  + ENROLL MEMBER
                </PixelButton>
              </div>
            )}

            {selectedEvent.members.length > 0 ? (
              <PixelTable
                columns={[
                  {
                    key: 'name',
                    header: 'MEMBER NAME',
                    width: '35%',
                    render: (m) => <UserLink userId={m.userId} name={m.name} />,
                  },
                  {
                    key: 'classTier',
                    header: 'CLASS TIER',
                    width: '20%',
                    render: (m) => <PixelBadge tone="neutral">{m.classTier || 'NONE'}</PixelBadge>,
                  },
                  ...(selectedEvent.granularParticipation
                    ? [
                        {
                          key: 'registeredRaces',
                          header: 'REGISTERED RACES',
                          width: '30%',
                          render: (m: eventmanager.EventMemberView) => {
                            const regRaces = (selectedEvent.raceEvents ?? []).filter((r) =>
                              (r.members ?? []).some((rm) => rm.userId === m.userId)
                            )
                            if (regRaces.length === 0) {
                              return <PixelBadge tone="neutral">NONE</PixelBadge>
                            }
                            return (
                              <div className="flex gap-1 flex-wrap">
                                {regRaces.map((r) => (
                                  <PixelBadge key={r.id} tone="purple">
                                    #{r.sequence} {r.name}
                                  </PixelBadge>
                                ))}
                              </div>
                            )
                          },
                        },
                      ]
                    : []),
                  {
                    key: 'action',
                    header: 'ACTION',
                    width: '15%',
                    render: (m) => (
                      <PixelButton
                        variant="ghost"
                        tone="red"
                        size="sm"
                        onClick={() => void handleRemoveMember(m.userId)}
                      >
                        REMOVE
                      </PixelButton>
                    ),
                  },
                ]}
                data={selectedEvent.members}
              />
            ) : (
              <span className="font-pixel text-xs text-retro-muted">NO MEMBERS ENROLLED IN THIS EVENT YET</span>
            )}
          </PixelStack>
        </PixelCard>
      )}

      {/* SUB-TAB 3: RACES & TRACKS */}
      {activeTab === 'races' && (
        <PixelStack gap={6}>
          <PixelCard className="bg-retro-surface">
            <PixelStack gap={4}>
              <PixelStack direction="row" align="center" justify="between" wrap>
                <PixelSectionHeader title={`RACE TRACKS (${races.length})`} size="sm" />
                <PixelButton variant="solid" tone="purple" size="sm" onClick={() => setShowCreateRaceModal(true)}>
                  + CREATE RACE TRACK
                </PixelButton>
              </PixelStack>

              {races.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {races.map((r) => (
                    <div
                      key={r.id}
                      className={`p-4 rounded border transition-all ${
                        selectedRaceId === r.id
                          ? 'bg-retro-bg border-retro-primary shadow'
                          : 'bg-retro-bg border-retro-border hover:border-retro-muted'
                      }`}
                    >
                      <PixelStack gap={2}>
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-pixel text-sm font-bold text-retro-text">
                            #{r.sequence}. {r.name}
                          </h4>
                          <PixelBadge tone={selectedRaceId === r.id ? 'purple' : 'neutral'}>
                            {r.trackType} ({r.distanceMeters}m)
                          </PixelBadge>
                        </div>

                        <div className="font-sans text-xs text-retro-muted">
                          LOCATION: <strong>{r.location}</strong> | GRADE: <strong>{r.grade || 'OP'}</strong>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-retro-border">
                          <PixelButton
                            variant={selectedRaceId === r.id ? 'solid' : 'ghost'}
                            tone="purple"
                            size="sm"
                            onClick={() => void handleSelectRace(r, true)}
                          >
                            {selectedRaceId === r.id ? 'MANAGING STANDINGS' : 'SELECT STANDINGS'}
                          </PixelButton>

                          {r.startsAt === null ? (
                            <PixelButton variant="ghost" tone="green" size="sm" onClick={() => void handleStartRace(r.id)}>
                              START RACE
                            </PixelButton>
                          ) : r.endsAt === null ? (
                            <PixelButton variant="ghost" tone="pink" size="sm" onClick={() => void handleEndRace(r.id)}>
                              END RACE
                            </PixelButton>
                          ) : null}

                          <PixelButton variant="ghost" tone="red" size="sm" onClick={() => void handleDeleteRace(r.id)}>
                            DELETE
                          </PixelButton>
                        </div>
                      </PixelStack>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="font-pixel text-xs text-retro-muted">NO RACE TRACKS CONSTRUCTED YET</span>
              )}
            </PixelStack>
          </PixelCard>

          {/* Selected Race Management & Standings Editor */}
          {selectedRace && (
            <PixelCard className="bg-retro-surface">
              <PixelStack gap={6}>
                {/* Race Members Section */}
                <PixelStack gap={3}>
                  <PixelSectionHeader
                    title={`RACE PARTICIPANTS (${(selectedRace.members ?? []).length}${
                      selectedRace.participantLimit !== null ? ` / ${selectedRace.participantLimit}` : ''
                    })`}
                    size="sm"
                  />
                  <div className="flex items-center gap-3 p-3 bg-retro-bg rounded border border-retro-border">
                    <div className="flex-1">
                      {selectedEvent.granularParticipation ? (
                        <UserSearchCombobox value={addRaceMemberUserId} onChange={setAddRaceMemberUserId} />
                      ) : (
                        <RaceMemberCombobox
                          value={addRaceMemberUserId}
                          onChange={setAddRaceMemberUserId}
                          members={selectedEvent.members.filter(
                            (em) => !(selectedRace.members ?? []).some((rm) => rm.userId === em.userId)
                          )}
                        />
                      )}
                    </div>
                    <PixelButton
                      variant="solid"
                      tone="purple"
                      size="sm"
                      disabled={!addRaceMemberUserId}
                      onClick={async () => {
                        if (!addRaceMemberUserId) return
                        await handleAddRaceMember(selectedRace.id, addRaceMemberUserId)
                        setAddRaceMemberUserId('')
                      }}
                    >
                      + REGISTER TO RACE
                    </PixelButton>
                  </div>

                  {(selectedRace.members ?? []).length > 0 ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {(selectedRace.members ?? []).map((m) => (
                        <div
                          key={m.userId}
                          className="flex items-center gap-2 px-3 py-1.5 bg-retro-bg border border-retro-border rounded font-pixel text-xs text-retro-text"
                        >
                          <UserLink userId={m.userId} name={m.name} />
                          <PixelButton
                            variant="ghost"
                            tone="red"
                            size="sm"
                            onClick={() => void handleRemoveRaceMember(selectedRace.id, m.userId)}
                            title="Remove competitor from race"
                          >
                            ✕
                          </PixelButton>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="font-pixel text-xs text-retro-muted">
                      NO COMPETITORS REGISTERED SPECIFICALLY FOR THIS RACE YET
                    </span>
                  )}
                </PixelStack>

                {/* Standings Grid Editor */}
                <StandingsEditor
                  variant="pixel"
                  raceName={selectedRace.name}
                  isRaceOngoing={selectedRace.startsAt !== null && selectedRace.endsAt === null}
                  isRaceNotStarted={selectedRace.startsAt === null}
                  loadingResults={loadingResults}
                  memberCount={selectedEvent.granularParticipation ? (selectedRace.members?.length || 0) : selectedEvent.members.length}
                  rows={derivedStates}
                  changeSummary={changeSummary}
                  savingBatch={savingBatch}
                  onInferTimes={() => void handleInferFinishTimes()}
                  onCancel={handleCancelStandingsEdit}
                  onSave={() => void handleUnifiedSave()}
                  onResetAll={resetStandingsDraft}
                  onResultChange={handleResultChange}
                  onTogglePendingDeletion={togglePendingDeletion}
                  onUndoRow={handleUndoRow}
                  noTopMargin
                  scoringType={selectedEvent.scoringType}
                  scoringRulesMode={selectedEvent.scoringRulesMode}
                  customScoringTables={selectedEvent.customScoringTables}
                  raceGrade={selectedRace.grade}
                />
              </PixelStack>
            </PixelCard>
          )}
        </PixelStack>
      )}

      {/* SUB-TAB 4: DATASETS */}
      {activeTab === 'datasets' && (
        <PixelCard className="bg-retro-surface">
          <PixelStack gap={4}>
            <PixelStack direction="row" align="center" justify="between">
              <PixelSectionHeader title="EVENT DATASETS" size="sm" />
              <PixelButton variant="solid" tone="purple" size="sm" onClick={() => setShowCreateDatasetModal(true)}>
                + CREATE DATASET
              </PixelButton>
            </PixelStack>

            {loadingDatasets ? (
              <div className="font-pixel text-xs text-retro-muted">LOADING DATASETS...</div>
            ) : datasets.length > 0 ? (
              <PixelTable
                columns={[
                  { key: 'id', header: 'ID', width: '20%', render: (d) => d.id },
                  { key: 'source', header: 'SOURCE', width: '30%', render: (d) => d.source },
                  { key: 'rows', header: 'ROWS', width: '15%', render: (d) => d.rows },
                  {
                    key: 'status',
                    header: 'STATUS',
                    width: '20%',
                    render: (d) => <PixelBadge tone={d.status === 'DONE' ? 'green' : 'neutral'}>{d.status}</PixelBadge>,
                  },
                  {
                    key: 'action',
                    header: 'ACTION',
                    width: '15%',
                    render: (d) =>
                      d.status !== 'DONE' ? (
                        <PixelButton
                          variant="ghost"
                          tone="green"
                          size="sm"
                          onClick={() => handleUpdateDatasetStatus(d.id, 'DONE')}
                        >
                          MARK DONE
                        </PixelButton>
                      ) : null,
                  },
                ]}
                data={datasets}
              />
            ) : (
              <span className="font-pixel text-xs text-retro-muted">NO DATASETS CREATED FOR THIS EVENT YET</span>
            )}
          </PixelStack>
        </PixelCard>
      )}

      {/* EDIT EVENT DETAILS MODAL */}
      {showEditModal && (
        <PixelModal open={showEditModal} onClose={() => setShowEditModal(false)} title="EDIT EVENT DETAILS">
          <form onSubmit={onSaveEditDetails} className="space-y-4">
            <PixelInput label="EVENT NAME" required value={editName} onChange={(e) => setEditName(e.target.value)} />

            <PixelTextarea
              label="DESCRIPTION"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={3}
            />

            <div>
              <label className="block font-pixel text-xs text-retro-text mb-1">CLASS TIER ELIGIBILITY</label>
              <select
                value={editClassRestriction}
                onChange={(e) => setEditClassRestriction(e.target.value)}
                className="w-full px-3 py-2 bg-retro-bg border-2 border-retro-border rounded font-sans text-sm text-retro-text"
              >
                <option value="">Any Tier Eligibility (None)</option>
                <option value="G3">G3</option>
                <option value="G2">G2</option>
                <option value="G1">G1</option>
              </select>
            </div>

            {selectedEvent.scoringType === 1 && (
              <div>
                <label className="block font-pixel text-xs text-retro-text mb-1">POINTS SCORING RULES MODE</label>
                <select
                  value={editScoringRulesMode}
                  onChange={(e) => setEditScoringRulesMode(e.target.value as any)}
                  className="w-full px-3 py-2 bg-retro-bg border-2 border-retro-border rounded font-sans text-sm text-retro-text"
                >
                  <option value="STANDARD">Standard Default Tables</option>
                  <option value="CUSTOM">Custom Event Tables</option>
                </select>

                {editScoringRulesMode === 'CUSTOM' && (
                  <div className="mt-3">
                    <EventScoringTablesEditor
                      value={editCustomScoringTables}
                      onChange={setEditCustomScoringTables}
                    />
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t border-retro-border">
              <PixelButton variant="ghost" tone="neutral" onClick={() => setShowEditModal(false)}>
                CANCEL
              </PixelButton>
              <PixelButton variant="solid" tone="purple" type="submit">
                SAVE CHANGES
              </PixelButton>
            </div>
          </form>
        </PixelModal>
      )}

      {/* CREATE RACE TRACK MODAL */}
      {showCreateRaceModal && (
        <PixelModal open={showCreateRaceModal} onClose={() => setShowCreateRaceModal(false)} title="CREATE RACE TRACK">
          <form onSubmit={onCreateRaceSubmit} className="space-y-4">
            <PixelInput label="RACE NAME" required value={raceName} onChange={(e) => setRaceName(e.target.value)} />

            <div className="grid grid-cols-2 gap-4">
              <PixelInput
                label="TRACK TYPE"
                required
                value={raceTrackType}
                onChange={(e) => setRaceTrackType(e.target.value)}
              />
              <PixelInput
                label="LOCATION"
                required
                value={raceLocation}
                onChange={(e) => setRaceLocation(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <PixelInput
                label="DISTANCE (METERS)"
                type="number"
                required
                value={String(raceDistance)}
                onChange={(e) => setRaceDistance(Number(e.target.value))}
              />
              <div>
                <label className="block font-pixel text-xs text-retro-text mb-1">RACE GRADE</label>
                <select
                  value={raceGrade}
                  onChange={(e) => setRaceGrade(e.target.value)}
                  className="w-full px-3 py-2 bg-retro-bg border-2 border-retro-border rounded font-sans text-sm text-retro-text"
                >
                  <option value="">-- Choose Grade --</option>
                  <option value="OP">OP</option>
                  <option value="GIII">GIII</option>
                  <option value="GII">GII</option>
                  <option value="GI">GI</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-retro-border">
              <PixelButton variant="ghost" tone="neutral" onClick={() => setShowCreateRaceModal(false)}>
                CANCEL
              </PixelButton>
              <PixelButton variant="solid" tone="purple" type="submit">
                CREATE TRACK
              </PixelButton>
            </div>
          </form>
        </PixelModal>
      )}

      {/* CREATE DATASET MODAL */}
      {showCreateDatasetModal && (
        <PixelModal open={showCreateDatasetModal} onClose={() => setShowCreateDatasetModal(false)} title="CREATE DATASET">
          <form onSubmit={handleCreateDataset} className="space-y-4">
            <PixelInput
              label="DATASET SOURCE"
              required
              value={datasetSource}
              onChange={(e) => setDatasetSource(e.target.value)}
            />
            <PixelInput
              label="ROWS COUNT"
              type="number"
              required
              value={String(datasetRows)}
              onChange={(e) => setDatasetRows(Number(e.target.value))}
            />

            <div className="flex justify-end gap-2 pt-4 border-t border-retro-border">
              <PixelButton variant="ghost" tone="neutral" onClick={() => setShowCreateDatasetModal(false)}>
                CANCEL
              </PixelButton>
              <PixelButton variant="solid" tone="purple" type="submit">
                CREATE DATASET
              </PixelButton>
            </div>
          </form>
        </PixelModal>
      )}
    </PixelStack>
  )
}
