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

// Mock results for the mock races
const mockRaceResults: Record<string, eventmanager.RaceResultView[]> = {
  'race_mock_001': [
    {
      id: 'res_mock_001',
      raceEventId: 'race_mock_001',
      userId: 'mock-user-1',
      position: 1,
      points: 10,
      gateNumber: 3,
      finishTime: '1:08.5',
      margin: null,
      passingOrder: '2-2-1',
      final3F: '34.2',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'res_mock_002',
      raceEventId: 'race_mock_001',
      userId: 'mock-user-2',
      position: 2,
      points: 6,
      gateNumber: 5,
      finishTime: '1:08.7',
      margin: '1 1/4',
      passingOrder: '1-1-2',
      final3F: '34.6',
      createdAt: now,
      updatedAt: now,
    },
  ],
  'race_mock_002': [
    {
      id: 'res_mock_003',
      raceEventId: 'race_mock_002',
      userId: 'mock-user-2',
      position: 1,
      points: 10,
      gateNumber: 2,
      finishTime: '1:37.2',
      margin: null,
      passingOrder: '4-3-1',
      final3F: '36.1',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'res_mock_004',
      raceEventId: 'race_mock_002',
      userId: 'mock-user-1',
      position: 2,
      points: 6,
      gateNumber: 8,
      finishTime: '1:37.3',
      margin: 'neck',
      passingOrder: '1-1-2',
      final3F: '36.5',
      createdAt: now,
      updatedAt: now,
    },
  ],
}

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
    raceEvents: [
      {
        id: 'race_mock_001',
        eventId: 'evt_mock_001',
        name: 'Summer Sprint Turf',
        sequence: 1,
        distanceMeters: 1200,
        trackType: 'Turf',
        location: 'Kyoto Racecourse',
        scoringType: 1,
        classRestriction: 'OP',
        startsAt: now,
        endsAt: now,
        createdAt: now,
        updatedAt: now,
        members: [
          { userId: 'mock-user-1', name: 'Thunder Bolt', classTier: 'OP' },
          { userId: 'mock-user-2', name: 'Shadow Runner', classTier: 'G3' },
        ],
      } as any,
      {
        id: 'race_mock_002',
        eventId: 'evt_mock_001',
        name: 'Summer Sprint Dirt',
        sequence: 2,
        distanceMeters: 1600,
        trackType: 'Dirt',
        location: 'Hanshin Racecourse',
        scoringType: 1,
        classRestriction: null,
        startsAt: now,
        endsAt: now,
        createdAt: now,
        updatedAt: now,
        members: [
          { userId: 'mock-user-1', name: 'Thunder Bolt', classTier: 'OP' },
          { userId: 'mock-user-2', name: 'Shadow Runner', classTier: 'G3' },
        ],
      } as any,
    ],
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

export async function listPublicRaceEvents(
  eventId: string,
): Promise<{ races: eventmanager.RaceEventDetail[] }> {
  if (!MOCK_MODE) {
    return appClient.eventmanager.listRaceEvents(eventId)
  }
  const event = mockPublicEvents.find((e) => e.id === eventId)
  if (!event) throw new Error('Event not found')
  return { races: (event.raceEvents ?? []) as eventmanager.RaceEventDetail[] }
}

export async function getPublicRaceResults(
  eventId: string,
  raceId: string,
): Promise<{ results: eventmanager.RaceResultView[] }> {
  if (!MOCK_MODE) {
    return appClient.eventmanager.listRaceResults(eventId, raceId)
  }
  const results = mockRaceResults[raceId] ?? []
  return { results }
}

export async function getPublicRaceEvent(
  eventId: string,
  raceId: string,
): Promise<eventmanager.RaceEventDetail> {
  if (!MOCK_MODE) {
    return appClient.eventmanager.getRaceEvent(eventId, raceId)
  }
  const event = mockPublicEvents.find((e) => e.id === eventId)
  if (!event) throw new Error('Event not found')
  const race = (event.raceEvents as eventmanager.RaceEventDetail[] ?? []).find((r) => r.id === raceId)
  if (!race) throw new Error('Race not found')
  return race
}
