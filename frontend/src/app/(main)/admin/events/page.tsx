import { requireSiteAdmin } from '@/lib/auth-guard'
import { listAdminEvents, createAdminEvent } from '@/lib/admin-api'
import { AdminLayout } from '@/components/Admin/AdminLayout'
import { PaginationBar } from '@/components/Pagination'
import type { eventmanager } from '@/lib/client'
import { Heading, Label, Button, Spinner } from '@primer/react'
import Link from 'next/link'

function EventCard({ evt }: { evt: eventmanager.EventListItem }) {
  return (
    <Link href={`/admin/events/${evt.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div
        style={{
          borderBottom: '1px solid var(--color-border-default)',
          padding: '1rem',
          transition: 'background 0.2s',
          marginBottom: '0.5rem',
          borderRadius: '6px',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-canvas-subtle)' }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 'bold', fontSize: '16px' }}>{evt.name}</span>
          <Label variant={evt.status === 'OFFICIAL' ? 'success' : evt.status === 'CONCLUDED' ? 'default' : 'accent'}>
            {evt.status}
          </Label>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--color-fg-muted)', marginTop: '0.5rem' }}>
          Type: {evt.scoringTypeLabel} | Tier: {evt.classRestriction && evt.classRestriction !== 'PRE_OP' && evt.classRestriction !== 'OP' ? evt.classRestriction : 'Any'}
        </div>
      </div>
    </Link>
  )
}

export default async function AdminEventsPage() {
  await requireSiteAdmin()

  const result = await listAdminEvents(undefined, undefined, 10, 0)
  const events: eventmanager.EventListItem[] = result.events
  const total = result.total

  return (
    <AdminLayout>
      <div style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
          <Heading as="h2" style={{ fontSize: '18px', margin: 0 }}>Competition Events</Heading>
          <Link href="/admin/events/new" style={{ textDecoration: 'none' }}>
            <Button variant="primary">Create Event</Button>
          </Link>
        </div>

        {events.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-fg-muted)', border: '1px dashed var(--color-border-default)', borderRadius: '6px' }}>
            <span>No events found.</span>
          </div>
        ) : (
          <>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {events.map((evt) => (
                <li key={evt.id}>
                  <EventCard evt={evt} />
                </li>
              ))}
            </ul>
            <div style={{ marginTop: '1.5rem' }}>
              <PaginationBar page={1} pageSize={10} total={total} onPageChange={() => {}} onPageSizeChange={() => {}} />
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  )
}
