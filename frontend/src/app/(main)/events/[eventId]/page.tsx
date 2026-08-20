import { getPublicEvent } from '@/lib/public-api'
import { EventDetailClient } from './EventDetailClient'

interface PageProps {
  params: Promise<{ eventId: string }>
}

export default async function EventDetailPage({ params }: PageProps) {
  const { eventId } = await params

  let event = null
  try {
    event = await getPublicEvent(eventId)
  } catch {
    // If server-side fetch fails (e.g., backend off or mock mode active on client),
    // let client-side useQuery attempt fetch with client-side localStorage/cookies
  }

  return <EventDetailClient initialEvent={event} eventId={eventId} />
}
