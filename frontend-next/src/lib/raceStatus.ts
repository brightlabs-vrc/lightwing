import type { eventmanager } from './client'

export const isRaceOngoing = (race: eventmanager.RaceEventDetail): boolean =>
  race.startsAt !== null && race.endsAt === null

export const isRaceConcluded = (race: eventmanager.RaceEventDetail): boolean => race.endsAt !== null

export const isRaceNotStarted = (race: eventmanager.RaceEventDetail): boolean => race.startsAt === null

export const getRaceStatusLabel = (race: eventmanager.RaceEventDetail): 'Live' | 'Done' | 'Ready' => {
  if (isRaceOngoing(race)) return 'Live'
  if (isRaceConcluded(race)) return 'Done'
  return 'Ready'
}
