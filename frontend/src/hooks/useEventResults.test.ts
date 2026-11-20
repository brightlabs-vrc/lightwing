import { describe, it, expect } from 'vitest'
import { getEligibleRaceMembers } from './useEventResults'
import type { eventmanager } from '../lib/client'

function makeMember(userId: string, rosterRole: string): eventmanager.EventMemberView {
  return {
    userId,
    name: `User ${userId}`,
    classTier: 'G1',
    teamId: 'team-1',
    teamName: 'Team One',
    teamSlug: 'team-one',
    rosterRole,
  }
}

function makeEvent(overrides: Partial<eventmanager.EventDetail>): eventmanager.EventDetail {
  return {
    id: 'evt-1',
    name: 'Test Event',
    description: '',
    bannerUrl: '',
    ownerType: 'USER',
    organizationId: '',
    ownerUserId: 'admin',
    status: 'ONGOING',
    tag: 'OFFICIAL',
    scoringType: 1,
    classRestriction: '',
    granularParticipation: false,
    signupsLocked: false,
    isTeamEvent: true,
    maxPrimaryRosterSize: 2,
    maxBackupRosterSize: 2,
    participantLimit: null,
    maxConcurrentRaceParticipations: null,
    scoringRulesMode: 'STANDARD',
    customScoringTables: null,
    scheduledAt: '',
    createdAt: '',
    updatedAt: '',
    members: [
      makeMember('p1', 'PRIMARY'),
      makeMember('p2', 'PRIMARY'),
      makeMember('b1', 'BACKUP'),
    ],
    teams: [],
    schedules: [],
    raceEvents: [],
    pointsOverview: [],
    teamPointsOverview: [],
    eloOverview: [],
    ...overrides,
  } as unknown as eventmanager.EventDetail
}

function makeRace(members: eventmanager.RaceEventMemberView[] = []): eventmanager.RaceEventDetail {
  return {
    id: 'race-1',
    eventId: 'evt-1',
    name: 'Heat 1',
    sequence: 1,
    distanceMeters: 1600,
    trackType: 'Turf',
    location: 'Tokyo',
    scoringType: 1,
    grade: 'OP',
    classRestriction: '',
    startsAt: '',
    endsAt: '',
    participantLimit: null,
    maxMembersPerTeam: null,
    createdAt: '',
    updatedAt: '',
    members,
  } as unknown as eventmanager.RaceEventDetail
}

describe('getEligibleRaceMembers', () => {
  it('excludes BACKUP roster members on non-granular team events when no explicit race lineup is set', () => {
    const event = makeEvent({ isTeamEvent: true, granularParticipation: false })
    const race = makeRace([])
    const eligible = getEligibleRaceMembers(event, race, [])
    expect(eligible.map((m) => m.userId)).toEqual(['p1', 'p2'])
  })

  it('uses explicit race lineup when populated on non-granular team events', () => {
    const event = makeEvent({ isTeamEvent: true, granularParticipation: false })
    const race = makeRace([makeMember('p1', 'PRIMARY') as unknown as eventmanager.RaceEventMemberView])
    const eligible = getEligibleRaceMembers(event, race, [])
    expect(eligible.map((m) => m.userId)).toEqual(['p1'])
  })

  it('preserves a user with an already-saved result even if later substituted to BACKUP', () => {
    const event = makeEvent({ isTeamEvent: true, granularParticipation: false })
    const race = makeRace([])
    const savedResult = { userId: 'b1', position: 2, points: 6 } as unknown as eventmanager.RaceResultView
    const eligible = getEligibleRaceMembers(event, race, [savedResult])
    expect(eligible.map((m) => m.userId)).toEqual(['p1', 'p2', 'b1'])
  })

  it('uses explicit race members on granular team events', () => {
    const event = makeEvent({ isTeamEvent: true, granularParticipation: true })
    const race = makeRace([makeMember('p2', 'PRIMARY') as unknown as eventmanager.RaceEventMemberView])
    const eligible = getEligibleRaceMembers(event, race, [])
    expect(eligible.map((m) => m.userId)).toEqual(['p2'])
  })

  it('includes all event members on non-granular individual events', () => {
    const event = makeEvent({
      isTeamEvent: false,
      granularParticipation: false,
      members: [makeMember('u1', ''), makeMember('u2', '')],
    })
    const race = makeRace([])
    const eligible = getEligibleRaceMembers(event, race, [])
    expect(eligible.map((m) => m.userId)).toEqual(['u1', 'u2'])
  })
})
