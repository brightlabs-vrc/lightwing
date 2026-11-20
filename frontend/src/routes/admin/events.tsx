import { Link, Outlet, createFileRoute, useRouterState } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import {
  Button,
  Checkbox,
  Dialog,
  FormControl,
  Label,
  Select,
  Textarea,
  TextInput,
  UnderlineNav,
} from '@primer/react'
import { PlusIcon, SyncIcon } from '@primer/octicons-react'
import { useAuth } from '../../hooks/useAuth'
import { requireAdminPanel } from '../../lib/auth-guard'
import { AdminLayout } from './-AdminLayout'
import { createAdminEvent, listAdminEvents } from '../../lib/admin-api'
import type { ClassTier, EventOwnerType, EventStatus, EventTag } from '../../types'
import { AlertBanner } from '../../components/AlertBanner'
import { UserSearchCombobox } from '../../components/UserSearchCombobox'
import { OrganizationSearchCombobox } from '../../components/OrganizationSearchCombobox'
import { Pagination } from '../../components/Pagination'
import { EventScoringTablesEditor } from '../../components/EventScoringTablesEditor'
import type { eventmanager } from '../../lib/client'
import { MOCK_MODE } from '../../lib/mock-mode'
import { DEFAULT_SCORING_TABLES } from '../../lib/scoringDefaults'
import { PrimerSkeletonList } from '../../components/LoadingSkeleton'

export const Route = createFileRoute('/admin/events')({
  beforeLoad: async ({ location }) => {
    await requireAdminPanel(location)
  },
  component: AdminEventsListPage,
})

type StatusTab = 'ACTIVE' | 'ONGOING' | 'PENDING' | 'DRAFT' | 'CONCLUDED' | 'PENDING_DELETION'

function statusLabelVariant(status: string): 'success' | 'accent' | 'danger' | 'attention' | 'secondary' {
  switch (status) {
    case 'ONGOING':
      return 'success'
    case 'PENDING':
      return 'accent'
    case 'PENDING_DELETION':
      return 'danger'
    case 'DRAFT':
      return 'attention'
    default:
      return 'secondary'
  }
}

