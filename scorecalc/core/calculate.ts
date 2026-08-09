import { createHash } from "node:crypto";
import { type ScoreCalcProjection } from "../events";

export interface RaceResultInputData {
  userId: string;
  points: number;
  resultStatus: string | null;
}

export interface EventScoreInput {
  eventId: string;
  members: string[]; // userIds of event members
  raceResults: RaceResultInputData[];
}

export function calculateEventProjection(input: EventScoreInput): ScoreCalcProjection {
  const pointsMap = new Map<string, number>();
  const statusMap = new Map<string, string | null>();

  // Initialize members with 0 points and no result status
  for (const userId of input.members) {
    pointsMap.set(userId, 0);
    statusMap.set(userId, null);
  }

  // Sum points for each user based on race results
  // Track result status: if a user has DSQ or DNF in any race, that status
  // is carried through to the projection entry.
  for (const res of input.raceResults) {
    const currentPoints = pointsMap.get(res.userId) ?? 0;
    pointsMap.set(res.userId, currentPoints + res.points);

    if (res.resultStatus === "DSQ" || res.resultStatus === "DNF") {
      statusMap.set(res.userId, res.resultStatus);
    }
  }

  // Map to entries, sort alphabetically by userId to ensure determinism
  const entries = Array.from(pointsMap.entries()).map(([userId, points]) => ({
    userId,
    points,
    resultStatus: statusMap.get(userId) ?? null,
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
