import type { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

export interface RaceResultInput {
  userId: string;
  position?: number | null;
  points?: number | null;
  gateNumber?: number | null;
  finishTime?: string | null;
  margin?: string | null;
  passingOrder?: string | null;
  final3F?: string | null;
}

export function buildRaceResultUpsert(
  raceEventId: string,
  entry: RaceResultInput,
  pointsToPersist: number,
): Prisma.RaceResultUpsertArgs {
  const shared = {
    position: entry.position ?? null,
    points: pointsToPersist,
    gateNumber: entry.gateNumber ?? null,
    finishTime: entry.finishTime ?? null,
    margin: entry.margin ?? null,
    passingOrder: entry.passingOrder ?? null,
    final3F: entry.final3F ?? null,
  };
  return {
    where: { raceEventId_userId: { raceEventId, userId: entry.userId } },
    create: { id: randomUUID(), raceEventId, userId: entry.userId, ...shared },
    update: {
      position: entry.position === undefined ? undefined : entry.position,
      points: pointsToPersist,
      gateNumber: entry.gateNumber === undefined ? undefined : entry.gateNumber,
      finishTime: entry.finishTime === undefined ? undefined : entry.finishTime,
      margin: entry.margin === undefined ? undefined : entry.margin,
      passingOrder: entry.passingOrder === undefined ? undefined : entry.passingOrder,
      final3F: entry.final3F === undefined ? undefined : entry.final3F,
    },
  };
}
