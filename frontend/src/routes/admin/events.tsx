import { Link, Outlet, createFileRoute, useRouterState } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { requireSiteAdmin } from '../../lib/auth-guard'
import { AdminLayout } from './-AdminLayout'
import { listAdminEvents } from '../../lib/admin-api'
import type { eventmanager } from '../../lib/client'

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

  if (!isListRoute) {
    return <Outlet />
  }

  return (
    <AdminLayout
      title="Event & Race Operations"
      subtitle="Select a competition event to manage its lifecycle, competitors, race tracks, and results."
      actions={
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
      }
    >
      {globalError && (
        <div className="slds-notify slds-notify_alert slds-theme_alert-texture slds-theme_error slds-m-bottom_medium" role="alert" style={{ borderRadius: '4px', background: '#d32f2f', color: '#fff', padding: '10px 16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span className="slds-icon_container slds-p-right_small">⚠️</span>
          <h2>{globalError}</h2>
        </div>
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
    </AdminLayout>
  )
}