function AdminEventsListPage() {
  const { session } = useAuth()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const isListRoute = pathname === '/admin/events'

  const [events, setEvents] = useState<eventmanager.EventListItem[]>([])
  const [totalEvents, setTotalEvents] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [statusTab, setStatusTab] = useState<StatusTab>('ACTIVE')
  const [tagFilter, setTagFilter] = useState<string>('')

  // Create Event Form state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formTag, setFormTag] = useState<EventTag>('OFFICIAL')
  const [formOwnerType, setFormOwnerType] = useState<EventOwnerType>('USER')
  const [formOwnerUserId, setFormOwnerUserId] = useState('')
  const [formOrganizationId, setFormOrganizationId] = useState('')
  const [formScoringType, setFormScoringType] = useState<number>(1)
  const [formClassRestriction, setFormClassRestriction] = useState<string>('')
  const [formGranularParticipation, setFormGranularParticipation] = useState(false)
  const [formScheduledAt, setFormScheduledAt] = useState<string>('')
  const [formParticipantLimit, setFormParticipantLimit] = useState<string>('')
  const [formMaxConcurrentRaceParticipations, setFormMaxConcurrentRaceParticipations] = useState<string>('')
  const [formIsTeamEvent, setFormIsTeamEvent] = useState(false)
  const [formMaxPrimaryRosterSize, setFormMaxPrimaryRosterSize] = useState<string>('')
  const [formMaxBackupRosterSize, setFormMaxBackupRosterSize] = useState<string>('')
  const [formScoringRulesMode, setFormScoringRulesMode] = useState<'STANDARD' | 'CUSTOM'>('STANDARD')
  const [formCustomScoringTables, setFormCustomScoringTables] = useState<Record<string, Record<number, number>>>(DEFAULT_SCORING_TABLES)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const activeUserId = session?.user.id || ''
  const activeOrgId = 'org_mock_urs'

  async function loadEvents() {
    setLoadingEvents(true)
    setGlobalError(null)
    try {
      const offset = (page - 1) * pageSize
      const statusParam = statusTab === 'ACTIVE' ? undefined : (statusTab as EventStatus)
      const includeDeleted = statusTab === 'PENDING_DELETION'
      const tagParam = tagFilter ? (tagFilter as EventTag) : undefined
      const response = await listAdminEvents(undefined, undefined, pageSize, offset, statusParam, tagParam, includeDeleted)
      setEvents(response.events)
      setTotalEvents(response.total)
    } catch (cause) {
      setGlobalError(cause instanceof Error ? cause.message : 'Unable to load events')
    } finally {
      setLoadingEvents(false)
    }
  }

  useEffect(() => {
    void loadEvents()
  }, [page, pageSize, statusTab, tagFilter])

  useEffect(() => {
    if (showCreateModal) {
      setFormName('')
      setFormDescription('')
      setFormTag('OFFICIAL')
      setFormOwnerType('USER')
      setFormOwnerUserId(activeUserId || 'mock-admin-1')
      setFormOrganizationId(activeOrgId || 'org_mock_urs')
      setFormScoringType(1)
      setFormClassRestriction('')
      setFormGranularParticipation(false)
      setFormScheduledAt('')
      setFormParticipantLimit('')
      setFormMaxConcurrentRaceParticipations('')
      setFormIsTeamEvent(false)
      setFormMaxPrimaryRosterSize('')
      setFormMaxBackupRosterSize('')
      setFormScoringRulesMode('STANDARD')
      setFormCustomScoringTables(DEFAULT_SCORING_TABLES)
    }
  }, [showCreateModal, activeUserId, activeOrgId])

  const handleCreateEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim()) {
      setFormError('Event Name is required.')
      return
    }

    if (formScoringType === 1 && formScoringRulesMode === 'CUSTOM') {
      const grades = ['OP', 'GIII', 'GII', 'GI']
      for (const grade of grades) {
        const table = formCustomScoringTables[grade]
        if (!table) {
          setFormError(`Custom table for grade ${grade} is missing.`)
          return
        }
        for (let pos = 1; pos <= 10; pos++) {
          const val = table[pos]
          if (val === undefined || val === null || String(val).trim() === '') {
            setFormError(`Custom table for grade ${grade} is missing value for position #${pos}.`)
            return
          }
          const num = Number(val)
          if (!Number.isInteger(num) || num < 0) {
            setFormError(`Custom table for grade ${grade}, position #${pos} must be a valid non-negative integer.`)
            return
          }
        }
      }
    }

    const token = session?.session.token
    const authHeader = token ? `Bearer ${token}` : ''
    if (!authHeader && !MOCK_MODE) {
      setFormError('Authentication required to create events.')
      return
    }

    const limitNum = formParticipantLimit.trim() ? Number(formParticipantLimit) : null
    const maxConcurrentNum = formMaxConcurrentRaceParticipations.trim() ? Number(formMaxConcurrentRaceParticipations) : null
    const maxPrimaryNum = formMaxPrimaryRosterSize.trim() ? Number(formMaxPrimaryRosterSize) : null
    const maxBackupNum = formMaxBackupRosterSize.trim() ? Number(formMaxBackupRosterSize) : null

    if (limitNum !== null && (isNaN(limitNum) || !Number.isSafeInteger(limitNum) || limitNum <= 0)) {
      setFormError(formIsTeamEvent ? 'Team limit must be a positive whole number.' : 'Participant limit must be a positive whole number.')
      return
    }

    if (maxConcurrentNum !== null && (isNaN(maxConcurrentNum) || !Number.isSafeInteger(maxConcurrentNum) || maxConcurrentNum <= 0)) {
      setFormError('Max races per participant must be a positive whole number.')
      return
    }

    if (formIsTeamEvent && maxPrimaryNum !== null && (isNaN(maxPrimaryNum) || !Number.isSafeInteger(maxPrimaryNum) || maxPrimaryNum <= 0)) {
      setFormError('Max primary roster size must be a positive whole number.')
      return
    }

    if (formIsTeamEvent && maxBackupNum !== null && (isNaN(maxBackupNum) || !Number.isSafeInteger(maxBackupNum) || maxBackupNum < 0)) {
      setFormError('Max backup roster size must be 0 or a positive whole number.')
      return
    }

    setSubmitting(true)
    setFormError(null)
    try {
      await createAdminEvent(
        {
          name: formName.trim(),
          description: formDescription.trim() || null,
          ownerType: formOwnerType,
          organizationId: formOwnerType === 'ORGANIZATION' ? formOrganizationId.trim() || null : null,
          ownerUserId: formOwnerType === 'USER' ? formOwnerUserId.trim() || null : null,
          tag: formTag,
          scoringType: Number(formScoringType),
          classRestriction: formClassRestriction ? (formClassRestriction as ClassTier) : null,
          granularParticipation: formGranularParticipation,
          scoringRulesMode: formScoringType === 1 ? formScoringRulesMode : null,
          customScoringTables: formScoringType === 1 && formScoringRulesMode === 'CUSTOM' ? formCustomScoringTables : null,
          scheduledAt: formScheduledAt ? new Date(formScheduledAt).toISOString() : null,
          participantLimit: !formGranularParticipation || formIsTeamEvent ? limitNum : null,
          maxConcurrentRaceParticipations: formGranularParticipation ? maxConcurrentNum : null,
          isTeamEvent: formIsTeamEvent,
          maxPrimaryRosterSize: formIsTeamEvent ? maxPrimaryNum : null,
          maxBackupRosterSize: formIsTeamEvent ? maxBackupNum : null,
        },
        authHeader,
      )
      setShowCreateModal(false)
      void loadEvents()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create event.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isListRoute) {
    return <Outlet />
  }

  const tabs: Array<{ key: StatusTab; label: string }> = [
    { key: 'ACTIVE', label: 'All Active' },
    { key: 'ONGOING', label: 'Ongoing' },
    { key: 'PENDING', label: 'Pending' },
    { key: 'DRAFT', label: 'Draft' },
    { key: 'CONCLUDED', label: 'Concluded' },
    { key: 'PENDING_DELETION', label: 'Pending Deletion' },
  ]

  return (
    <AdminLayout
      title="Events & Races"
      subtitle="Select a competition event to manage its lifecycle, competitors, race tracks, and standings."
      breadcrumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Events' }]}
      actions={
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Button type="button" leadingVisual={SyncIcon} onClick={() => void loadEvents()} disabled={loadingEvents}>
            Refresh
          </Button>
          <Button
            type="button"
            variant="primary"
            leadingVisual={PlusIcon}
            onClick={() => {
              setShowCreateModal(true)
              setFormError(null)
            }}
          >
            Create Event
          </Button>
        </div>
      }
    >
      {globalError && <AlertBanner variant="error">{globalError}</AlertBanner>}

      {/* Status UnderlineNav + Tag Filter */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
          marginBottom: '16px',
        }}
      >
        <div style={{ flex: '1 1 auto', minWidth: 0 }}>
          <UnderlineNav aria-label="Event Status Filter">
            {tabs.map((tab) => (
              <UnderlineNav.Item
                key={tab.key}
                aria-current={statusTab === tab.key ? 'page' : undefined}
                onSelect={(e) => {
                  e.preventDefault()
                  setStatusTab(tab.key)
                  setPage(1)
                }}
              >
                {tab.label}
              </UnderlineNav.Item>
            ))}
          </UnderlineNav>
        </div>

        <Select
          aria-label="Filter by hosting tag"
          size="small"
          value={tagFilter}
          onChange={(e) => {
            setTagFilter(e.target.value)
            setPage(1)
          }}
        >
          <Select.Option value="">All Tags</Select.Option>
          <Select.Option value="OFFICIAL">OFFICIAL</Select.Option>
          <Select.Option value="COMMUNITY">COMMUNITY</Select.Option>
        </Select>
      </div>

      <section className="primer-box">
        {loadingEvents ? (
          <PrimerSkeletonList count={4} />
        ) : events.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--fgColor-muted, #636c76)', fontSize: '13px' }}>
            No events found for the selected filter.
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="primer-table" aria-label="Competition Events Table" style={{ minWidth: '680px' }}>
                <thead>
                  <tr>
                    <th scope="col" style={{ width: '36%' }}>Event Name</th>
                    <th scope="col" style={{ width: '130px' }}>Status</th>
                    <th scope="col" style={{ width: '110px' }}>Tag</th>
                    <th scope="col" style={{ width: '140px' }}>Scoring</th>
                    <th scope="col" style={{ width: '90px' }}>Tier</th>
                    <th scope="col" style={{ width: '110px' }}>Races / Entries</th>
                    <th scope="col" style={{ width: '90px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((evt) => (
                    <tr key={evt.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <Link
                            to="/admin/events/$eventId"
                            params={{ eventId: evt.id }}
                            style={{ fontWeight: 600, color: 'var(--fgColor-accent, #0969da)', textDecoration: 'none' }}
                          >
                            {evt.name}
                          </Link>
                          {evt.isTeamEvent && (
                            <Label variant="accent" size="small">
                              TEAM
                            </Label>
                          )}
                        </div>
                      </td>
                      <td>
                        <Label variant={statusLabelVariant(evt.status)} size="small">
                          {evt.status}
                        </Label>
                      </td>
                      <td>
                        <Label variant={evt.tag === 'OFFICIAL' ? 'sponsors' : 'secondary'} size="small">
                          {evt.tag || 'OFFICIAL'}
                        </Label>
                      </td>
                      <td style={{ color: 'var(--fgColor-muted, #636c76)' }}>{evt.scoringTypeLabel}</td>
                      <td>
                        {evt.classRestriction && evt.classRestriction !== 'PRE_OP' && evt.classRestriction !== 'OP'
                          ? evt.classRestriction
                          : 'Any'}
                      </td>
                      <td style={{ color: 'var(--fgColor-muted, #636c76)' }}>
                        {evt.raceCount} / {evt.memberCount}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Link to="/admin/events/$eventId" params={{ eventId: evt.id }} style={{ textDecoration: 'none' }}>
                          <Button size="small">Manage</Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={page}
              pageSize={pageSize}
              total={totalEvents}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </section>

      {/* Create Event Primer Dialog */}
      {showCreateModal && (
        <Dialog title="Create New Competition Event" onClose={() => setShowCreateModal(false)} width="large">
          <form onSubmit={(e) => void handleCreateEventSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {formError && <AlertBanner variant="error">{formError}</AlertBanner>}

            <FormControl required>
              <FormControl.Label>Event Name</FormControl.Label>
              <TextInput
                block
                required
                placeholder="e.g. Winter Derby Championship"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </FormControl>

            <FormControl>
              <FormControl.Label>Description</FormControl.Label>
              <Textarea
                block
                rows={3}
                placeholder="Brief description of the event details, dates, or format..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </FormControl>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              <FormControl>
                <FormControl.Label>Event Hosting Tag</FormControl.Label>
                <Select block value={formTag} onChange={(e) => setFormTag(e.target.value as EventTag)}>
                  <Select.Option value="OFFICIAL">Official</Select.Option>
                  <Select.Option value="COMMUNITY">Community</Select.Option>
                </Select>
              </FormControl>

              <FormControl>
                <FormControl.Label>Scoring Mode</FormControl.Label>
                <Select block value={String(formScoringType)} onChange={(e) => setFormScoringType(Number(e.target.value))}>
                  <Select.Option value="1">Points Aggregation</Select.Option>
                  <Select.Option value="2">Ladder Rating (ELO)</Select.Option>
                </Select>
              </FormControl>

              <FormControl>
                <FormControl.Label>Class Tier Eligibility</FormControl.Label>
                <Select block value={formClassRestriction} onChange={(e) => setFormClassRestriction(e.target.value)}>
                  <Select.Option value="">Any Tier (None)</Select.Option>
                  <Select.Option value="G3">G3</Select.Option>
                  <Select.Option value="G2">G2</Select.Option>
                  <Select.Option value="G1">G1</Select.Option>
                </Select>
              </FormControl>
            </div>

            {formScoringType === 1 && (
              <div style={{ borderTop: '1px solid var(--borderColor-muted, #d8dee4)', paddingTop: '12px' }}>
                <FormControl>
                  <FormControl.Label>Points Scoring Rules Source</FormControl.Label>
                  <Select
                    block
                    value={formScoringRulesMode}
                    onChange={(e) => setFormScoringRulesMode(e.target.value as 'STANDARD' | 'CUSTOM')}
                  >
                    <Select.Option value="STANDARD">Standard Default Tables</Select.Option>
                    <Select.Option value="CUSTOM">Custom Event Tables</Select.Option>
                  </Select>
                </FormControl>

                {formScoringRulesMode === 'CUSTOM' && (
                  <EventScoringTablesEditor value={formCustomScoringTables} onChange={setFormCustomScoringTables} />
                )}
              </div>
            )}

            <FormControl>
              <FormControl.Label>
                Scheduled Date / Time ({Intl.DateTimeFormat().resolvedOptions().timeZone})
              </FormControl.Label>
              <TextInput
                block
                type="datetime-local"
                value={formScheduledAt}
                onChange={(e) => setFormScheduledAt(e.target.value)}
              />
            </FormControl>

            <FormControl>
              <Checkbox
                checked={formIsTeamEvent}
                onChange={(e) => {
                  const checked = e.target.checked
                  setFormIsTeamEvent(checked)
                  if (!checked) {
                    setFormMaxPrimaryRosterSize('')
                    setFormMaxBackupRosterSize('')
                  }
                }}
              />
              <FormControl.Label>Team-Based Competition Event</FormControl.Label>
              <FormControl.Caption>
                Teams register with Primary and Backup rosters. Only Primary roster members can enter race lineups, and points aggregate into Team Standings.
              </FormControl.Caption>
            </FormControl>

            {formIsTeamEvent && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <FormControl>
                  <FormControl.Label>Max Primary Roster Size (Per Team)</FormControl.Label>
                  <TextInput
                    block
                    type="number"
                    min={1}
                    placeholder="e.g. 3 (leave blank for unlimited)"
                    value={formMaxPrimaryRosterSize}
                    onChange={(e) => setFormMaxPrimaryRosterSize(e.target.value)}
                  />
                </FormControl>
                <FormControl>
                  <FormControl.Label>Max Backup Roster Size (Per Team)</FormControl.Label>
                  <TextInput
                    block
                    type="number"
                    min={0}
                    placeholder="e.g. 2 (leave blank for unlimited)"
                    value={formMaxBackupRosterSize}
                    onChange={(e) => setFormMaxBackupRosterSize(e.target.value)}
                  />
                </FormControl>
              </div>
            )}

            <FormControl>
              <Checkbox
                checked={formGranularParticipation}
                onChange={(e) => {
                  const checked = e.target.checked
                  setFormGranularParticipation(checked)
                  if (checked && !formIsTeamEvent) {
                    setFormParticipantLimit('')
                  } else if (!checked) {
                    setFormMaxConcurrentRaceParticipations('')
                  }
                }}
              />
              <FormControl.Label>Enable Granular Per-Race Participation</FormControl.Label>
              <FormControl.Caption>
                When enabled, competitors register separately for individual races instead of event-wide.
              </FormControl.Caption>
            </FormControl>

            {(!formGranularParticipation || formIsTeamEvent) && (
              <FormControl>
                <FormControl.Label>{formIsTeamEvent ? 'Team Limit' : 'Participant Limit'}</FormControl.Label>
                <TextInput
                  block
                  type="number"
                  min={1}
                  placeholder={formIsTeamEvent ? 'e.g. 12 teams (leave blank for unlimited)' : 'e.g. 20 (leave blank for unlimited)'}
                  value={formParticipantLimit}
                  onChange={(e) => setFormParticipantLimit(e.target.value)}
                />
              </FormControl>
            )}

            {formGranularParticipation && (
              <FormControl>
                <FormControl.Label>Max Races Per Participant</FormControl.Label>
                <TextInput
                  block
                  type="number"
                  min={1}
                  placeholder="e.g. 3 (leave blank for unlimited)"
                  value={formMaxConcurrentRaceParticipations}
                  onChange={(e) => setFormMaxConcurrentRaceParticipations(e.target.value)}
                />
              </FormControl>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px', alignItems: 'end' }}>
              <FormControl>
                <FormControl.Label>Ownership Type</FormControl.Label>
                <Select block value={formOwnerType} onChange={(e) => setFormOwnerType(e.target.value as EventOwnerType)}>
                  <Select.Option value="USER">Single User</Select.Option>
                  <Select.Option value="ORGANIZATION">Organization</Select.Option>
                </Select>
              </FormControl>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  {formOwnerType === 'USER' ? 'Owner User' : 'Owner Organization'}
                </label>
                {formOwnerType === 'USER' ? (
                  <UserSearchCombobox value={formOwnerUserId} onChange={(val) => setFormOwnerUserId(val)} />
                ) : (
                  <OrganizationSearchCombobox value={formOrganizationId} onChange={(val) => setFormOrganizationId(val)} />
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '10px', borderTop: '1px solid var(--borderColor-muted, #d8dee4)' }}>
              <Button type="button" onClick={() => setShowCreateModal(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={submitting}>
                {submitting ? 'Creating...' : 'Create Event'}
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </AdminLayout>
  )
}
