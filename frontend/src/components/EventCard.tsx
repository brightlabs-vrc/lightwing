'use client'

import Link from 'next/link'
import { Heading, Text, Label } from '@primer/react'
import { formatLocalDateTime } from '@/lib/datetime'

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

export function EventCard({ event }: EventCardProps) {
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
          <Label variant="default">{event.status?.toUpperCase() || 'UNKNOWN'}</Label>
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
