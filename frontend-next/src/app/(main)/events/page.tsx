import { listPublicEvents } from '@/lib/public-api'
import { EventsPagination } from '@/components/EventsPagination'
import { formatLocalDateTime } from '@/lib/datetime'
import { Heading, Text, Label, Spinner } from '@primer/react'
import Link from 'next/link'

const CLASS_TIER_LABELS: Record<string, string> = {
  PRE_OP: 'PRE-OP',
  OP: 'OP',
  G3: 'G3',
  G2: 'G2',
  G1: 'G1',
}

const SCORING_LABELS: Record<number, string> = {
  1: 'points-based',
  2: 'ladder-elo',
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  UNOFFICIAL: 'Unofficial',
  OFFICIAL: 'Official',
  CONCLUDED: 'Concluded',
}

const STATUS_TONE: Record<string, 'default' | 'accent' | 'success' | 'severe'> = {
  DRAFT: 'default',
  UNOFFICIAL: 'accent',
  OFFICIAL: 'success',
  CONCLUDED: 'severe',
}

interface EventCardProps {
  event: {
    id: string
    name: string
    description: string | null
    scheduledAt: string | null
    status: string
    scoringType: number
    classRestriction: string | null
    raceCount: number
    memberCount: number
  }
}

function EventCard({ event }: EventCardProps) {
  return (
    <Link href={`/events/${event.id}`} style={{ textDecoration: 'none', display: 'block' }}>
      <div
        style={{
          backgroundColor: 'var(--color-canvas-default)',
          border: '1px solid var(--color-border-default)',
          borderRadius: '8px',
          padding: '1.5rem',
          boxShadow: 'var(--color-shadow-small)',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--color-accent-emphasis)'
          e.currentTarget.style.boxShadow = 'var(--color-shadow-medium)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--color-border-default)'
          e.currentTarget.style.boxShadow = 'var(--color-shadow-small)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <Heading as="h2" style={{ fontSize: '20px', fontWeight: 'bold', margin: 0, color: 'var(--color-fg-default)' }}>
              {event.name}
            </Heading>
            {event.scheduledAt && (
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--color-attention-fg)' }}>
                SCHEDULED: {formatLocalDateTime(event.scheduledAt)}
              </span>
            )}
            {event.description && (
              <Text style={{ fontSize: '14px', color: 'var(--color-fg-muted)', marginTop: '4px', display: 'block' }}>
                {event.description}
              </Text>
            )}
          </div>
          <Label variant={STATUS_TONE[event.status]}>
            {STATUS_LABELS[event.status]?.toUpperCase()}
          </Label>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '1rem' }}>
          <Label variant="default">SCORING: {SCORING_LABELS[event.scoringType]?.toUpperCase() || 'UNKNOWN'}</Label>
          <Label variant="default">
            CLASS: {event.classRestriction && event.classRestriction !== 'PRE_OP' && event.classRestriction !== 'OP'
              ? CLASS_TIER_LABELS[event.classRestriction] || 'OPEN'
              : 'OPEN'}
          </Label>
          <Label variant="default">RACES: {event.raceCount}</Label>
          <Label variant="default">MEMBERS: {event.memberCount}</Label>
        </div>
      </div>
    </Link>
  )
}

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
