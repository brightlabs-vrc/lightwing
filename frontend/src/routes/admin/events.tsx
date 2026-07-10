import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { requireSiteAdmin } from '../../lib/admin-guard'
import { listAdminEvents, updateAdminEventStatus } from '../../lib/admin-api'
import type { eventmanager } from '../../lib/client'

export const Route = createFileRoute('/admin/events')({
  beforeLoad: async ({ location }) => {
    await requireSiteAdmin(location)
  },
  component: AdminEventsPage,
})

const STATUS_OPTIONS: eventmanager.EventStatus[] = ['DRAFT', 'UNOFFICIAL', 'OFFICIAL', 'CONCLUDED']

function AdminEventsPage() {
  const { session } = useAuth()
  const [events, setEvents] = useState<eventmanager.EventDetail[]>([])
  const [pendingStatus, setPendingStatus] = useState<Record<string, eventmanager.EventStatus>>({})
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const authHeader = useMemo(() => {
    const token = session?.session.token
    return token ? `Bearer ${token}` : null
  }, [session?.session.token])

  async function loadEvents() {
    setLoading(true)
    setError(null)
    try {
      const response = await listAdminEvents()
      setEvents(response.events)
      setPendingStatus(
        Object.fromEntries(response.events.map((event) => [event.id, event.status])) as Record<
          string,
          eventmanager.EventStatus
        >,
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load events')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadEvents()
  }, [])

  async function updateStatus(eventId: string) {
    if (!authHeader) {
      setError('Missing auth session token. Re-authenticate from /auth and try again.')
      return
    }

    const status = pendingStatus[eventId]
    if (!status) {
      return
    }

    setSavingId(eventId)
    setError(null)
    try {
      const updated = await updateAdminEventStatus(eventId, status, authHeader)

      setEvents((current) => current.map((event) => (event.id === updated.id ? updated : event)))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update event status')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <section className='space-y-6'>
      <header className='space-y-2'>
        <h1 className='text-3xl font-bold tracking-tight text-slate-900'>Event Management</h1>
        <p className='text-sm text-slate-600'>
          Review all events and update lifecycle status without leaving the admin dashboard.
        </p>
      </header>

      <div className='rounded-xl border border-slate-200 bg-white p-4 shadow-sm'>
        <div className='mb-4 flex items-center justify-between'>
          <p className='text-sm text-slate-600'>
            Use this panel to move events between draft, unofficial, official, and concluded states.
          </p>
          <button
            type='button'
            onClick={() => {
              void loadEvents()
            }}
            className='rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50'
          >
            Refresh
          </button>
        </div>

        {loading ? <p className='text-sm text-slate-500'>Loading events...</p> : null}
        {error ? <p className='text-sm text-red-700'>{error}</p> : null}

        {!loading && events.length === 0 ? (
          <p className='text-sm text-slate-500'>No events available yet.</p>
        ) : null}

        {!loading && events.length > 0 ? (
          <div className='overflow-x-auto'>
            <table className='min-w-full divide-y divide-slate-200 text-sm'>
              <thead className='bg-slate-50'>
                <tr>
                  <th className='px-3 py-2 text-left font-semibold text-slate-700'>Event</th>
                  <th className='px-3 py-2 text-left font-semibold text-slate-700'>Owner</th>
                  <th className='px-3 py-2 text-left font-semibold text-slate-700'>Current Status</th>
                  <th className='px-3 py-2 text-left font-semibold text-slate-700'>Set Status</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-slate-100 bg-white'>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td className='px-3 py-3'>
                      <div className='font-medium text-slate-900'>{event.name}</div>
                      <div className='text-xs text-slate-500'>{event.id}</div>
                    </td>
                    <td className='px-3 py-3 text-slate-600'>
                      {event.organizationId ?? event.ownerUserId ?? 'n/a'}
                    </td>
                    <td className='px-3 py-3'>
                      <span className='rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700'>
                        {event.status}
                      </span>
                    </td>
                    <td className='px-3 py-3'>
                      <div className='flex items-center gap-2'>
                        <select
                          value={pendingStatus[event.id] ?? event.status}
                          onChange={(evt) =>
                            setPendingStatus((current) => ({
                              ...current,
                              [event.id]: evt.target.value as eventmanager.EventStatus,
                            }))
                          }
                          className='rounded-md border border-slate-300 bg-white px-2 py-1 text-sm'
                        >
                          {STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                        <button
                          type='button'
                          onClick={() => {
                            void updateStatus(event.id)
                          }}
                          disabled={savingId === event.id}
                          className='rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50'
                        >
                          {savingId === event.id ? 'Saving...' : 'Apply'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <Link to='/admin' className='text-sm font-medium text-sky-700 hover:text-sky-800'>
        Back to Admin Dashboard
      </Link>
    </section>
  )
}
