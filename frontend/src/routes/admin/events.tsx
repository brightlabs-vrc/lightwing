import { Link, Outlet, createFileRoute, useRouterState } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { requireSiteAdmin } from '../../lib/auth-guard'
import { AdminLayout } from './-AdminLayout'
import { listAdminEvents, createAdminEvent } from '../../lib/admin-api'
import { AlertBanner } from '../../components/AlertBanner'
import { EventScoringTablesEditor } from '../../components/EventScoringTablesEditor'
import type { eventmanager } from '../../lib/client'
import { MOCK_MODE } from '../../lib/mock-mode'
import { DEFAULT_SCORING_TABLES } from '../../lib/scoringDefaults'

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
  const [events, setEvents] = useState<eventmanager.EventDetail[]>([])
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
  const [formClassRestriction, setFormClassRestriction] = useState<string>('OP')
  const [formGranularParticipation, setFormGranularParticipation] = useState(false)
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
      const response = await listAdminEvents()
      setEvents(response.events)
    } catch (cause) {
      setGlobalError(cause instanceof Error ? cause.message : 'Unable to load events')
    } finally {
      setLoadingEvents(false)
    }
  }

  useEffect(() => {
    void loadEvents()
  }, [])

  // Set default values when modal opens or active session changes
  useEffect(() => {
    if (showCreateModal) {
      setFormName('')
      setFormDescription('')
      setFormOwnerType('USER')
      setFormOwnerUserId(activeUserId || 'mock-admin-1')
      setFormOrganizationId(activeOrgId || 'org_mock_urs')
      setFormScoringType(1)
      setFormClassRestriction('OP')
      setFormGranularParticipation(false)
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

    // Strict validation for custom scoring table cells if CUSTOM points rules are selected
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

  return (
    <AdminLayout
      title="Event & Race Operations"
      subtitle="Select a competition event to manage its lifecycle, competitors, race tracks, and results."
      actions={
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => {
              void loadEvents()
            }}
            className="slds-button slds-button_neutral"
            style={{ padding: '4px 12px', fontSize: '12px' }}
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => {
              setShowCreateModal(true)
              setFormError(null)
            }}
            className="slds-button slds-button_brand"
            style={{ padding: '4px 12px', fontSize: '12px' }}
          >
            ➕ Create Event
          </button>
        </div>
      }
    >
      {globalError && (
        <AlertBanner variant="error">{globalError}</AlertBanner>
      )}

      <div className="slds-grid slds-wrap slds-gutters">
        <div className="slds-col slds-size_1-of-1">
          <article className="slds-card" style={{ border: '1px solid #dddbda' }}>
            <div className="slds-card__header slds-grid slds-grid_align-spread" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <header className="slds-media slds-media_center slds-has-flexi-truncate">
                <div className="slds-media__figure" style={{ marginRight: '0.5rem' }}>
                  <span className="slds-icon_container" style={{ fontSize: '18px' }}>🏁</span>
                </div>
                <div className="slds-media__body">
                  <h2 className="slds-card__header-title">
                    <span className="slds-card__header-link slds-truncate font-semibold" style={{ fontWeight: 'bold' }}>
                      Competition Events
                    </span>
                  </h2>
                </div>
              </header>
            </div>

            <div className="slds-card__body" style={{ padding: '0 1rem 1rem 1rem' }}>
              {loadingEvents ? (
                <p className="slds-text-body_small slds-p-around_medium" style={{ color: '#514f4d' }}>Loading events...</p>
              ) : events.length === 0 ? (
                <p className="slds-text-body_small slds-p-around_medium" style={{ color: '#514f4d' }}>No events found.</p>
              ) : (
                <ul className="slds-has-dividers_bottom-space" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                  {events.map((evt) => (
                    <li key={evt.id} className="slds-item slds-p-vertical_small">
                      <Link
                        to="/admin/events/$eventId"
                        params={{ eventId: evt.id }}
                        className="slds-text-link_reset"
                        style={{
                          display: 'block',
                          textDecoration: 'none',
                          borderRadius: '4px',
                          padding: '12px',
                          transition: 'background 0.2s',
                          borderLeft: '4px solid transparent',
                        }}
                      >
                        <div className="slds-grid slds-grid_align-spread" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="slds-text-body_regular font-bold text-slate-900" style={{ fontWeight: 'bold', fontSize: '1rem' }}>{evt.name}</span>
                          <span
                            className={`slds-badge ${
                              evt.status === 'OFFICIAL'
                                ? 'slds-theme_success'
                                : evt.status === 'CONCLUDED'
                                ? 'slds-theme_inverse'
                                : 'slds-theme_light'
                            }`}
                            style={{
                              fontSize: '10px',
                              padding: '2px 8px',
                              borderRadius: '3px',
                              color: evt.status === 'OFFICIAL' ? '#fff' : evt.status === 'CONCLUDED' ? '#fff' : '#000',
                              backgroundColor: evt.status === 'OFFICIAL' ? '#2e7d32' : evt.status === 'CONCLUDED' ? '#180505' : '#e0e0e0',
                            }}
                          >
                            {evt.status}
                          </span>
                        </div>
                        <div className="slds-text-body_small text-slate-500 slds-m-top_xx-small" style={{ fontSize: '12px', display: 'flex', justifyContent: 'space-between' }}>
                          <span>Type: {evt.scoringTypeLabel}</span>
                          <span>Tier: {evt.classRestriction ?? 'Any'}</span>
                          <span>{evt.members.length} participants</span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </article>
        </div>
      </div>

      {/* EVENT CREATION DIALOG MODAL */}
      {showCreateModal && (
        <div className="slds-scope">
          <section role="dialog" tabIndex={-1} aria-modal="true" className="slds-modal slds-fade-in-open" style={{ zIndex: 9001 }}>
            <div className="slds-modal__container" style={{ maxWidth: '40rem', width: '90%' }}>
              <header className="slds-modal__header">
                <button
                  className="slds-button slds-button_icon slds-modal__close"
                  title="Close"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    position: 'absolute',
                    top: '1rem',
                    right: '1.5rem',
                    background: 'transparent',
                    border: 'none',
                    fontSize: '1.25rem',
                    cursor: 'pointer',
                    color: '#747474',
                  }}
                >
                  ✕
                </button>
                <h2 className="slds-modal__title slds-hyphenate font-bold text-slate-900" style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                  Create New Competition Event
                </h2>
              </header>

              <form onSubmit={handleCreateEventSubmit}>
                <div className="slds-modal__content slds-p-around_medium" style={{ background: '#fff' }}>
                  {formError && (
                    <div className="slds-m-bottom_medium">
                      <AlertBanner variant="error">{formError}</AlertBanner>
                    </div>
                  )}

                  <div className="slds-form slds-form_stacked">
                    {/* Event Name */}
                    <div className="slds-form-element slds-m-bottom_medium">
                      <label className="slds-form-element__label font-bold text-slate-700" style={{ fontWeight: 'bold' }} htmlFor="event-name">
                        Event Name <span className="text-red-500">*</span>
                      </label>
                      <div className="slds-form-element__control">
                        <input
                          id="event-name"
                          type="text"
                          required
                          placeholder="e.g. Winter Derby Championship"
                          value={formName}
                          onChange={(e) => setFormName(e.target.value)}
                          className="slds-input"
                          style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px', width: '100%' }}
                        />
                      </div>
                    </div>

                    {/* Description */}
                    <div className="slds-form-element slds-m-bottom_medium">
                      <label className="slds-form-element__label font-bold text-slate-700" style={{ fontWeight: 'bold' }} htmlFor="event-desc">
                        Description
                      </label>
                      <div className="slds-form-element__control">
                        <textarea
                          id="event-desc"
                          placeholder="Brief description of the event details, dates, or format..."
                          value={formDescription}
                          onChange={(e) => setFormDescription(e.target.value)}
                          className="slds-textarea"
                          style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px', width: '100%', minHeight: '80px' }}
                        />
                      </div>
                    </div>

                    {/* Scoring Mode & Tier restriction */}
                    <div className="slds-grid slds-gutters slds-wrap" style={{ display: 'flex', gap: '16px', marginBottom: '1rem' }}>
                      <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2" style={{ flex: 1 }}>
                        <div className="slds-form-element">
                          <label className="slds-form-element__label font-bold text-slate-700" style={{ fontWeight: 'bold' }} htmlFor="scoring-type">
                            Scoring Mode
                          </label>
                          <div className="slds-form-element__control">
                            <select
                              id="scoring-type"
                              value={formScoringType}
                              onChange={(e) => setFormScoringType(Number(e.target.value))}
                              className="slds-select"
                              style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px', width: '100%' }}
                            >
                              <option value={1}>Points Aggregation</option>
                              <option value={2}>Ladder Rating (ELO)</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2" style={{ flex: 1 }}>
                        <div className="slds-form-element">
                          <label className="slds-form-element__label font-bold text-slate-700" style={{ fontWeight: 'bold' }} htmlFor="class-tier">
                            Class Tier Eligibility
                          </label>
                          <div className="slds-form-element__control">
                            <select
                              id="class-tier"
                              value={formClassRestriction}
                              onChange={(e) => setFormClassRestriction(e.target.value)}
                              className="slds-select"
                              style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px', width: '100%' }}
                            >
                              <option value="">Any Tier Eligibility (None)</option>
                              <option value="PRE_OP">PRE_OP</option>
                              <option value="OP">OP</option>
                              <option value="G3">G3</option>
                              <option value="G2">G2</option>
                              <option value="G1">G1</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>

                    {formScoringType === 1 && (
                      <div className="slds-form-element slds-m-bottom_medium" style={{ borderTop: '1px solid #dddbda', paddingTop: '1rem' }}>
                        <label className="slds-form-element__label font-bold text-slate-700" style={{ fontWeight: 'bold' }} htmlFor="create-scoring-rules-mode">
                          Points Scoring Rules Source
                        </label>
                        <div className="slds-form-element__control">
                          <select
                            id="create-scoring-rules-mode"
                            value={formScoringRulesMode}
                            onChange={(e) => setFormScoringRulesMode(e.target.value as 'STANDARD' | 'CUSTOM')}
                            className="slds-select"
                            style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px', width: '100%' }}
                          >
                            <option value="STANDARD">Standard Default Tables</option>
                            <option value="CUSTOM">Custom Event Tables (Configure below)</option>
                          </select>
                        </div>

                        {formScoringRulesMode === 'CUSTOM' && (
                          <div className="slds-m-top_medium">
                            <EventScoringTablesEditor
                              value={formCustomScoringTables}
                              onChange={setFormCustomScoringTables}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Granular Participation Toggle */}
                    <div className="slds-form-element slds-m-bottom_medium" style={{ display: 'flex', alignItems: 'center' }}>
                      <div className="slds-form-element__control">
                        <div className="slds-checkbox">
                          <input
                            type="checkbox"
                            name="options"
                            id="granular-participation"
                            checked={formGranularParticipation}
                            onChange={(e) => setFormGranularParticipation(e.target.checked)}
                            style={{ marginRight: '8px' }}
                          />
                          <label className="slds-checkbox__label font-bold text-slate-700" style={{ fontWeight: 'bold' }} htmlFor="granular-participation">
                            <span className="slds-checkbox_faux"></span>
                            <span className="slds-form-element__label">Enable Granular Per-Race Participation</span>
                          </label>
                        </div>
                        <p className="slds-text-body_small text-slate-500" style={{ fontSize: '11px', margin: '4px 0 0 0' }}>
                          If enabled, participants must be registered separately for each individual race. Otherwise, registrations are event-wide.
                        </p>
                      </div>
                    </div>

                    {/* Owner Parameters */}
                    <div className="slds-grid slds-gutters slds-wrap" style={{ display: 'flex', gap: '16px', marginBottom: '1rem' }}>
                      <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-3" style={{ flex: 1 }}>
                        <div className="slds-form-element">
                          <label className="slds-form-element__label font-bold text-slate-700" style={{ fontWeight: 'bold' }} htmlFor="owner-type">
                            Ownership Type
                          </label>
                          <div className="slds-form-element__control">
                            <select
                              id="owner-type"
                              value={formOwnerType}
                              onChange={(e) => setFormOwnerType(e.target.value as eventmanager.EventOwnerType)}
                              className="slds-select"
                              style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px', width: '100%' }}
                            >
                              <option value="USER">Single User</option>
                              <option value="ORGANIZATION">Organization</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="slds-col slds-size_1-of-1 slds-medium-size_2-of-3" style={{ flex: 2 }}>
                        {formOwnerType === 'USER' ? (
                          <div className="slds-form-element">
                            <label className="slds-form-element__label font-bold text-slate-700" style={{ fontWeight: 'bold' }} htmlFor="owner-user-id">
                              Owner User ID
                            </label>
                            <div className="slds-form-element__control">
                              <input
                                id="owner-user-id"
                                type="text"
                                placeholder="e.g. user_abc123"
                                value={formOwnerUserId}
                                onChange={(e) => setFormOwnerUserId(e.target.value)}
                                className="slds-input"
                                style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px', width: '100%' }}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="slds-form-element">
                            <label className="slds-form-element__label font-bold text-slate-700" style={{ fontWeight: 'bold' }} htmlFor="owner-org-id">
                              Organization ID
                            </label>
                            <div className="slds-form-element__control">
                              <input
                                id="owner-org-id"
                                type="text"
                                placeholder="e.g. org_abc123"
                                value={formOrganizationId}
                                onChange={(e) => setFormOrganizationId(e.target.value)}
                                className="slds-input"
                                style={{ padding: '6px 12px', border: '1px solid #dddbda', borderRadius: '4px', width: '100%' }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <footer className="slds-modal__footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="slds-button slds-button_neutral"
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="slds-button slds-button_brand"
                    disabled={submitting}
                  >
                    {submitting ? 'Creating...' : 'Create Event'}
                  </button>
                </footer>
              </form>
            </div>
          </section>
          <div className="slds-backdrop slds-backdrop_open" style={{ zIndex: 9000 }} />
        </div>
      )}
    </AdminLayout>
  )
}
