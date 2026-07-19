import { appClient } from './api'
import { MOCK_MODE } from './mock-mode'
import type { auth, eventmanager } from './client'

const now = new Date().toISOString()

// Mock user profile map for public API mock mode
const mockUserProfileMap = new Map<string, auth.UserProfile>([
  ['mock-admin-1', {
    id: 'mock-admin-1',
    name: 'Mock Admin',
    email: 'mock-admin@lightwing.local',
    image: null,
    biography: 'Local mock administrator account for frontend-only testing.',
    careerOverview: 'Testing dashboards and admin workflows.',
    vrchatUsername: null,
    classTier: null,
    siteRole: 'SITE_ADMIN',
    teams: [],
    createdAt: now,
    updatedAt: now,
  }],
  ['mock-user-1', {
    id: 'mock-user-1',
    name: 'Thunder Bolt',
    email: 'bolt@lightwing.local',
    image: null,
    biography: 'A rapid competitor on the turf.',
    careerOverview: 'Sprinting specialist.',
    vrchatUsername: null,
    classTier: 'OP',
    siteRole: 'USER',
    teams: [],
    createdAt: now,
    updatedAt: now,
  }],
  ['mock-user-2', {
    id: 'mock-user-2',
    name: 'Shadow Runner',
    email: 'shadow@lightwing.local',
    image: null,
    biography: 'Silent but swift.',
    careerOverview: 'Distance running.',
    vrchatUsername: null,
    classTier: 'G3',
    siteRole: 'USER',
    teams: [],
    createdAt: now,
    updatedAt: now,
  }],
])

// Mock events for public API - excluding DRAFT events
let mockPublicEvents: eventmanager.EventDetail[] = [
  {
    id: 'evt_mock_001',
    name: 'Summer Sprint Invitational',
    description: 'Mock event used for public UI layout testing.',
    ownerType: 'ORGANIZATION',
    organizationId: 'org_mock_urs',
    ownerUserId: null,
    status: 'UNOFFICIAL',
    scoringType: 1,
    scoringTypeLabel: 'points-based',
    classRestriction: 'OP',
    granularParticipation: true,
    raceEvents: [],
    members: [
      { userId: 'mock-user-1', name: 'Thunder Bolt', classTier: 'OP' },
      { userId: 'mock-user-2', name: 'Shadow Runner', classTier: 'G3' },
    ],
    schedules: [],
    pointsOverview: [
      { userId: 'mock-user-1', name: 'Thunder Bolt', points: 10 },
      { userId: 'mock-user-2', name: 'Shadow Runner', points: 6 },
    ],
    ladderOverview: null,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'evt_mock_003',
    name: 'Archived Championship',
    description: 'A concluded event visible to the public.',
    ownerType: 'USER',
    organizationId: null,
    ownerUserId: 'mock-user-2',
    status: 'CONCLUDED',
    scoringType: 2,
    scoringTypeLabel: 'ladder-elo',
    classRestriction: null,
    granularParticipation: false,
    raceEvents: [],
    members: [],
    schedules: [],
    pointsOverview: null,
    ladderOverview: [],
    createdAt: now,
    updatedAt: now,
  },
]

function getCurrentMockUserId(): string | null {
  if (!MOCK_MODE) return null
  const stored = globalThis.localStorage.getItem('lightwing:mock:session')
  if (!stored) return null
  try {
    const session = JSON.parse(stored) as { user?: { id: string } }
    return session.user?.id ?? null
  } catch {
    return null
  }
}

export async function listPublicEvents(): Promise<{ events: eventmanager.EventDetail[] }> {
  if (!MOCK_MODE) {
    return appClient.eventmanager.listPublicEvents()
  }
  return { events: mockPublicEvents }
}

export async function getPublicEvent(eventId: string): Promise<eventmanager.EventDetail> {
  if (!MOCK_MODE) {
    return appClient.eventmanager.getEvent(eventId)
  }
  const event = mockPublicEvents.find((e) => e.id === eventId)
  if (!event) throw new Error('Event not found')
  return event
}

