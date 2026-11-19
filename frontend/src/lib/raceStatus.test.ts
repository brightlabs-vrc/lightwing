import { describe, expect, it } from 'vitest'
import type { eventmanager } from './client'
import {
  getRaceStatusLabel,
  isRaceConcluded,
  isRaceNotStarted,
  isRaceOngoing,
} from './raceStatus'

// Helper factory function to build a partial RaceEventDetail object
const createRace = (startsAt: string | null, endsAt: string | null): eventmanager.RaceEventDetail =>
  ({
    id: 'race-1',
    eventId: 'event-1',
    name: 'Test Race',
    orderIndex: 1,
    startsAt,
    endsAt,
    track: 'Grand Prix',
    laps: 10,
    maxParticipants: 20,
    members: [],
    results: [],
  }) as unknown as eventmanager.RaceEventDetail

describe('raceStatus utility functions', () => {
  describe('isRaceOngoing', () => {
    it('returns true when race has started (startsAt is not null) and has not ended (endsAt is null)', () => {
      const race = createRace('2025-01-01T10:00:00Z', null)
      expect(isRaceOngoing(race)).toBe(true)
    })

    it('returns false when race has not started (startsAt is null)', () => {
      const race = createRace(null, null)
      expect(isRaceOngoing(race)).toBe(false)
    })

    it('returns false when race has ended (endsAt is not null)', () => {
      const race = createRace('2025-01-01T10:00:00Z', '2025-01-01T11:00:00Z')
      expect(isRaceOngoing(race)).toBe(false)
    })
  })

  describe('isRaceConcluded', () => {
    it('returns true when race has ended (endsAt is not null)', () => {
      const race = createRace('2025-01-01T10:00:00Z', '2025-01-01T11:00:00Z')
      expect(isRaceConcluded(race)).toBe(true)
    })

    it('returns false when endsAt is null', () => {
      const raceNotStarted = createRace(null, null)
      const raceOngoing = createRace('2025-01-01T10:00:00Z', null)
      expect(isRaceConcluded(raceNotStarted)).toBe(false)
      expect(isRaceConcluded(raceOngoing)).toBe(false)
    })
  })

  describe('isRaceNotStarted', () => {
    it('returns true when race has not started (startsAt is null)', () => {
      const race = createRace(null, null)
      expect(isRaceNotStarted(race)).toBe(true)
    })

    it('returns false when race has started (startsAt is not null)', () => {
      const raceOngoing = createRace('2025-01-01T10:00:00Z', null)
      const raceConcluded = createRace('2025-01-01T10:00:00Z', '2025-01-01T11:00:00Z')
      expect(isRaceNotStarted(raceOngoing)).toBe(false)
      expect(isRaceNotStarted(raceConcluded)).toBe(false)
    })
  })

  describe('getRaceStatusLabel', () => {
    it('returns "Live" when race is ongoing', () => {
      const race = createRace('2025-01-01T10:00:00Z', null)
      expect(getRaceStatusLabel(race)).toBe('Live')
    })

    it('returns "Done" when race is concluded', () => {
      const race = createRace('2025-01-01T10:00:00Z', '2025-01-01T11:00:00Z')
      expect(getRaceStatusLabel(race)).toBe('Done')
    })

    it('returns "Ready" when race has not started and is not concluded', () => {
      const race = createRace(null, null)
      expect(getRaceStatusLabel(race)).toBe('Ready')
    })

    it('returns "Done" if endsAt is set even if startsAt is null', () => {
      const race = createRace(null, '2025-01-01T11:00:00Z')
      expect(getRaceStatusLabel(race)).toBe('Done')
    })
  })
})
