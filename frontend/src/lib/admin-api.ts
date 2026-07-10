import { appClient } from './api'
import { MOCK_MODE } from './mock-mode'
import type { auth, eventmanager } from './client'

const now = new Date().toISOString()

let mockEvents: eventmanager.EventDetail[] = [
  {
    id: 'evt_mock_001',
    name: 'Summer Sprint Invitational',
    description: 'Mock event used for admin UI layout testing.',
    ownerType: 'ORGANIZATION',
    organizationId: 'org_mock_urs',
    ownerUserId: null,
    status: 'UNOFFICIAL',
    scoringType: 1,
    scoringTypeLabel: 'Points',
    classRestriction: null,
    raceEvents: [],
    members: [],
    schedules: [],
    pointsOverview: null,
    ladderOverview: null,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'evt_mock_002',
    name: 'Mock Championship Finals',
    description: 'Finals preview event for dashboard prototyping.',
    ownerType: 'USER',
    organizationId: null,
    ownerUserId: 'mock-admin-1',
    status: 'DRAFT',
    scoringType: 2,
    scoringTypeLabel: 'Ladder',
    classRestriction: null,
    raceEvents: [],
    members: [],
    schedules: [],
    pointsOverview: null,
    ladderOverview: null,
    createdAt: now,
    updatedAt: now,
  },
]

const mockUserProfiles = new Map<string, auth.UserProfile>([
  [
    'mock-admin-1',
    {
      id: 'mock-admin-1',
      name: 'Mock Admin',
      email: 'mock-admin@lightwing.local',
      image: null,
      biography: 'Local mock administrator account for frontend-only testing.',
      careerOverview: 'Testing dashboards and admin workflows.',
      classTier: null,
      siteRole: 'SITE_ADMIN',
      teams: [
        {
          organizationId: 'org_mock_urs',
          name: 'URS Mock Team',
          slug: 'urs-mock-team',
          role: 'administrator',
        },
      ],
      createdAt: now,
      updatedAt: now,
    },
  ],
])

export async function listAdminEvents(): Promise<{ events: eventmanager.EventDetail[] }> {
  if (!MOCK_MODE) {
    return appClient.eventmanager.listEvents({})
  }

  return { events: mockEvents }
}

export async function updateAdminEventStatus(
  eventId: string,
  status: eventmanager.EventStatus,
  authorization: string,
): Promise<eventmanager.EventDetail> {
  if (!MOCK_MODE) {
    return appClient.eventmanager.setEventStatus(eventId, {
      authorization,
      status,
    })
  }

  mockEvents = mockEvents.map((event) =>
    event.id === eventId ? { ...event, status, updatedAt: new Date().toISOString() } : event,
  )

  const updated = mockEvents.find((event) => event.id === eventId)
  if (!updated) {
    throw new Error('Mock event not found')
  }

  return updated
}

export async function getAdminUserProfile(userId: string): Promise<auth.UserProfile> {
  if (!MOCK_MODE) {
    return appClient.auth.getUserProfile(userId)
  }

  const existing = mockUserProfiles.get(userId)
  if (existing) {
    return existing
  }

  throw new Error(`User ${userId} was not found in mock records`)
}

export async function updateAdminUserSiteRole(
  userId: string,
  siteRole: auth.SiteRoleName,
  authorization: string,
): Promise<auth.UserProfile> {
  if (!MOCK_MODE) {
    return appClient.auth.setUserSiteRole(userId, {
      authorization,
      siteRole,
    })
  }

  const existing = mockUserProfiles.get(userId)
  if (!existing) {
    throw new Error(`User ${userId} was not found in mock records`)
  }

  const nextRole: auth.SiteRoleName = siteRole === 'SITE_ADMIN' ? 'SITE_ADMIN' : 'USER'
  const updated: auth.UserProfile = {
    ...existing,
    siteRole: nextRole,
    updatedAt: new Date().toISOString(),
  }

  mockUserProfiles.set(userId, updated)
  return updated
}
