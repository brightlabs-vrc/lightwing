import { useAuth } from '../../hooks/useAuth'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { listPublicEvents } from '../../lib/public-api'
import { PaginationBar } from '../../components/Pagination'
import { formatLocalDateTime } from '../../lib/datetime'
import { Heading, Text, Label, Button, Spinner } from '@primer/react'
import type { eventmanager } from '../../lib/client'

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

const STATUS_LABELS: Record<eventmanager.EventStatus, string> = {
  DRAFT: 'Draft',
  UNOFFICIAL: 'Unofficial',
  OFFICIAL: 'Official',
  CONCLUDED: 'Concluded',
}

const STATUS_TONE: Record<eventmanager.EventStatus, 'default' | 'accent' | 'success' | 'severe'> = {
  DRAFT: 'default',
  UNOFFICIAL: 'accent',
  OFFICIAL: 'success',
  CONCLUDED: 'severe',
}

export const Route = createFileRoute('/events/')({
  component: EventsPage,
})

function EventsPage() {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const { data, isLoading, error } = useQuery({
    queryKey: ['public-events', page, pageSize],
    queryFn: () => listPublicEvents(pageSize, (page - 1) * pageSize),
  })

  if (isLoading) {
    return (
      <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <Heading as="h1" style={{ fontSize: '28px', color: 'var(--color-accent-fg)' }}>
          Competitive Events
        </Heading>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem', gap: '0.5rem', color: 'var(--color-fg-muted)' }}>
          <Spinner size="medium" />
          <span>Loading events...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ maxWidth: '640px', margin: '4rem auto', textAlign: 'center' }}>
        <Heading as="h2" style={{ fontSize: '20px', color: 'var(--color-danger-fg)' }}>
          Error loading events
        </Heading>
        <Text style={{ fontSize: '14px', color: 'var(--color-fg-muted)', marginTop: '8px', display: 'block' }}>
          Something went wrong while fetching the event list.
        </Text>
      </div>
    )
  }

  const publicEvents = data?.events.filter((event) => event.status !== 'DRAFT') || []

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <Heading as="h1" style={{ fontSize: '28px', color: 'var(--color-accent-fg)', margin: 0 }}>
          Competitive Events
        </Heading>
        <Label variant="default">{publicEvents.length} ACTIVE</Label>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {publicEvents.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '4rem',
            border: '1px dashed var(--color-border-default)',
            borderRadius: '8px',
            color: 'var(--color-fg-muted)'
          }}>
            <Heading as="h3" style={{ fontSize: '18px', margin: '0 0 8px 0' }}>No public events active</Heading>
            <Text style={{ fontSize: '14px' }}>There are no public events running at this moment.</Text>
          </div>
        ) : (
          <>
            {publicEvents.map((event) => {
              return (
                <Link
                  key={event.id}
                  to="/events/$eventId"
                  params={{ eventId: event.id }}
                  style={{ textDecoration: 'none', display: 'block' }}
                >
                  <div
                    style={{
                      backgroundColor: 'var(--color-canvas-default)',
                      border: '1px solid var(--color-border-default)',
                      borderRadius: '8px',
                      padding: '1.5rem',
                      boxShadow: 'var(--color-shadow-small)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem',
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
                        {STATUS_LABELS[event.status].toUpperCase()}
                      </Label>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <Label variant="default">
                        SCORING: {SCORING_LABELS[event.scoringType]?.toUpperCase() || 'UNKNOWN'}
                      </Label>
                      <Label variant="default">
                        CLASS:{' '}
                        {event.classRestriction && event.classRestriction !== 'PRE_OP' && event.classRestriction !== 'OP'
                          ? CLASS_TIER_LABELS[event.classRestriction as any]
                          : 'OPEN'}
                      </Label>
                      <Label variant="default">RACES: {event.raceCount}</Label>
                      <Label variant="default">MEMBERS: {event.memberCount}</Label>
                    </div>
                  </div>
                </Link>
              )
            })}
            <PaginationBar
              page={page}
              pageSize={pageSize}
              total={data?.total || 0}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </div>
    </div>
  )
}
