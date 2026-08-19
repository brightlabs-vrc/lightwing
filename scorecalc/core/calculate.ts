import { createHash } from "node:crypto";
import { type ScoreCalcProjection } from "../events";

export interface RaceResultInputData {
  userId: string;
  points: number;
}

export interface EventScoreInput {
  eventId: string;
  members: string[]; // userIds of event members
  raceResults: RaceResultInputData[];
}

export function calculateEventProjection(input: EventScoreInput): ScoreCalcProjection {
  const pointsMap = new Map<string, number>();

  // Initialize members with 0 points
  for (const userId of input.members) {
    pointsMap.set(userId, 0);
  }

  // Sum points for each user based on race results.
  // DSQ/DNF/DNS is a per-race attribute (stored on race_result) and is NOT
  // aggregated onto the leaderboard — the standings remain points-only.
  for (const res of input.raceResults) {
    const currentPoints = pointsMap.get(res.userId) ?? 0;
    pointsMap.set(res.userId, currentPoints + res.points);
  }

  // Map to entries, sort alphabetically by userId to ensure determinism
  const entries = Array.from(pointsMap.entries()).map(([userId, points]) => ({
    userId,
    points,
  }));

  entries.sort((a, b) => a.userId.localeCompare(b.userId));

  return {
    eventId: input.eventId,
    entries,
  };
}

export function computeChecksum(entries: ScoreCalcProjection["entries"]): string {
  const data = JSON.stringify(entries);
  return createHash("sha256").update(data).digest("hex");
}
