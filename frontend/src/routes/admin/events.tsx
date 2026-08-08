import { Link, Outlet, createFileRoute, useRouterState } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { requireSiteAdmin } from '../../lib/auth-guard'
import { AdminLayout } from './-AdminLayout'
import { listAdminEvents, createAdminEvent } from '../../lib/admin-api'
import { AlertBanner } from '../../components/AlertBanner'
import { UserSearchCombobox } from '../../components/UserSearchCombobox'
import { TeamSearchCombobox } from '../../components/TeamSearchCombobox'
import { PaginationBar } from '../../components/Pagination'
import { EventScoringTablesEditor } from '../../components/EventScoringTablesEditor'
import type { eventmanager } from '../../lib/client'
import { MOCK_MODE } from '../../lib/mock-mode'
import { DEFAULT_SCORING_TABLES } from '../../lib/scoringDefaults'
import { Heading, Text, Label, Button, TextInput, FormControl, Spinner, Dialog, Select } from '@primer/react'

export const Route = createFileRoute('/admin/events')({
  beforeLoad: async ({ location }) => {
    await requireSiteAdmin(location)
  },
  component: AdminEventsListPage,
})

function AdminEventsListPage() {
  const { session } = useAuth()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const isListRoute = pathname === '/admin/events'
  const [events, setEvents] = useState<eventmanager.EventListItem[]>([])
  const [totalEvents, setTotalEvents] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [globalError, setGlobalError] = useState<string | null>(null)

  // Create Event Form state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formOwnerType, setFormOwnerType] = useState<eventmanager.EventOwnerType>('USER')
  const [formOwnerUserId, setFormOwnerUserId] = useState('')
  const [formOrganizationId, setFormOrganizationId] = useState('')
  const [formScoringType, setFormScoringType] = useState<number>(1)
  const [formClassRestriction, setFormClassRestriction] = useState<string>('')
  const [formGranularParticipation, setFormGranularParticipation] = useState(false)
  const [formScheduledAt, setFormScheduledAt] = useState<string>('')
  const [formParticipantLimit, setFormParticipantLimit] = useState<string>('')
  const [formMaxConcurrentRaceParticipations, setFormMaxConcurrentRaceParticipations] = useState<string>('')
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
      const response = await listAdminEvents(undefined, undefined, pageSize, offset)
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
  }, [page, pageSize])

  // Set default values when modal opens or active session changes
  useEffect(() => {
    if (showCreateModal) {
      setFormName('')
      setFormDescription('')
      setFormOwnerType('USER')
      setFormOwnerUserId(activeUserId || 'mock-admin-1')
      setFormOrganizationId(activeOrgId || 'org_mock_urs')
      setFormScoringType(1)
      setFormClassRestriction('')
      setFormGranularParticipation(false)
      setFormScheduledAt('')
      setFormParticipantLimit('')
      setFormMaxConcurrentRaceParticipations('')
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

    if (limitNum !== null && (isNaN(limitNum) || !Number.isSafeInteger(limitNum) || limitNum <= 0)) {
      setFormError('Participant limit must be a positive whole number.')
      return
    }

    if (maxConcurrentNum !== null && (isNaN(maxConcurrentNum) || !Number.isSafeInteger(maxConcurrentNum) || maxConcurrentNum <= 0)) {
      setFormError('Max races per participant must be a positive whole number.')
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
          organizationId: formOwnerType === 'ORGANIZATION' ? (formOrganizationId.trim() || null) : null,
          ownerUserId: formOwnerType === 'USER' ? (formOwnerUserId.trim() || null) : null,
          scoringType: Number(formScoringType),
          classRestriction: formClassRestriction ? (formClassRestriction as eventmanager.ClassTier) : null,
          granularParticipation: formGranularParticipation,
          scoringRulesMode: formScoringType === 1 ? formScoringRulesMode : null,
          customScoringTables: (formScoringType === 1 && formScoringRulesMode === 'CUSTOM') ? formCustomScoringTables : null,
          scheduledAt: formScheduledAt ? new Date(formScheduledAt).toISOString() : null,
          participantLimit: formGranularParticipation ? null : limitNum,
          maxConcurrentRaceParticipations: formGranularParticipation ? maxConcurrentNum : null,
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

  const actions = (
    <div style={{ display: 'flex', gap: '8px' }}>
      <Button onClick={() => void loadEvents()}>
        Refresh
      </Button>
      <Button
        variant="primary"
        onClick={() => {
          setShowCreateModal(true)
          setFormError(null)
        }}
      >
        ➕ Create Event
      </Button>
    </div>
  )

  return (
    <AdminLayout
      title="Event & Race Operations"
      subtitle="Select a competition event to manage its lifecycle, competitors, race tracks, and results."
      actions={actions}
    >
      {globalError && (
        <AlertBanner variant="error">{globalError}</AlertBanner>
      )}

      <div style={{
        border: '1px solid var(--color-border-default)',
        borderRadius: '6px',
        backgroundColor: 'var(--color-canvas-default)',
        boxShadow: 'var(--color-shadow-small)',
        overflow: 'hidden'
      }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--color-border-default)' }}>
          <Heading as="h2" style={{ fontSize: '18px', margin: 0 }}>
            Competition Events
          </Heading>
        </div>

        <div style={{ padding: '1.5rem' }}>
          {loadingEvents ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem', gap: '0.5rem', color: '#57606a' }}>
              <Spinner size="small" />
              <span>Loading competition events...</span>
            </div>
          ) : events.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#57606a', border: '1px dashed #d0d7de', borderRadius: '6px' }}>
              <span>No events found.</span>
            </div>
          ) : (
            <>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {events.map((evt) => (
                  <li key={evt.id} style={{ borderBottom: '1px solid var(--color-border-default)', paddingBottom: '12px' }}>
                    <Link
                      to="/admin/events/$eventId"
                      params={{ eventId: evt.id }}
                      style={{
                        display: 'block',
                        textDecoration: 'none',
                        borderRadius: '6px',
                        padding: '12px',
                        transition: 'background 0.2s',
                        backgroundColor: 'var(--color-canvas-subtle)',
                        border: '1px solid var(--color-border-default)'
                      }}
                      onMouseEnter={(e) => {
                        ;(e.currentTarget as any).style.backgroundColor = 'var(--color-canvas-default)'
                      }}
                      onMouseLeave={(e) => {
                        ;(e.currentTarget as any).style.backgroundColor = 'var(--color-canvas-subtle)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '16px', color: 'var(--color-fg-default)' }}>{evt.name}</span>
                        <Label variant={evt.status === 'OFFICIAL' ? 'success' : evt.status === 'CONCLUDED' ? 'default' : 'accent'}>
                          {evt.status}
                        </Label>
                      </div>
                      <div style={{ fontSize: '12px', color: '#57606a', display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                        <span>Type: {evt.scoringTypeLabel}</span>
                        <span>Tier: {evt.classRestriction && evt.classRestriction !== 'PRE_OP' && evt.classRestriction !== 'OP' ? evt.classRestriction : 'Any'}</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>

              <div style={{ marginTop: '1.5rem' }}>
                <PaginationBar
                  page={page}
                  pageSize={pageSize}
                  total={totalEvents}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* EVENT CREATION DIALOG MODAL */}
      {showCreateModal && (
        <Dialog
          onClose={() => setShowCreateModal(false)}
          title="Create New Competition Event"
        >
          <form onSubmit={handleCreateEventSubmit}>
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '70vh', overflowY: 'auto' }}>
              {formError && (
                <AlertBanner variant="error">{formError}</AlertBanner>
              )}

              {/* Event Name */}
              <FormControl required>
                <FormControl.Label style={{ fontWeight: 'bold' }}>Event Name</FormControl.Label>
                <TextInput
                  type="text"
                  required
                  placeholder="e.g. Winter Derby Championship"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  width="100%"
                />
              </FormControl>

              {/* Description */}
              <FormControl>
                <FormControl.Label style={{ fontWeight: 'bold' }}>Description</FormControl.Label>
                <TextInput
                  as="textarea"
                  placeholder="Brief description of the event details, dates, or format..."
                  value={formDescription}
                  onChange={(e: any) => setFormDescription(e.target.value)}
                  width="100%"
                  rows={3}
                />
              </FormControl>

              {/* Scoring Mode & Tier restriction */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <FormControl>
                  <FormControl.Label style={{ fontWeight: 'bold' }}>Scoring Mode</FormControl.Label>
                  <Select
                    value={formScoringType}
                    onChange={(e) => setFormScoringType(Number(e.target.value))}
                    width="100%"
                  >
                    <option value={1}>Points Aggregation</option>
                    <option value={2}>Ladder Rating (ELO)</option>
                  </Select>
                </FormControl>

                <FormControl>
                  <FormControl.Label style={{ fontWeight: 'bold' }}>Class Tier Eligibility</FormControl.Label>
                  <Select
                    value={formClassRestriction || ''}
                    onChange={(e) => setFormClassRestriction(e.target.value || '')}
                    width="100%"
                  >
                    <option value="">Any Tier Eligibility (None)</option>
                    <option value="G3">G3</option>
                    <option value="G2">G2</option>
                    <option value="G1">G1</option>
                  </Select>
                </FormControl>
              </div>

              {formScoringType === 1 && (
                <div style={{ borderTop: '1px solid var(--color-border-default)', paddingTop: '1rem' }}>
                  <FormControl>
                    <FormControl.Label style={{ fontWeight: 'bold' }}>Points Scoring Rules Source</FormControl.Label>
                    <Select
                      value={formScoringRulesMode}
                      onChange={(e) => setFormScoringRulesMode(e.target.value as 'STANDARD' | 'CUSTOM')}
                      width="100%"
                    >
                      <option value="STANDARD">Standard Default Tables</option>
                      <option value="CUSTOM">Custom Event Tables (Configure below)</option>
                    </Select>
                  </FormControl>

                  {formScoringRulesMode === 'CUSTOM' && (
                    <div style={{ marginTop: '1rem' }}>
                      <EventScoringTablesEditor
                        value={formCustomScoringTables}
                        onChange={setFormCustomScoringTables}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Optional Event Date/Time */}
              <FormControl>
                <FormControl.Label style={{ fontWeight: 'bold' }}>
                  Scheduled Date / Time ({Intl.DateTimeFormat().resolvedOptions().timeZone})
                </FormControl.Label>
                <TextInput
                  type="datetime-local"
                  value={formScheduledAt}
                  onChange={(e) => setFormScheduledAt(e.target.value)}
                  width="100%"
                />
              </FormControl>

              {/* Granular Participation Toggle */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    id="granular-participation"
                    checked={formGranularParticipation}
                    onChange={(e) => {
                      const checked = e.target.checked
                      setFormGranularParticipation(checked)
                      if (checked) {
                        setFormParticipantLimit('')
                      } else {
                        setFormMaxConcurrentRaceParticipations('')
                      }
                    }}
                  />
                  <label htmlFor="granular-participation" style={{ fontWeight: 'bold', fontSize: '14px' }}>
                    Enable Granular Per-Race Participation
                  </label>
                </div>
                <p style={{ fontSize: '11px', margin: 0, color: '#57606a' }}>
                  If enabled, participants must be registered separately for each individual race. Otherwise, registrations are event-wide.
                </p>
              </div>

              {/* Capacity and Limits fields */}
              {!formGranularParticipation ? (
                <FormControl>
                  <FormControl.Label style={{ fontWeight: 'bold' }}>Participant limit</FormControl.Label>
                  <TextInput
                    type="number"
                    min="1"
                    placeholder="e.g. 20"
                    value={formParticipantLimit}
                    onChange={(e) => setFormParticipantLimit(e.target.value)}
                    width="100%"
                  />
                  <FormControl.Caption>
                    Maximum participants for the whole event. Leave blank for unlimited.
                  </FormControl.Caption>
                </FormControl>
              ) : (
                <FormControl>
                  <FormControl.Label style={{ fontWeight: 'bold' }}>Max races per participant</FormControl.Label>
                  <TextInput
                    type="number"
                    min="1"
                    placeholder="e.g. 3"
                    value={formMaxConcurrentRaceParticipations}
                    onChange={(e) => setFormMaxConcurrentRaceParticipations(e.target.value)}
                    width="100%"
                  />
                  <FormControl.Caption>
                    Maximum races one participant may join in this event. Leave blank for unlimited.
                  </FormControl.Caption>
                </FormControl>
              )}

              {/* Owner Parameters */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem', borderTop: '1px solid var(--color-border-default)', paddingTop: '1rem' }}>
                <FormControl>
                  <FormControl.Label style={{ fontWeight: 'bold' }}>Ownership Type</FormControl.Label>
                  <Select
                    value={formOwnerType}
                    onChange={(e) => setFormOwnerType(e.target.value as eventmanager.EventOwnerType)}
                    width="100%"
                  >
                    <option value="USER">Single User</option>
                    <option value="ORGANIZATION">Organization</option>
                  </Select>
                </FormControl>

                <div>
                  {formOwnerType === 'USER' ? (
                    <FormControl>
                      <FormControl.Label style={{ fontWeight: 'bold' }}>Owner User</FormControl.Label>
                      <UserSearchCombobox
                        value={formOwnerUserId}
                        onChange={(val) => setFormOwnerUserId(val)}
                      />
                    </FormControl>
                  ) : (
                    <FormControl>
                      <FormControl.Label style={{ fontWeight: 'bold' }}>Owner Organization</FormControl.Label>
                      <TeamSearchCombobox
                        value={formOrganizationId}
                        onChange={(val) => setFormOrganizationId(val)}
                      />
                    </FormControl>
                  )}
                </div>
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
