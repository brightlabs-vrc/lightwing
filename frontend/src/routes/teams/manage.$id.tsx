import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { usePageHead } from '../../hooks/usePageHead'
import { requireAuth } from '../../lib/auth-guard'
import {
  getAdminTeam,
  listAdminTeams,
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
  listOrgClassGrades,
  updateAdminUserClass,
} from '../../lib/admin-api'
import { UserSearchCombobox } from '../../components/UserSearchCombobox'
import { RaceMemberCombobox } from '../../components/RaceDetailPane'
import { Pagination } from '../../components/Pagination'
import { UserLink } from '../../components/UserLink'
import { MarkdownView } from '../../components/MarkdownView'
import { MarkdownEditor } from '../../components/MarkdownEditor'
import { OrgNewslettersTab } from '../../components/OrgNewslettersTab'
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
import {
  PixelSkeletonDetail,
  PixelSkeletonList,
  PixelSkeletonTable,
} from '../../components/LoadingSkeleton'

export const Route = createFileRoute('/teams/manage/$id')({
  beforeLoad: async ({ location }) => {
    await requireAuth(location)
  },
  pendingComponent: () => (
    <ManagementLayout>
      <PixelContainer maxWidth="full" padding="md">
        <PixelSkeletonDetail />
      </PixelContainer>
    </ManagementLayout>
  ),
  component: ManageOrgPage,
})

type TabType = 'overview' | 'events' | 'approvals' | 'newsletters'

