import { requireSiteAdmin } from '@/lib/auth-guard'
import { getAdminEvent } from '@/lib/admin-api'
import { AdminLayout } from '@/components/Admin/AdminLayout'
import { AlertBanner } from '@/components/AlertBanner'
import { Spinner } from '@primer/react'
import type { eventmanager } from '@/lib/client'
import { Heading, Label, Button } from '@primer/react'
import Link from 'next/link'

interface PageProps {
  params: Promise<{ eventId: string }>
}

export default async function AdminEventDetailPage({ params }: PageProps) {
  const { eventId } = await params
  await requireSiteAdmin()

  let event: eventmanager.EventDetail
  try {
    event = await getAdminEvent(eventId)
  } catch {
    return (
      <AdminLayout>
        <div style={{ padding: '2rem' }}>
          <AlertBanner variant="error">Event not found</AlertBanner>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div style={{ padding: '1.5rem' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <Heading as="h2" style={{ fontSize: '20px', marginBottom: '0.5rem' }}>{event.name}</Heading>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Label variant={event.status === 'OFFICIAL' ? 'success' : event.status === 'CONCLUDED' ? 'default' : 'accent'}>
                  {event.status}
                </Label>
                <Label>Type: {event.scoringTypeLabel}</Label>
                {event.classRestriction && (
                  <Label>Tier: {event.classRestriction}</Label>
                )}
              </div>
            </div>
            <Link href="/admin/events" style={{ textDecoration: 'none' }}>
              <Button>Back to Events</Button>
            </Link>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div>
            <Heading as="h3" style={{ fontSize: '16px', marginBottom: '0.75rem' }}>Event Details</Heading>
            <div style={{ fontSize: '14px', color: 'var(--color-fg-muted)' }}>
              {event.description ? (
                <p style={{ whiteSpace: 'pre-wrap' }}>{event.description}</p>
              ) : (
                <p>No description provided.</p>
              )}
              <br />
              <p>Scheduled: {event.scheduledAt ? new Date(event.scheduledAt).toLocaleString() : 'Not scheduled'}</p>
              <p>Participant Limit: {event.participantLimit ?? 'Unlimited'}</p>
              <p>Max Concurrent: {event.maxConcurrentRaceParticipations ?? 'Unlimited'}</p>
              <p>Granular Participation: {event.granularParticipation ? 'Yes' : 'No'}</p>
            </div>
          </div>

          <div>
            <Heading as="h3" style={{ fontSize: '16px', marginBottom: '0.75rem' }}>Quick Actions</Heading>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <Button size="small">Start Race</Button>
              <Button size="small" variant="danger">Delete Event</Button>
            </div>
          </div>
        </div>

        {event.raceEvents && event.raceEvents.length > 0 && (
          <div style={{ marginTop: '2rem' }}>
            <Heading as="h3" style={{ fontSize: '16px', marginBottom: '1rem' }}>Races ({event.raceEvents.length})</Heading>
            <div style={{ border: '1px solid var(--color-border-default)', borderRadius: '6px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--color-canvas-subtle)' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '12px', textTransform: 'uppercase' }}>#</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '12px', textTransform: 'uppercase' }}>Name</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '12px', textTransform: 'uppercase' }}>Distance</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '12px', textTransform: 'uppercase' }}>Track</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '12px', textTransform: 'uppercase' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {event.raceEvents.map((race) => (
                    <tr key={race.id} style={{ borderBottom: '1px solid var(--color-border-default)' }}>
                      <td style={{ padding: '0.75rem' }}>{race.sequence}</td>
                      <td style={{ padding: '0.75rem' }}>{race.name}</td>
                      <td style={{ padding: '0.75rem' }}>{race.distanceMeters}m</td>
                      <td style={{ padding: '0.75rem' }}>{race.trackType}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <Label variant={race.endsAt ? 'success' : 'default'}>
                          {race.endsAt ? 'Completed' : 'Pending'}
                        </Label>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