export async function joinEvent(
  eventId: string,
  authorization: string,
): Promise<eventmanager.EventDetail> {
  if (!MOCK_MODE) {
    return appClient.with({ auth: { authorization } }).eventmanager.joinEvent(eventId, { authorization })
  }

  const eventIndex = mockPublicEvents.findIndex((e) => e.id === eventId)
  if (eventIndex === -1) throw new Error('Event not found')

  const event = mockPublicEvents[eventIndex]
  if (event.status !== 'UNOFFICIAL' && event.status !== 'OFFICIAL') {
    throw new Error('Event is not open for public signup')
  }

  const userId = getCurrentMockUserId()
  if (!userId) throw new Error('Not authenticated')

  const user = mockUserProfileMap.get(userId)
  if (!user) throw new Error('User not found')

  const eventRestriction = event.classRestriction
  const userTier = user.classTier
  if (eventRestriction && userTier !== eventRestriction) {
    throw new Error('Participant class tier does not satisfy the event class restriction')
  }

  const isAlreadyMember = event.members.some((m) => m.userId === userId)
  if (!isAlreadyMember) {
    mockPublicEvents[eventIndex] = {
      ...event,
      members: [...event.members, { userId, name: user.name, classTier: userTier }],
    }
  }

  return mockPublicEvents[eventIndex]
}

export async function leaveEvent(
  eventId: string,
  authorization: string,
): Promise<eventmanager.EventDetail> {
  if (!MOCK_MODE) {
    return appClient.with({ auth: { authorization } }).eventmanager.leaveEvent(eventId, { authorization })
  }

  const eventIndex = mockPublicEvents.findIndex((e) => e.id === eventId)
  if (eventIndex === -1) throw new Error('Event not found')

  const userId = getCurrentMockUserId()
  if (!userId) throw new Error('Not authenticated')

  const event = mockPublicEvents[eventIndex]
  mockPublicEvents[eventIndex] = {
    ...event,
    members: event.members.filter((m) => m.userId !== userId),
  }

  return mockPublicEvents[eventIndex]
}

export async function getMyProfile(userId: string): Promise<auth.UserProfile> {
  if (!MOCK_MODE) {
    return appClient.auth.getUserProfile(userId)
  }
  const user = mockUserProfileMap.get(userId)
  if (!user) throw new Error('User not found')
  return user
}

export async function updateMyProfile(
  userId: string,
  params: {
    name?: string
    biography?: string | null
    careerOverview?: string | null
    vrchatUsername?: string | null
  },
  authorization: string,
): Promise<auth.UserProfile> {
  if (!MOCK_MODE) {
    return appClient.with({ auth: { authorization } }).auth.updateUserProfile(userId, {
      authorization,
      name: params.name,
      biography: params.biography,
      careerOverview: params.careerOverview,
      vrchatUsername: params.vrchatUsername,
    })
  }

  const existing = mockUserProfileMap.get(userId)
  if (!existing) throw new Error('User not found')

  const updated: auth.UserProfile = {
    ...existing,
    name: params.name ?? existing.name,
    biography: params.biography !== undefined ? params.biography : existing.biography,
    careerOverview: params.careerOverview !== undefined ? params.careerOverview : existing.careerOverview,
    vrchatUsername: params.vrchatUsername !== undefined ? params.vrchatUsername : existing.vrchatUsername,
    updatedAt: new Date().toISOString(),
  }

  mockUserProfileMap.set(userId, updated)

  const stored = globalThis.localStorage.getItem('lightwing:mock:session')
  if (stored && params.vrchatUsername !== undefined) {
    try {
      const session = JSON.parse(stored) as any
      session.user.vrchatUsername = params.vrchatUsername
      globalThis.localStorage.setItem('lightwing:mock:session', JSON.stringify(session))
    } catch {
      // ignore
    }
  }

  return updated
}