function ManageOrgPage() {
  const { id: teamId } = Route.useParams()
  const { session, signOutUser } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState<TabType>('overview')

  const [team, setTeam] = useState<teammanager.Team | null>(null)

  usePageHead({
    title: team ? `${team.name} - Management` : 'Management',
    description: 'Manage organization and team details on UmaKeiba.',
  })
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
  const [loadingRoster, setLoadingRoster] = useState(true)
  const [memberPage, setMemberPage] = useState(1)
  const [memberPageSize, setMemberPageSize] = useState(10)
  const [memberSearch, setMemberSearch] = useState('')

  // Org Class Grades state
  const [classGrades, setClassGrades] = useState<eventmanager.OrgClassEntry[]>([])
  const [totalClassGrades, setTotalClassGrades] = useState(0)
  const [loadingGrades, setLoadingGrades] = useState(true)
  const [gradePage, setGradePage] = useState(1)
  const [gradePageSize, setGradePageSize] = useState(10)
  const [gradeSearch, setGradeSearch] = useState('')
  const [newGradeUserId, setNewGradeUserId] = useState('')
  const [newGradeTier, setNewGradeTier] = useState<ClassTier>('G3')
  const [savingGrade, setSavingGrade] = useState(false)

  // Events state
  const [events, setEvents] = useState<eventmanager.EventListItem[]>([])
  const [loadingEvents, setLoadingEvents] = useState(false)
  const [selectedManagedEventId, setSelectedManagedEventId] = useState<string | null>(null)

  // Applications state
  const [applications, setApplications] = useState<teammanager.TeamApplicationView[]>([])
  const [loadingApplications, setLoadingApplications] = useState(false)

  // Modals / Inline Editors state
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
  const [eventBannerUrl, setEventBannerUrl] = useState('')
  const eventTag: EventTag = 'OFFICIAL'
  const [eventScoringType, setEventScoringType] = useState<number>(1)
  const [eventClassRestriction, setEventClassRestriction] = useState<string>('')
  const [eventGranular, setEventGranular] = useState(true)
  const [eventScheduledAt, setEventScheduledAt] = useState('')
  const [eventParticipantLimit, setEventParticipantLimit] = useState('')
  const [eventMaxConcurrent, setEventMaxConcurrent] = useState('')
  const [eventIsTeamEvent, setEventIsTeamEvent] = useState(false)
  const [eventMaxPrimaryRosterSize, setEventMaxPrimaryRosterSize] = useState('')
  const [eventMaxBackupRosterSize, setEventMaxBackupRosterSize] = useState('')
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
    setLoadingRoster(true)
    try {
      const offset = (memberPage - 1) * memberPageSize
      const response = await listAdminTeamMembers(teamId, memberSearch, memberPageSize, offset)
      setMembers(response.members)
      setTotalMembers(response.total)
    } catch (cause) {
      console.error('Failed to load roster', cause)
    } finally {
      setLoadingRoster(false)
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

  async function fetchClassGrades() {
    if (!isOrg) {
      setLoadingGrades(false)
      return
    }
    setLoadingGrades(true)
    try {
      const offset = (gradePage - 1) * gradePageSize
      const response = await listOrgClassGrades(teamId, gradeSearch, gradePageSize, offset)
      setClassGrades(response.entries)
      setTotalClassGrades(response.total)
    } catch (cause) {
      console.error('Failed to load org class grades', cause)
    } finally {
      setLoadingGrades(false)
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
      if (isOrg) {
        void fetchClassGrades()
      }
    } else if (activeTab === 'events' && isOrg) {
      void fetchOrgEvents()
    } else if (activeTab === 'approvals' && isOrg) {
      void fetchApplications()
    }
  }, [teamId, activeTab, memberPage, memberPageSize, memberSearch, gradePage, gradePageSize, gradeSearch, isOrg])

  async function handleUpdateTeam(evt: React.FormEvent) {
    evt.preventDefault()
    if (!authHeader) return

    setUpdatingTeam(true)
    setTeamError(null)
    try {
      const payload = {
        name: teamName.trim() || undefined,
        slug: teamSlug.trim() || undefined,
        logo: teamLogo.trim() || null,
        clearLogo: !teamLogo.trim(),
        description: teamDescription.trim() || null,
        clearDescription: !teamDescription.trim(),
      }
      const targetId = team?.id || teamId
      let updated: teammanager.Team
      if (isOrg) {
        try {
          await updateAdminOrganization(targetId, payload, authHeader)
          updated = await getAdminTeam(targetId)
        } catch {
          updated = await updateAdminTeam(targetId, payload, authHeader)
        }
      } else {
        updated = await updateAdminTeam(targetId, payload, authHeader)
      }

      setTeam(updated)
      setTeamName(updated.name || '')
      setTeamSlug(updated.slug || '')
      setTeamLogo(updated.logo || '')
      setTeamDescription(updated.description || '')
      setIsTeamModalOpen(false)
      const msg = isOrg
        ? 'Organization details updated successfully.'
        : 'Team details updated successfully.'
      setSuccess(msg)
      toast({ tone: 'green', title: msg })
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
      const maxPrimaryNum = eventMaxPrimaryRosterSize.trim() ? Number(eventMaxPrimaryRosterSize) : null
      const maxBackupNum = eventMaxBackupRosterSize.trim() ? Number(eventMaxBackupRosterSize) : null

      if (eventIsTeamEvent && maxPrimaryNum !== null && (isNaN(maxPrimaryNum) || !Number.isSafeInteger(maxPrimaryNum) || maxPrimaryNum <= 0)) {
        setEventError('Max primary roster size must be a positive whole number.')
        setCreatingEvent(false)
        return
      }
      if (eventIsTeamEvent && maxBackupNum !== null && (isNaN(maxBackupNum) || !Number.isSafeInteger(maxBackupNum) || maxBackupNum < 0)) {
        setEventError('Max backup roster size must be 0 or a positive whole number.')
        setCreatingEvent(false)
        return
      }

      await createAdminEvent(
        {
          name: eventName,
          description: eventDescription || null,
          bannerUrl: eventBannerUrl.trim() || null,
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
          isTeamEvent: eventIsTeamEvent,
          maxPrimaryRosterSize: eventIsTeamEvent ? maxPrimaryNum : null,
          maxBackupRosterSize: eventIsTeamEvent ? maxBackupNum : null,
        },
        authHeader
      )
      setIsCreateEventModalOpen(false)
      setEventName('')
      setEventDescription('')
      setEventBannerUrl('')
      setEventClassRestriction('')
      setEventScheduledAt('')
      setEventParticipantLimit('')
      setEventMaxConcurrent('')
      setEventIsTeamEvent(false)
      setEventMaxPrimaryRosterSize('')
      setEventMaxBackupRosterSize('')
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
      <PixelContainer maxWidth="full" padding="none" className="max-w-7xl mx-auto">
        {loading ? (
          <PixelSkeletonDetail />
        ) : isTeamModalOpen && team ? (
          <PixelStack gap={6}>
            <PixelCard className="bg-retro-surface border-2 border-retro-border-strong">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <PixelSectionHeader
                  title={isOrg ? 'EDIT ORGANIZATION PROFILE' : 'EDIT TEAM PROFILE'}
                  titleTone="purple"
                  size="sm"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <PixelButton
                    variant="outline"
                    tone="cyan"
                    size="sm"
                    asChild
                  >
                    <Link to="/$user" params={{ user: team.slug || team.id }}>
                      VIEW PUBLIC PAGE →
                    </Link>
                  </PixelButton>
                  <PixelButton
                    variant="ghost"
                    tone="neutral"
                    size="sm"
                    onClick={() => setIsTeamModalOpen(false)}
                  >
                    ← BACK TO OVERVIEW
                  </PixelButton>
                </div>
              </div>
            </PixelCard>

            {teamError && <PixelAlert tone="red" message={teamError} />}

            <form onSubmit={handleUpdateTeam} className="flex flex-col gap-6">
              {/* Identity & Branding + Live Preview */}
              <PixelCard className="bg-retro-surface border-2 border-retro-border-strong">
                <PixelStack gap={4}>
                  <PixelSectionHeader title="IDENTITY & BRANDING" titleTone="cyan" size="sm" />

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 flex flex-col gap-4">
                      <PixelInput
                        label="NAME *"
                        required
                        value={teamName}
                        onChange={(e) => setTeamName(e.target.value)}
                      />

                      <PixelInput
                        label="CUSTOM @SLUG *"
                        required
                        hint={`Public URL: /@${teamSlug.trim() || 'slug'}`}
                        value={teamSlug}
                        onChange={(e) => setTeamSlug(e.target.value)}
                      />

                      <PixelInput
                        label="LOGO IMAGE URL"
                        type="url"
                        placeholder="https://example.com/logo.png"
                        value={teamLogo}
                        onChange={(e) => setTeamLogo(e.target.value)}
                      />
                    </div>

                    {/* Live Branding Preview */}
                    <div className="flex flex-col gap-2">
                      <span className="font-pixel text-[11px] text-retro-muted uppercase tracking-wider">
                        LIVE HEADER PREVIEW
                      </span>
                      <div className="flex-1 p-4 rounded border-2 border-retro-border bg-retro-bg flex flex-col justify-center gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {teamLogo.trim() ? (
                            <img
                              src={teamLogo.trim()}
                              alt={teamName || 'Logo preview'}
                              className="w-14 h-14 rounded border-2 border-retro-border bg-retro-surface object-cover shrink-0"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none'
                              }}
                            />
                          ) : (
                            <div className="w-14 h-14 rounded border-2 border-retro-border bg-retro-primary/20 text-retro-primary font-pixel text-lg font-bold flex items-center justify-center shrink-0">
                              {(teamName || 'OR').slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="font-pixel text-sm font-bold text-retro-text truncate">
                              {teamName.trim() || 'Entity Name'}
                            </div>
                            <div className="font-sans text-xs text-retro-muted font-semibold truncate">
                              @{teamSlug.trim() || 'slug'}
                            </div>
                          </div>
                        </div>
                        <div className="pt-2 border-t border-retro-border flex items-center gap-2">
                          <PixelBadge tone={isOrg ? 'purple' : 'cyan'}>
                            {isOrg ? 'ORGANIZATION' : 'TEAM'}
                          </PixelBadge>
                        </div>
                      </div>
                    </div>
                  </div>
                </PixelStack>
              </PixelCard>

              {/* Description Editor */}
              <PixelCard className="bg-retro-surface border-2 border-retro-border-strong">
                <PixelStack gap={4}>
                  <PixelSectionHeader
                    title="DESCRIPTION"
                    titleTone="purple"
                    size="sm"
                  />
                  <MarkdownEditor
                    value={teamDescription}
                    onChange={setTeamDescription}
                    minHeight="340px"
                    defaultMode="split"
                    placeholder="Describe your organization or team..."
                    previewFallbackText="No description details set yet."
                  />

                  <div className="flex flex-wrap justify-end gap-3 pt-4 border-t border-retro-border">
                    <PixelButton
                      type="button"
                      variant="ghost"
                      tone="neutral"
                      disabled={updatingTeam}
                      onClick={() => setIsTeamModalOpen(false)}
                    >
                      CANCEL
                    </PixelButton>
                    <PixelButton
                      variant="solid"
                      tone="purple"
                      type="submit"
                      loading={updatingTeam}
                      disabled={updatingTeam}
                    >
                      {updatingTeam ? 'SAVING...' : 'SAVE CHANGES'}
                    </PixelButton>
                  </div>
                </PixelStack>
              </PixelCard>
            </form>
          </PixelStack>
        ) : (
        <PixelStack gap={6}>
          {/* Header Card & Navigation Tabs */}
          <PixelCard className="bg-retro-surface">
            <PixelStack gap={4}>
              <PixelStack direction="row" gap={4} align="center" justify="between" wrap>
                <PixelStack gap={1} className="min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-xl sm:text-2xl font-pixel text-retro-text font-bold break-words">
                      {team ? team.name.toUpperCase() : 'MANAGEMENT CONSOLE'}
                    </h1>
                    {team && (
                      <PixelBadge tone="purple">
                        {isOrg ? 'ORGANIZATION' : 'TEAM'}
                      </PixelBadge>
                    )}
                  </div>
                  {team && (
                    <div className="text-xs font-pixel text-retro-muted break-all">
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

              {/* Management Tabs (Horizontally scrollable on mobile) */}
              <div className="flex items-center gap-2 border-b-2 border-retro-border pt-2 overflow-x-auto no-scrollbar whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => setActiveTab('overview')}
                  className={`px-3 sm:px-4 py-2 font-pixel text-xs font-bold transition-colors border-b-2 -mb-[2px] shrink-0 ${
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
                      className={`px-3 sm:px-4 py-2 font-pixel text-xs font-bold transition-colors border-b-2 -mb-[2px] shrink-0 ${
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
                      className={`px-3 sm:px-4 py-2 font-pixel text-xs font-bold transition-colors border-b-2 -mb-[2px] shrink-0 ${
                        activeTab === 'approvals'
                          ? 'border-retro-primary text-retro-primary bg-retro-bg'
                          : 'border-transparent text-retro-muted hover:text-retro-text'
                      }`}
                    >
                      TEAM APPROVALS {applications.length > 0 ? `(${applications.length})` : ''}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('newsletters')}
                      className={`px-3 sm:px-4 py-2 font-pixel text-xs font-bold transition-colors border-b-2 -mb-[2px] shrink-0 ${
                        activeTab === 'newsletters'
                          ? 'border-retro-primary text-retro-primary bg-retro-bg'
                          : 'border-transparent text-retro-muted hover:text-retro-text'
                      }`}
                    >
                      NEWSLETTERS
                    </button>
                  </>
                )}
              </div>
            </PixelStack>
          </PixelCard>

          {error && <PixelAlert tone="red" message={error} />}
          {success && <PixelAlert tone="green" message={success} />}

          {team ? (
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
                            className="px-3 py-1 bg-retro-bg border border-retro-border rounded font-sans text-xs text-retro-text focus:outline-none focus:border-retro-primary w-full sm:w-48"
                          />
                        </PixelStack>

                        {loadingRoster ? (
                          <PixelSkeletonTable rows={5} />
                        ) : members.length > 0 ? (
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

                    {isOrg && (
                      <PixelCard className="bg-retro-surface mt-6">
                        <PixelStack gap={4}>
                          <PixelStack direction="row" align="center" justify="between" wrap>
                            <PixelSectionHeader title={`PARTICIPANT CLASS GRADES (${totalClassGrades})`} size="sm" />
                            <input
                              type="text"
                              placeholder="Search participant or @username..."
                              value={gradeSearch}
                              onChange={(e) => {
                                setGradeSearch(e.target.value)
                                setGradePage(1)
                              }}
                              className="px-3 py-1 bg-retro-bg border border-retro-border rounded font-sans text-xs text-retro-text focus:outline-none focus:border-retro-primary w-full sm:w-56"
                            />
                          </PixelStack>

                          <div className="flex flex-wrap gap-2 items-center">
                            <div className="flex-1 min-w-[200px]">
                              <UserSearchCombobox
                                value={newGradeUserId}
                                onChange={setNewGradeUserId}
                                placeholder="Search participant by name, @username or email..."
                              />
                            </div>
                            <select
                              value={newGradeTier}
                              onChange={(e) => setNewGradeTier(e.target.value as ClassTier)}
                              className="px-2.5 py-1.5 bg-retro-bg border-2 border-retro-border rounded text-xs text-retro-text font-sans"
                            >
                              <option value="G3">G3</option>
                              <option value="G2">G2</option>
                              <option value="G1">G1</option>
                            </select>
                            <PixelButton
                              variant="solid"
                              tone="purple"
                              size="sm"
                              disabled={!newGradeUserId || savingGrade}
                              onClick={async () => {
                                if (!newGradeUserId || !authHeader) return
                                setSavingGrade(true)
                                try {
                                  await updateAdminUserClass(newGradeUserId, teamId, newGradeTier, authHeader)
                                  setNewGradeUserId('')
                                  const offset = (gradePage - 1) * gradePageSize
                                  const res = await listOrgClassGrades(teamId, gradeSearch, gradePageSize, offset)
                                  setClassGrades(res.entries)
                                  setTotalClassGrades(res.total)
                                  toast({ tone: 'green', title: 'Assigned organization class grade.' })
                                } catch (err) {
                                  toast({ tone: 'red', title: err instanceof Error ? err.message : 'Failed to assign class grade' })
                                } finally {
                                  setSavingGrade(false)
                                }
                              }}
                            >
                              ASSIGN GRADE
                            </PixelButton>
                          </div>

                          {loadingGrades ? (
                            <PixelSkeletonTable rows={4} />
                          ) : classGrades.length > 0 ? (
                            <>
                              <div className="public-table">
                                <PixelTable
                                  columns={[
                                    {
                                      key: 'name',
                                      header: 'PARTICIPANT',
                                      width: '45%',
                                      render: (cg: eventmanager.OrgClassEntry) => (
                                        <div>
                                          <UserLink userId={cg.userId} name={cg.name} slug={cg.slug} />
                                          {cg.slug && (
                                            <div className="font-sans text-xs text-retro-muted">@{cg.slug}</div>
                                          )}
                                        </div>
                                      ),
                                    },
                                    {
                                      key: 'classTier',
                                      header: 'CLASS GRADE',
                                      width: '30%',
                                      render: (cg: eventmanager.OrgClassEntry) => (
                                        <select
                                          value={cg.classTier || ''}
                                          disabled={savingGrade}
                                          onChange={async (e) => {
                                            if (!authHeader) return
                                            const v = e.target.value as ClassTier | ''
                                            setSavingGrade(true)
                                            try {
                                              await updateAdminUserClass(cg.userId, teamId, v === '' ? null : v, authHeader)
                                              const offset = (gradePage - 1) * gradePageSize
                                              const res = await listOrgClassGrades(teamId, gradeSearch, gradePageSize, offset)
                                              setClassGrades(res.entries)
                                              setTotalClassGrades(res.total)
                                              toast({ tone: 'green', title: v ? 'Updated class grade.' : 'Cleared class grade.' })
                                            } catch (err) {
                                              toast({ tone: 'red', title: err instanceof Error ? err.message : 'Failed to update class grade' })
                                            } finally {
                                              setSavingGrade(false)
                                            }
                                          }}
                                          className="px-2 py-1 bg-retro-bg border border-retro-border rounded text-xs text-retro-text font-sans"
                                        >
                                          <option value="">OPEN (Clear)</option>
                                          <option value="G3">G3</option>
                                          <option value="G2">G2</option>
                                          <option value="G1">G1</option>
                                        </select>
                                      ),
                                    },
                                    {
                                      key: 'action',
                                      header: 'ACTION',
                                      width: '25%',
                                      render: (cg: eventmanager.OrgClassEntry) => (
                                        <PixelButton
                                          variant="ghost"
                                          tone="red"
                                          size="sm"
                                          disabled={savingGrade}
                                          onClick={async () => {
                                            if (!authHeader) return
                                            setSavingGrade(true)
                                            try {
                                              await updateAdminUserClass(cg.userId, teamId, null, authHeader)
                                              const offset = (gradePage - 1) * gradePageSize
                                              const res = await listOrgClassGrades(teamId, gradeSearch, gradePageSize, offset)
                                              setClassGrades(res.entries)
                                              setTotalClassGrades(res.total)
                                              toast({ tone: 'green', title: 'Cleared class grade.' })
                                            } catch (err) {
                                              toast({ tone: 'red', title: err instanceof Error ? err.message : 'Failed to clear class grade' })
                                            } finally {
                                              setSavingGrade(false)
                                            }
                                          }}
                                        >
                                          CLEAR
                                        </PixelButton>
                                      ),
                                    },
                                  ]}
                                  data={classGrades}
                                  emptyState={<span className="font-pixel text-xs text-retro-muted">NO CLASS GRADES ASSIGNED</span>}
                                />
                              </div>

                              <Pagination
                                page={gradePage}
                                pageSize={gradePageSize}
                                total={totalClassGrades}
                                onPageChange={setGradePage}
                                onPageSizeChange={setGradePageSize}
                                variant="pixel"
                              />
                            </>
                          ) : (
                            <span className="font-pixel text-xs text-retro-muted">
                              NO ORGANIZATION-SCOPED CLASS GRADES ASSIGNED YET.
                            </span>
                          )}
                        </PixelStack>
                      </PixelCard>
                    )}
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
                        <PixelSkeletonList count={2} />
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
                      <PixelSkeletonList count={2} />
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

              {/* TAB 4: NEWSLETTERS */}
              {activeTab === 'newsletters' && isOrg && (
                <OrgNewslettersTab organizationId={team.id} organization={team} />
              )}
            </>
          ) : null}

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

                <PixelInput
                  label="BANNER IMAGE URL (OPTIONAL)"
                  type="url"
                  value={eventBannerUrl}
                  onChange={(e) => setEventBannerUrl(e.target.value)}
                  placeholder="https://example.com/event-banner.png"
                />

                <MarkdownEditor
                  label="DESCRIPTION"
                  value={eventDescription}
                  onChange={setEventDescription}
                  minHeight="180px"
                  defaultMode="write"
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
                    id="is-team-event"
                    checked={eventIsTeamEvent}
                    onChange={(e) => {
                      setEventIsTeamEvent(e.target.checked)
                      if (!e.target.checked) {
                        setEventMaxPrimaryRosterSize('')
                        setEventMaxBackupRosterSize('')
                      }
                    }}
                    className="w-4 h-4 accent-retro-primary"
                  />
                  <label htmlFor="is-team-event" className="font-pixel text-xs text-retro-text cursor-pointer">
                    Team-Based Event (Primary &amp; Backup Rosters + Team Standings)
                  </label>
                </div>

                {eventIsTeamEvent && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <PixelInput
                      label="MAX PRIMARY ROSTER (PER TEAM)"
                      type="number"
                      placeholder="e.g. 3 (blank = unlimited)"
                      value={eventMaxPrimaryRosterSize}
                      onChange={(e) => setEventMaxPrimaryRosterSize(e.target.value)}
                    />
                    <PixelInput
                      label="MAX BACKUP ROSTER (PER TEAM)"
                      type="number"
                      placeholder="e.g. 2 (blank = unlimited)"
                      value={eventMaxBackupRosterSize}
                      onChange={(e) => setEventMaxBackupRosterSize(e.target.value)}
                    />
                  </div>
                )}

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
                    label={eventIsTeamEvent ? 'TEAM LIMIT' : 'PARTICIPANT LIMIT'}
                    type="number"
                    placeholder={eventIsTeamEvent ? 'e.g. 12 teams' : 'e.g. 20'}
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
        )}
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
    results,
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
    handleUpsertEventTeamRoster,
    handleSubstituteTeamMember,
    handleRemoveEventTeam,
    handleAddRaceMember,
    handleRemoveRaceMember,
    handleCreateRace,
    handleStartRace,
    handleEndRace,
    handleUpdateRace,
    handleDeleteRace,
    handleSelectRace,
    handleResultChange,
    togglePendingDeletion,
    handleUndoRow,
    resetStandingsDraft,
    handleInferFinishTimes,
    handleCancelStandingsEdit,
    handleUnifiedSave,
    handleReorderRaces,
  } = detail

  // Edit Event Modal State
  const [showEditModal, setShowEditModal] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editBannerUrl, setEditBannerUrl] = useState('')
  const [editClassRestriction, setEditClassRestriction] = useState('')
  const [editScheduledAt, setEditScheduledAt] = useState('')
  const [editParticipantLimit, setEditParticipantLimit] = useState('')
  const [editMaxConcurrent, setEditMaxConcurrent] = useState('')
  const [editMaxPrimaryRosterSize, setEditMaxPrimaryRosterSize] = useState('')
  const [editMaxBackupRosterSize, setEditMaxBackupRosterSize] = useState('')
  const [editSignupsLocked, setEditSignupsLocked] = useState(false)
  const [editScoringRulesMode, setEditScoringRulesMode] = useState<'STANDARD' | 'CUSTOM'>('STANDARD')
  const [editCustomScoringTables, setEditCustomScoringTables] = useState<Record<string, Record<number, number>>>(DEFAULT_SCORING_TABLES)
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  // Member Add State
  const [addMemberUserId, setAddMemberUserId] = useState('')

  // Team Event Roster Management State
  const [availableTeams, setAvailableTeams] = useState<teammanager.TeamListItem[]>([])
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [selectedTeamDetail, setSelectedTeamDetail] = useState<teammanager.Team | null>(null)
  const [loadingTeamDetail, setLoadingTeamDetail] = useState(false)
  const [primaryUserIds, setPrimaryUserIds] = useState<string[]>([])
  const [backupUserIds, setBackupUserIds] = useState<string[]>([])
  const [savingTeamRoster, setSavingTeamRoster] = useState(false)
  const [teamRosterError, setTeamRosterError] = useState<string | null>(null)
  const [subSwapTargets, setSubSwapTargets] = useState<Record<string, string>>({})
  const [subReplaceUpcoming, setSubReplaceUpcoming] = useState<Record<string, boolean>>({})

  // Create Race Modal State
  const [showCreateRaceModal, setShowCreateRaceModal] = useState(false)
  const [raceName, setRaceName] = useState('')
  const [raceTrackType, setRaceTrackType] = useState('Turf')
  const [raceLocation, setRaceLocation] = useState('')
  const [raceDistance, setRaceDistance] = useState(1200)
  const [raceGrade, setRaceGrade] = useState('')

  // Edit Race Modal State
  const [showEditRaceModal, setShowEditRaceModal] = useState(false)
  const [editingRace, setEditingRace] = useState<eventmanager.RaceEventDetail | null>(null)
  const [raceEditName, setRaceEditName] = useState('')
  const [raceEditLocation, setRaceEditLocation] = useState('')
  const [raceEditDistance, setRaceEditDistance] = useState(1200)
  const [raceEditTrackType, setRaceEditTrackType] = useState('Turf')
  const [raceEditClassRestriction, setRaceEditClassRestriction] = useState<string>('')
  const [raceEditGrade, setRaceEditGrade] = useState<string>('')
  const [raceEditParticipantLimit, setRaceEditParticipantLimit] = useState<string>('')
  const [raceEditError, setRaceEditError] = useState<string | null>(null)
  const [showRaceGradeConfirm, setShowRaceGradeConfirm] = useState(false)

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
      setEditBannerUrl(selectedEvent.bannerUrl ?? '')
      setEditClassRestriction(selectedEvent.classRestriction ?? '')
      setEditScheduledAt(selectedEvent.scheduledAt ? toLocalISOString(selectedEvent.scheduledAt) : '')
      setEditParticipantLimit(selectedEvent.participantLimit !== null ? String(selectedEvent.participantLimit) : '')
      setEditMaxConcurrent(selectedEvent.maxConcurrentRaceParticipations !== null ? String(selectedEvent.maxConcurrentRaceParticipations) : '')
      setEditMaxPrimaryRosterSize(selectedEvent.maxPrimaryRosterSize !== null ? String(selectedEvent.maxPrimaryRosterSize) : '')
      setEditMaxBackupRosterSize(selectedEvent.maxBackupRosterSize !== null ? String(selectedEvent.maxBackupRosterSize) : '')
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
    if (!selectedEvent?.isTeamEvent || activeTab !== 'members') return
    let cancelled = false
    void listAdminTeams('', 200, 0)
      .then((res) => {
        if (!cancelled) {
          setAvailableTeams((res.teams ?? []).filter((t) => t.status === 'APPROVED'))
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [selectedEvent?.isTeamEvent, activeTab])

  useEffect(() => {
    if (!selectedEvent?.isTeamEvent || !selectedTeamId) {
      setSelectedTeamDetail(null)
      return
    }
    let cancelled = false
    setLoadingTeamDetail(true)
    setTeamRosterError(null)
    void getAdminTeam(selectedTeamId)
      .then((t) => {
        if (cancelled) return
        setSelectedTeamDetail(t)
        const existing = (selectedEvent.teams ?? []).find((et) => et.teamId === selectedTeamId)
        if (existing) {
          setPrimaryUserIds((existing.primaryRoster ?? []).map((m) => m.userId))
          setBackupUserIds((existing.backupRoster ?? []).map((m) => m.userId))
        } else {
          setPrimaryUserIds([])
          setBackupUserIds([])
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setSelectedTeamDetail(null)
          setTeamRosterError(err instanceof Error ? err.message : 'Unable to load team members.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingTeamDetail(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedEvent?.isTeamEvent, selectedEvent?.teams, selectedTeamId])

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

  const performSaveEventDetails = async () => {
    const limitNum = editParticipantLimit.trim() ? Number(editParticipantLimit) : null
    const maxConcurrentNum = editMaxConcurrent.trim() ? Number(editMaxConcurrent) : null
    const maxPrimaryNum = editMaxPrimaryRosterSize.trim() ? Number(editMaxPrimaryRosterSize) : null
    const maxBackupNum = editMaxBackupRosterSize.trim() ? Number(editMaxBackupRosterSize) : null

    if (!selectedEvent?.granularParticipation && limitNum !== null && (isNaN(limitNum) || !Number.isSafeInteger(limitNum) || limitNum <= 0)) {
      alert(selectedEvent?.isTeamEvent ? 'Team limit must be a positive whole number.' : 'Participant limit must be a positive whole number.')
      return
    }

    if (selectedEvent?.granularParticipation && maxConcurrentNum !== null && (isNaN(maxConcurrentNum) || !Number.isSafeInteger(maxConcurrentNum) || maxConcurrentNum <= 0)) {
      alert('Max races per participant must be a positive whole number.')
      return
    }

    if (selectedEvent?.isTeamEvent && maxPrimaryNum !== null && (isNaN(maxPrimaryNum) || !Number.isSafeInteger(maxPrimaryNum) || maxPrimaryNum <= 0)) {
      alert('Max primary roster size must be a positive whole number.')
      return
    }

    if (selectedEvent?.isTeamEvent && maxBackupNum !== null && (isNaN(maxBackupNum) || !Number.isSafeInteger(maxBackupNum) || maxBackupNum < 0)) {
      alert('Max backup roster size must be 0 or a positive whole number.')
      return
    }

    await handleUpdateEventDetails({
      name: editName,
      description: editDescription || null,
      bannerUrl: editBannerUrl.trim() || null,
      classRestriction: (editClassRestriction as any) || null,
      scheduledAt: editScheduledAt ? new Date(editScheduledAt).toISOString() : null,
      participantLimit: limitNum,
      maxConcurrentRaceParticipations: maxConcurrentNum,
      maxPrimaryRosterSize: selectedEvent?.isTeamEvent ? maxPrimaryNum : null,
      maxBackupRosterSize: selectedEvent?.isTeamEvent ? maxBackupNum : null,
      scoringRulesMode: editScoringRulesMode,
      customScoringTables: editScoringRulesMode === 'CUSTOM' ? editCustomScoringTables : null,
    })
    if (selectedEvent && editSignupsLocked !== selectedEvent.signupsLocked) {
      await handleSetSignupsLocked(editSignupsLocked)
    }
    setShowEditModal(false)
  }

  async function onSaveEditDetails(e: React.FormEvent) {
    e.preventDefault()

    // Validation for custom scoring rules
    if (selectedEvent && selectedEvent.scoringType === 1 && editScoringRulesMode === 'CUSTOM') {
      const grades = ['OP', 'GIII', 'GII', 'GI']
      for (const grade of grades) {
        const table = editCustomScoringTables[grade]
        if (!table) {
          alert(`Custom table for grade ${grade} is missing.`)
          return
        }
        for (let pos = 1; pos <= 10; pos++) {
          const val = table[pos]
          if (val === undefined || val === null || String(val).trim() === '') {
            alert(`Custom table for grade ${grade} is missing value for position #${pos}.`)
            return
          }
          const num = Number(val)
          if (!Number.isInteger(num) || num < 0) {
            alert(`Custom table for grade ${grade}, position #${pos} must be a valid non-negative integer.`)
            return
          }
        }
      }
    }

    const scoringRulesChanged = selectedEvent && selectedEvent.scoringType === 1 && (
      selectedEvent.scoringRulesMode !== editScoringRulesMode ||
      (editScoringRulesMode === 'CUSTOM' && JSON.stringify(selectedEvent.customScoringTables) !== JSON.stringify(editCustomScoringTables))
    )

    if (scoringRulesChanged) {
      setShowConfirmModal(true)
    } else {
      await performSaveEventDetails()
    }
  }

  function handleOpenEditRaceModal(race: eventmanager.RaceEventDetail) {
    setEditingRace(race)
    setRaceEditName(race.name)
    setRaceEditLocation(race.location)
    setRaceEditDistance(race.distanceMeters)
    setRaceEditTrackType(race.trackType)
    setRaceEditClassRestriction(race.classRestriction || '')
    setRaceEditGrade(race.grade || '')
    setRaceEditParticipantLimit(race.participantLimit !== null ? String(race.participantLimit) : '')
    setRaceEditError(null)
    setShowEditRaceModal(true)
  }

  const performSaveRaceDetails = async () => {
    if (!editingRace) return
    const limitNum = raceEditParticipantLimit.trim() ? Number(raceEditParticipantLimit) : null
    if (limitNum !== null && (isNaN(limitNum) || !Number.isSafeInteger(limitNum) || limitNum <= 0)) {
      setRaceEditError('Race participant limit must be a positive whole number.')
      return
    }

    await handleUpdateRace(editingRace.id, {
      name: raceEditName.trim(),
      location: raceEditLocation.trim(),
      distanceMeters: raceEditDistance,
      trackType: raceEditTrackType.trim(),
      classRestriction: (raceEditClassRestriction as any) || null,
      grade: raceEditGrade || null,
      participantLimit: limitNum,
    })
    setShowEditRaceModal(false)
    setEditingRace(null)
    toast({ tone: 'green', title: 'Race details updated successfully.' })
  }

  async function onEditRaceSubmit(e: React.FormEvent) {
    e.preventDefault()
    setRaceEditError(null)

    if (!raceEditName.trim()) {
      setRaceEditError('Race name is required.')
      return
    }
    if (!raceEditLocation.trim()) {
      setRaceEditError('Location is required.')
      return
    }
    if (!raceEditTrackType.trim()) {
      setRaceEditError('Track Type is required.')
      return
    }
    if (!Number.isInteger(raceEditDistance) || raceEditDistance <= 0) {
      setRaceEditError('Distance must be a valid integer greater than 0.')
      return
    }

    const hasResults = results && results.length > 0
    const gradeChanged = editingRace && editingRace.grade !== raceEditGrade
    const isPointsBased = selectedEvent && selectedEvent.scoringType === 1

    if (isPointsBased && hasResults && gradeChanged) {
      setShowRaceGradeConfirm(true)
    } else {
      await performSaveRaceDetails()
    }
  }

  async function handleMoveRace(raceIndex: number, direction: 'up' | 'down') {
    const targetIndex = direction === 'up' ? raceIndex - 1 : raceIndex + 1
    if (targetIndex < 0 || targetIndex >= races.length) return

    const reordered = [...races]
    const [moved] = reordered.splice(raceIndex, 1)
    reordered.splice(targetIndex, 0, moved)

    const reorderedIds = reordered.map((r) => r.id)
    await handleReorderRaces(reorderedIds)
    toast({ tone: 'green', title: 'Race sequence updated.' })
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
          <div className="flex items-center gap-2 border-b-2 border-retro-border pt-2 overflow-x-auto no-scrollbar whitespace-nowrap">
            {[
              { id: 'details', label: 'OVERVIEW & DETAILS' },
              {
                id: 'members',
                label: selectedEvent.isTeamEvent
                  ? `TEAMS & ROSTERS (${(selectedEvent.teams ?? []).length})`
                  : `MEMBERS (${selectedEvent.members.length})`,
              },
              { id: 'races', label: `RACES (${races.length})` },
              { id: 'datasets', label: 'DATASETS' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 sm:px-4 py-2 font-pixel text-xs font-bold transition-colors border-b-2 -mb-[2px] shrink-0 ${
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

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 font-sans text-xs text-retro-text">
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

                <div className="p-3 bg-retro-bg rounded border border-retro-border">
                  <div className="font-pixel text-[10px] text-retro-muted uppercase">COMPETITION FORMAT</div>
                  <div className="font-bold mt-1">
                    {selectedEvent.isTeamEvent ? 'Team-Based Event' : 'Individual Event'}
                  </div>
                  {selectedEvent.isTeamEvent && (
                    <div className="text-[11px] text-retro-muted mt-0.5">
                      Primary: {selectedEvent.maxPrimaryRosterSize ?? '∞'} · Backup: {selectedEvent.maxBackupRosterSize ?? '∞'}
                    </div>
                  )}
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

          {/* Team Standings */}
          {selectedEvent.isTeamEvent && selectedEvent.scoringType === 1 && (
            <PixelCard className="bg-retro-surface">
              <PixelStack gap={4}>
                <PixelSectionHeader title="TEAM STANDINGS" size="sm" />
                {selectedEvent.teamPointsOverview && selectedEvent.teamPointsOverview.length > 0 ? (
                  <PixelTable
                    columns={[
                      { key: 'rank', header: '#', width: '10%', render: (_, idx) => idx + 1 },
                      {
                        key: 'team',
                        header: 'TEAM',
                        width: '50%',
                        render: (t) => (
                          <Link
                            to="/$user"
                            params={{ user: t.slug || t.teamId }}
                            className="font-bold text-retro-text hover:text-retro-primary"
                          >
                            {t.name}
                          </Link>
                        ),
                      },
                      { key: 'members', header: 'SCORING RACERS', width: '20%', render: (t) => t.memberCount },
                      { key: 'points', header: 'TEAM POINTS', width: '20%', render: (t) => `${t.points} pts` },
                    ]}
                    data={selectedEvent.teamPointsOverview}
                  />
                ) : (
                  <span className="font-pixel text-xs text-retro-muted">NO TEAM STANDINGS RECORDED YET</span>
                )}
              </PixelStack>
            </PixelCard>
          )}

          {/* Standings Overview */}
          <PixelCard className="bg-retro-surface">
            <PixelStack gap={4}>
              <PixelSectionHeader
                title={selectedEvent.isTeamEvent ? 'INDIVIDUAL STANDINGS' : 'OVERALL EVENT LEADERBOARD'}
                size="sm"
              />
              {selectedEvent.scoringType === 1 ? (
                selectedEvent.pointsOverview && selectedEvent.pointsOverview.length > 0 ? (
                  <PixelTable
                    columns={[
                      { key: 'rank', header: '#', width: '10%', render: (_, idx) => idx + 1 },
                      {
                        key: 'name',
                        header: 'COMPETITOR',
                        width: '60%',
                        render: (p) => (
                          <div className="flex items-center gap-2 flex-wrap">
                            <UserLink userId={p.userId} name={p.name} />
                            {selectedEvent.isTeamEvent && p.teamName && (
                              <PixelBadge tone="purple">{p.teamName}</PixelBadge>
                            )}
                          </div>
                        ),
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
                        render: (l) => (
                          <div className="flex items-center gap-2 flex-wrap">
                            <UserLink userId={l.userId} name={l.name} />
                            {selectedEvent.isTeamEvent && l.teamName && (
                              <PixelBadge tone="purple">{l.teamName}</PixelBadge>
                            )}
                          </div>
                        ),
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

      {/* SUB-TAB 2: EVENT MEMBERS OR TEAMS & ROSTERS */}
      {activeTab === 'members' && selectedEvent.isTeamEvent && (
        <PixelStack gap={6}>
          <PixelCard className="bg-retro-surface">
            <PixelStack gap={4}>
              <PixelSectionHeader
                title={`REGISTER OR EDIT TEAM ROSTER (PRIMARY MAX: ${selectedEvent.maxPrimaryRosterSize ?? '∞'} · BACKUP MAX: ${selectedEvent.maxBackupRosterSize ?? '∞'})`}
                size="sm"
              />
              {teamRosterError && <PixelAlert tone="red" message={teamRosterError} />}

              <div>
                <label className="block font-pixel text-xs text-retro-muted mb-1">SELECT APPROVED TEAM</label>
                <select
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  className="w-full px-3 py-2 bg-retro-bg border-2 border-retro-border rounded font-sans text-sm text-retro-text"
                >
                  <option value="">-- Choose a Team --</option>
                  {availableTeams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} (@{t.slug})
                    </option>
                  ))}
                </select>
              </div>

              {loadingTeamDetail ? (
                <PixelSpinner size="sm" label="Loading team members..." />
              ) : selectedTeamDetail ? (
                <PixelStack gap={3}>
                  <div className="flex gap-2 flex-wrap">
                    <PixelBadge tone="green">
                      PRIMARY: {primaryUserIds.length} / {selectedEvent.maxPrimaryRosterSize ?? '∞'}
                    </PixelBadge>
                    <PixelBadge tone="neutral">
                      BACKUP: {backupUserIds.length} / {selectedEvent.maxBackupRosterSize ?? '∞'}
                    </PixelBadge>
                  </div>

                  <div className="max-h-64 overflow-y-auto space-y-2 border-2 border-retro-border p-2 bg-retro-bg">
                    {(selectedTeamDetail.members ?? []).map((m) => {
                      const isPrimary = primaryUserIds.includes(m.userId)
                      const isBackup = backupUserIds.includes(m.userId)
                      return (
                        <div
                          key={m.userId}
                          className="flex items-center justify-between gap-2 p-2 border border-retro-border bg-retro-surface"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-retro-text truncate">{m.name}</div>
                            <div className="text-xs text-retro-muted truncate">{m.role}</div>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <PixelButton
                              type="button"
                              size="sm"
                              variant={isPrimary ? 'solid' : 'ghost'}
                              tone={isPrimary ? 'green' : 'neutral'}
                              onClick={() => {
                                setTeamRosterError(null)
                                if (isPrimary) {
                                  setPrimaryUserIds((prev) => prev.filter((id) => id !== m.userId))
                                } else {
                                  if (
                                    selectedEvent.maxPrimaryRosterSize !== null &&
                                    selectedEvent.maxPrimaryRosterSize > 0 &&
                                    primaryUserIds.length >= selectedEvent.maxPrimaryRosterSize
                                  ) {
                                    setTeamRosterError(`Primary roster limit is ${selectedEvent.maxPrimaryRosterSize} per team.`)
                                    return
                                  }
                                  setBackupUserIds((prev) => prev.filter((id) => id !== m.userId))
                                  setPrimaryUserIds((prev) => [...prev, m.userId])
                                }
                              }}
                            >
                              PRIMARY
                            </PixelButton>
                            <PixelButton
                              type="button"
                              size="sm"
                              variant={isBackup ? 'solid' : 'ghost'}
                              tone={isBackup ? 'cyan' : 'neutral'}
                              onClick={() => {
                                setTeamRosterError(null)
                                if (isBackup) {
                                  setBackupUserIds((prev) => prev.filter((id) => id !== m.userId))
                                } else {
                                  if (
                                    selectedEvent.maxBackupRosterSize !== null &&
                                    backupUserIds.length >= selectedEvent.maxBackupRosterSize
                                  ) {
                                    setTeamRosterError(`Backup roster limit is ${selectedEvent.maxBackupRosterSize} per team.`)
                                    return
                                  }
                                  setPrimaryUserIds((prev) => prev.filter((id) => id !== m.userId))
                                  setBackupUserIds((prev) => [...prev, m.userId])
                                }
                              }}
                            >
                              BACKUP
                            </PixelButton>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="flex justify-end">
                    <PixelButton
                      type="button"
                      variant="solid"
                      tone="purple"
                      size="sm"
                      loading={savingTeamRoster}
                      disabled={primaryUserIds.length === 0}
                      onClick={async () => {
                        setSavingTeamRoster(true)
                        setTeamRosterError(null)
                        try {
                          await handleUpsertEventTeamRoster(selectedTeamId, primaryUserIds, backupUserIds)
                          toast({ tone: 'green', title: 'Team roster saved.' })
                        } catch (err) {
                          setTeamRosterError(err instanceof Error ? err.message : 'Failed to save team roster')
                        } finally {
                          setSavingTeamRoster(false)
                        }
                      }}
                    >
                      SAVE TEAM ROSTER
                    </PixelButton>
                  </div>
                </PixelStack>
              ) : null}
            </PixelStack>
          </PixelCard>

          <PixelCard className="bg-retro-surface">
            <PixelStack gap={4}>
              <PixelSectionHeader
                title={`REGISTERED TEAMS (${(selectedEvent.teams ?? []).length}${
                  !selectedEvent.granularParticipation && selectedEvent.participantLimit
                    ? ` / ${selectedEvent.participantLimit}`
                    : ''
                })`}
                size="sm"
              />
              {(selectedEvent.teams ?? []).length === 0 ? (
                <span className="font-pixel text-xs text-retro-muted">NO TEAMS REGISTERED YET</span>
              ) : (
                <PixelStack gap={4}>
                  {(selectedEvent.teams ?? []).map((t) => (
                    <div key={t.teamId} className="p-4 bg-retro-bg border-2 border-retro-border rounded space-y-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="font-pixel text-sm font-bold text-retro-text">{t.name}</span>
                          <PixelBadge tone="green">PRIMARY: {(t.primaryRoster ?? []).length}</PixelBadge>
                          <PixelBadge tone="neutral">BACKUP: {(t.backupRoster ?? []).length}</PixelBadge>
                        </div>
                        <div className="flex gap-2">
                          <PixelButton
                            type="button"
                            size="sm"
                            variant="ghost"
                            tone="cyan"
                            onClick={() => setSelectedTeamId(t.teamId)}
                          >
                            EDIT ROSTER
                          </PixelButton>
                          <PixelButton
                            type="button"
                            size="sm"
                            variant="ghost"
                            tone="red"
                            onClick={() => {
                              if (confirm(`Remove team "${t.name}" and its roster from this event?`)) {
                                void handleRemoveEventTeam(t.teamId)
                              }
                            }}
                          >
                            REMOVE TEAM
                          </PixelButton>
                        </div>
                      </div>

                      <div>
                        <div className="font-pixel text-[10px] text-retro-muted mb-1">PRIMARY ROSTER</div>
                        <div className="flex flex-wrap gap-1.5">
                          {(t.primaryRoster ?? []).map((m) => (
                            <PixelBadge key={m.userId} tone="green">
                              {m.name}
                            </PixelBadge>
                          ))}
                        </div>
                      </div>

                      {(t.backupRoster ?? []).length > 0 && (
                        <div className="space-y-2 pt-2 border-t border-retro-border">
                          <div className="font-pixel text-[10px] text-retro-muted">
                            BACKUP ROSTER (1-CLICK SUBSTITUTION)
                          </div>
                          {(t.backupRoster ?? []).map((bm) => {
                            const key = `${t.teamId}:${bm.userId}`
                            const swapOutId = subSwapTargets[key] ?? ''
                            const replaceUpcoming = subReplaceUpcoming[key] ?? true
                            return (
                              <div
                                key={bm.userId}
                                className="flex flex-wrap items-center justify-between gap-2 p-2 bg-retro-surface border border-retro-border rounded"
                              >
                                <span className="text-xs font-medium text-retro-text">{bm.name}</span>
                                <div className="flex flex-wrap items-center gap-2">
                                  <select
                                    value={swapOutId}
                                    onChange={(e) =>
                                      setSubSwapTargets((prev) => ({ ...prev, [key]: e.target.value }))
                                    }
                                    className="px-2 py-1 bg-retro-bg border border-retro-border rounded text-xs text-retro-text"
                                  >
                                    <option value="">Promote (No Swap)</option>
                                    {(t.primaryRoster ?? []).map((pm) => (
                                      <option key={pm.userId} value={pm.userId}>
                                        Swap with {pm.name}
                                      </option>
                                    ))}
                                  </select>
                                  {swapOutId && (
                                    <label className="flex items-center gap-1 text-[11px] text-retro-muted cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={replaceUpcoming}
                                        onChange={(e) =>
                                          setSubReplaceUpcoming((prev) => ({ ...prev, [key]: e.target.checked }))
                                        }
                                      />
                                      Update upcoming races
                                    </label>
                                  )}
                                  <PixelButton
                                    type="button"
                                    size="sm"
                                    variant="solid"
                                    tone="green"
                                    onClick={() =>
                                      void handleSubstituteTeamMember(
                                        t.teamId,
                                        bm.userId,
                                        swapOutId || null,
                                        replaceUpcoming,
                                      )
                                    }
                                  >
                                    {swapOutId ? 'SWAP IN' : 'PROMOTE'}
                                  </PixelButton>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </PixelStack>
              )}
            </PixelStack>
          </PixelCard>
        </PixelStack>
      )}

      {/* SUB-TAB 2: EVENT MEMBERS (INDIVIDUAL) */}
      {activeTab === 'members' && !selectedEvent.isTeamEvent && (
        <PixelCard className="bg-retro-surface">
          <PixelStack gap={4}>
            <PixelSectionHeader title={`EVENT MEMBERS (${selectedEvent.members.length})`} size="sm" />

            {selectedEvent.granularParticipation ? (
              <PixelAlert
                tone="cyan"
                message="Granular Per-Race Participation Enabled. In granular events, competitors enroll directly into individual races on the Races & Tracks tab. Removing a participant below will un-enroll them from all registered races and remove them from the event."
              />
            ) : (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3 bg-retro-bg rounded border border-retro-border">
                <div className="flex-1 min-w-0">
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
                    render: (m) =>
                      selectedEvent.organizationId && authHeader ? (
                        <select
                          value={m.classTier && m.classTier !== 'PRE_OP' && m.classTier !== 'OP' ? m.classTier : ''}
                          onChange={async (e) => {
                            const v = e.target.value as ClassTier | ''
                            try {
                              await updateAdminUserClass(
                                m.userId,
                                selectedEvent.organizationId!,
                                v === '' ? null : v,
                                authHeader,
                              )
                              await detail.reloadCurrentEvent()
                              toast({ tone: 'green', title: v ? `Updated class grade to ${v}.` : 'Cleared class grade.' })
                            } catch (err) {
                              toast({ tone: 'red', title: err instanceof Error ? err.message : 'Failed to update class grade' })
                            }
                          }}
                          className="px-2 py-1 bg-retro-bg border border-retro-border rounded text-xs text-retro-text font-sans"
                        >
                          <option value="">OPEN</option>
                          <option value="G3">G3</option>
                          <option value="G2">G2</option>
                          <option value="G1">G1</option>
                        </select>
                      ) : (
                        <PixelBadge tone="neutral">{m.classTier || 'OPEN'}</PixelBadge>
                      ),
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
                  {races.map((r, idx) => (
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
                          <div className="flex items-center gap-1">
                            <PixelBadge tone={selectedRaceId === r.id ? 'purple' : 'neutral'}>
                              {r.trackType} ({r.distanceMeters}m)
                            </PixelBadge>
                            {/* Sequence Move Controls */}
                            <PixelButton
                              variant="ghost"
                              tone="neutral"
                              size="sm"
                              disabled={idx === 0}
                              onClick={() => void handleMoveRace(idx, 'up')}
                              title="Move race up in schedule"
                            >
                              ▲
                            </PixelButton>
                            <PixelButton
                              variant="ghost"
                              tone="neutral"
                              size="sm"
                              disabled={idx === races.length - 1}
                              onClick={() => void handleMoveRace(idx, 'down')}
                              title="Move race down in schedule"
                            >
                              ▼
                            </PixelButton>
                          </div>
                        </div>

                        <div className="font-sans text-xs text-retro-muted">
                          LOCATION: <strong>{r.location}</strong> | GRADE: <strong>{r.grade || 'OP'}</strong>
                          {r.participantLimit !== null && (
                            <span> | LIMIT: <strong>{r.participantLimit}</strong></span>
                          )}
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-retro-border flex-wrap">
                          <PixelButton
                            variant={selectedRaceId === r.id ? 'solid' : 'ghost'}
                            tone="purple"
                            size="sm"
                            onClick={() => void handleSelectRace(r, true)}
                          >
                            {selectedRaceId === r.id ? 'MANAGING STANDINGS' : 'SELECT STANDINGS'}
                          </PixelButton>

                          <PixelButton
                            variant="ghost"
                            tone="neutral"
                            size="sm"
                            onClick={() => handleOpenEditRaceModal(r)}
                          >
                            EDIT RACE
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
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3 bg-retro-bg rounded border border-retro-border">
                    <div className="flex-1 min-w-0">
                      {selectedEvent.isTeamEvent ? (
                        <RaceMemberCombobox
                          value={addRaceMemberUserId}
                          onChange={setAddRaceMemberUserId}
                          members={selectedEvent.members.filter(
                            (em) =>
                              em.rosterRole === 'PRIMARY' &&
                              !(selectedRace.members ?? []).some((rm) => rm.userId === em.userId)
                          )}
                        />
                      ) : selectedEvent.granularParticipation ? (
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

                  {selectedEvent.isTeamEvent && (
                    <div className="text-xs text-retro-muted font-sans">
                      Only <strong>PRIMARY</strong> roster members are eligible for race lineups. To sub in a backup, use <strong>Teams &amp; Rosters</strong>.
                    </div>
                  )}

                  {(selectedRace.members ?? []).length > 0 ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {(selectedRace.members ?? []).map((m) => (
                        <div
                          key={m.userId}
                          className="flex items-center gap-2 px-3 py-1.5 bg-retro-bg border border-retro-border rounded font-pixel text-xs text-retro-text"
                        >
                          <UserLink userId={m.userId} name={m.name} />
                          {selectedEvent.isTeamEvent && m.teamName && (
                            <PixelBadge tone="purple">{m.teamName}</PixelBadge>
                          )}
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
          <form onSubmit={onSaveEditDetails} className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
            <PixelInput label="EVENT NAME" required value={editName} onChange={(e) => setEditName(e.target.value)} />

            <PixelInput
              label="BANNER IMAGE URL (OPTIONAL)"
              type="url"
              value={editBannerUrl}
              onChange={(e) => setEditBannerUrl(e.target.value)}
              placeholder="https://example.com/event-banner.png"
            />

            <MarkdownEditor
              label="DESCRIPTION"
              value={editDescription}
              onChange={setEditDescription}
              minHeight="180px"
              defaultMode="write"
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

            <PixelInput
              label="SCHEDULED DATE / TIME"
              type="datetime-local"
              value={editScheduledAt}
              onChange={(e) => setEditScheduledAt(e.target.value)}
            />

            {!selectedEvent.granularParticipation ? (
              <PixelInput
                label={selectedEvent.isTeamEvent ? 'TEAM LIMIT' : 'PARTICIPANT LIMIT'}
                type="number"
                placeholder={selectedEvent.isTeamEvent ? 'e.g. 12 teams' : 'e.g. 20'}
                value={editParticipantLimit}
                onChange={(e) => setEditParticipantLimit(e.target.value)}
              />
            ) : (
              <PixelInput
                label="MAX RACES PER PARTICIPANT"
                type="number"
                placeholder="e.g. 3"
                value={editMaxConcurrent}
                onChange={(e) => setEditMaxConcurrent(e.target.value)}
              />
            )}

            {selectedEvent.isTeamEvent && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <PixelInput
                  label="MAX PRIMARY ROSTER (PER TEAM)"
                  type="number"
                  placeholder="Blank for unlimited"
                  value={editMaxPrimaryRosterSize}
                  onChange={(e) => setEditMaxPrimaryRosterSize(e.target.value)}
                />
                <PixelInput
                  label="MAX BACKUP ROSTER (PER TEAM)"
                  type="number"
                  placeholder="Blank for unlimited"
                  value={editMaxBackupRosterSize}
                  onChange={(e) => setEditMaxBackupRosterSize(e.target.value)}
                />
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="edit-signups-locked"
                checked={editSignupsLocked}
                onChange={(e) => setEditSignupsLocked(e.target.checked)}
                className="w-4 h-4 accent-retro-primary cursor-pointer"
              />
              <label htmlFor="edit-signups-locked" className="font-pixel text-xs text-retro-text cursor-pointer">
                LOCK EVENT SIGNUPS
              </label>
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

      {/* CONFIRM RECOMPUTE WARNING MODAL */}
      {showConfirmModal && (
        <PixelModal
          open={showConfirmModal}
          onClose={() => setShowConfirmModal(false)}
          title="RECALCULATE POINTS WARNING"
        >
          <PixelStack gap={4}>
            <PixelAlert
              tone="red"
              message="Changing the event's scoring rules will trigger an automatic background recomputation of points for all existing race results associated with this event. This can invalidate previously recorded standings."
            />
            <p className="font-sans text-xs text-retro-text">
              Are you sure you want to proceed and save these scoring changes?
            </p>
            <div className="flex justify-end gap-2 pt-4 border-t border-retro-border">
              <PixelButton variant="ghost" tone="neutral" onClick={() => setShowConfirmModal(false)}>
                CANCEL
              </PixelButton>
              <PixelButton
                variant="solid"
                tone="purple"
                onClick={async () => {
                  setShowConfirmModal(false)
                  await performSaveEventDetails()
                }}
              >
                CONFIRM & SAVE
              </PixelButton>
            </div>
          </PixelStack>
        </PixelModal>
      )}

      {/* EDIT RACE DETAILS MODAL */}
      {showEditRaceModal && editingRace && (
        <PixelModal
          open={showEditRaceModal}
          onClose={() => {
            setShowEditRaceModal(false)
            setEditingRace(null)
          }}
          title="EDIT RACE DETAILS"
        >
          <form onSubmit={onEditRaceSubmit} className="space-y-4">
            {raceEditError && <PixelAlert tone="red" message={raceEditError} />}

            <PixelInput
              label="RACE NAME"
              required
              value={raceEditName}
              onChange={(e) => setRaceEditName(e.target.value)}
            />

            <div className="grid grid-cols-2 gap-4">
              <PixelInput
                label="TRACK TYPE"
                required
                value={raceEditTrackType}
                onChange={(e) => setRaceEditTrackType(e.target.value)}
              />
              <PixelInput
                label="LOCATION"
                required
                value={raceEditLocation}
                onChange={(e) => setRaceEditLocation(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <PixelInput
                label="DISTANCE (METERS)"
                type="number"
                required
                value={String(raceEditDistance)}
                onChange={(e) => setRaceEditDistance(Number(e.target.value))}
              />
              <div>
                <label className="block font-pixel text-xs text-retro-text mb-1">RACE GRADE</label>
                <select
                  value={raceEditGrade}
                  onChange={(e) => setRaceEditGrade(e.target.value)}
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

            <div>
              <label className="block font-pixel text-xs text-retro-text mb-1">CLASS RESTRICTION</label>
              <select
                value={raceEditClassRestriction}
                onChange={(e) => setRaceEditClassRestriction(e.target.value)}
                className="w-full px-3 py-2 bg-retro-bg border-2 border-retro-border rounded font-sans text-sm text-retro-text"
              >
                <option value="">Any Tier Eligibility (None)</option>
                <option value="G3">G3</option>
                <option value="G2">G2</option>
                <option value="G1">G1</option>
              </select>
            </div>

            {selectedEvent.granularParticipation && (
              <PixelInput
                label="RACE PARTICIPANT LIMIT"
                type="number"
                placeholder="e.g. 10"
                value={raceEditParticipantLimit}
                onChange={(e) => setRaceEditParticipantLimit(e.target.value)}
              />
            )}

            <div className="flex justify-end gap-2 pt-4 border-t border-retro-border">
              <PixelButton
                variant="ghost"
                tone="neutral"
                onClick={() => {
                  setShowEditRaceModal(false)
                  setEditingRace(null)
                }}
              >
                CANCEL
              </PixelButton>
              <PixelButton variant="solid" tone="purple" type="submit">
                SAVE CHANGES
              </PixelButton>
            </div>
          </form>
        </PixelModal>
      )}

      {/* CONFIRM RACE GRADE CHANGE RECOMPUTE WARNING MODAL */}
      {showRaceGradeConfirm && (
        <PixelModal
          open={showRaceGradeConfirm}
          onClose={() => setShowRaceGradeConfirm(false)}
          title="RECALCULATE RACE POINTS WARNING"
        >
          <PixelStack gap={4}>
            <PixelAlert
              tone="red"
              message="Changing this race's grade will trigger an automatic recomputation of points for all recorded results in this specific race."
            />
            <p className="font-sans text-xs text-retro-text">
              Are you sure you want to proceed and update the race grade?
            </p>
            <div className="flex justify-end gap-2 pt-4 border-t border-retro-border">
              <PixelButton variant="ghost" tone="neutral" onClick={() => setShowRaceGradeConfirm(false)}>
                CANCEL
              </PixelButton>
              <PixelButton
                variant="solid"
                tone="purple"
                onClick={async () => {
                  setShowRaceGradeConfirm(false)
                  await performSaveRaceDetails()
                }}
              >
                CONFIRM & SAVE
              </PixelButton>
            </div>
          </PixelStack>
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
