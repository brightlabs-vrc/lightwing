import { eventDetailCache, publicEventsCache } from './events';
import { PUBLIC_EVENTS_CACHE_KEY } from '../lib/constants';

export async function invalidateEventCaches(eventId: string): Promise<void> {
  await Promise.all([
    eventDetailCache.delete({ id: eventId }),
    publicEventsCache.delete({ key: PUBLIC_EVENTS_CACHE_KEY }),
  ]);
}
