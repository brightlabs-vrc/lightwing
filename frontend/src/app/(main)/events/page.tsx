import { listPublicEvents } from '@/lib/public-api'
import { EventsPagination } from '@/components/EventsPagination'
import { EventCard } from '@/components/EventCard'
import { Heading, Label, Text } from '@primer/react'

export default async function EventsPage() {
  const result = await listPublicEvents(10, 0)
  const publicEvents = result.events?.filter((event: any) => event.status !== 'DRAFT') || []
  const total = result.total || 0

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <Heading as="h1" style={{ fontSize: '28px', color: 'var(--color-accent-fg)', margin: 0 }}>
          Competitive Events
        </Heading>
        <Label variant="default">{publicEvents.length} ACTIVE</Label>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {publicEvents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', border: '1px dashed var(--color-border-default)', borderRadius: '8px', color: 'var(--color-fg-muted)' }}>
            <Heading as="h3" style={{ fontSize: '18px', margin: '0 0 8px 0' }}>No public events active</Heading>
            <Text style={{ fontSize: '14px' }}>There are no public events running at this moment.</Text>
          </div>
        ) : (
          publicEvents.map((event) => <EventCard key={event.id} event={event} />)
        )}
      </div>
      <EventsPagination total={total} page={1} pageSize={10} />
    </div>
  )
}
