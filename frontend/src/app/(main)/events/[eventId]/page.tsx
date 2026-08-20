import { getPublicEvent } from '@/lib/public-api'
import { formatLocalDateTime } from '@/lib/datetime'
import { Heading, Text, Label, Button, Spinner } from '@primer/react'
import Link from 'next/link'
import { AlertBanner } from '@/components'
import { EventDetailClient } from './EventDetailClient'

const CLASS_TIER_LABELS: Record<string, string> = {
  PRE_OP: 'PRE-OP',
  OP: 'OP',
  G3: 'G3',
  G2: 'G2',
  G1: 'G1',
}

const SCORING_LABELS: Record<number, string> = {
  1: 'POINTS-BASED',
  2: 'LADDER-ELO',
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

interface PageProps {
  params: Promise<{ eventId: string }>
}

export default async function EventDetailPage({ params }: PageProps) {
  const { eventId } = await params

  let event
  try {
    event = await getPublicEvent(eventId)
  } catch {
    return (
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
        <AlertBanner variant="error">Event not found</AlertBanner>
        <Link href="/events" style={{ textDecoration: 'none', marginTop: '1rem', display: 'inline-block' }}>
          <Button>Back to Events</Button>
        </Link>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <Heading as="h1" style={{ fontSize: '28px', fontWeight: 'bold', margin: 0, color: 'var(--color-fg-default)' }}>
            {event.name}
          </Heading>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Label variant={STATUS_TONE[event.status]}>{STATUS_LABELS[event.status]?.toUpperCase()}</Label>
            <Label variant="default">SCORING: {SCORING_LABELS[event.scoringType] || 'UNKNOWN'}</Label>
            {event.classRestriction && event.classRestriction !== 'PRE_OP' && event.classRestriction !== 'OP' && (
              <Label variant="default">CLASS: {CLASS_TIER_LABELS[event.classRestriction] || event.classRestriction}</Label>
            )}
          </div>
          {event.scheduledAt && (
            <Text style={{ fontSize: '14px', color: 'var(--color-attention-fg)' }}>
              SCHEDULED: {formatLocalDateTime(event.scheduledAt)}
            </Text>
          )}
        </div>
      </div>

      {event.description && (
        <Text style={{ fontSize: '16px', color: 'var(--color-fg-muted)', display: 'block' }}>
          {event.description}
        </Text>
      )}

      <EventDetailClient event={event} />
    </div>
  )
}
