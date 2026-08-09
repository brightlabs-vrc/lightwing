import { randomUUID } from "node:crypto";
import { api, APIError } from "encore.dev/api";
import { Topic, Subscription } from "encore.dev/pubsub";
import log from "encore.dev/log";
import { prisma } from "./prisma";
import { StructKeyspace, expireInSeconds } from "encore.dev/storage/cache";
import { cluster } from "../cache";

import {
  scoreCalcRequestedTopic,
  scoreCalcCompletedTopic,
  scoreCalcFailedTopic,
  type ScoreCalcRequested,
  type ScoreCalcCompleted,
  type ScoreCalcFailed,
  type ScoreCalcProjection,
} from "./events";

interface DummyEventDetail {
  id: string;
}

// Duplicate keyspace definition to invalidate event-detail cache across service boundary
const eventDetailCache = new StructKeyspace<{ id: string }, DummyEventDetail>(cluster, {
  keyPattern: "event-detail/:id",
  defaultExpiry: expireInSeconds(120),
});

// Pub/sub topic to report score calculation status.
export interface ScoreCalcStatusEvent {
  eventId: string;
  userIds: string[];
  status: "queued" | "completed" | "failed";
  timestamp: string;
}

export const scoreCalcStatusTopic = new Topic<ScoreCalcStatusEvent>("score-calc-status", {
  deliveryGuarantee: "at-least-once",
});

export interface SubmitCalcParams {
  eventId: string;
  userIds: string[];
}

export interface SubmitCalcResponse {
  jobId: string;
  generation: number;
}

// Submits a request for score calculation for an event.
// Increments generation and publishes ScoreCalcRequested.
export const submitCalc = api(
  { method: "POST", expose: false },
  async (params: SubmitCalcParams): Promise<SubmitCalcResponse> => {
    if (params.userIds.length === 0) {
      throw APIError.invalidArgument("userIds list cannot be empty");
    }

    // 1. Validate event and check scoringType
    const event = await prisma.event.findUnique({
      where: { id: params.eventId },
      select: { id: true, scoringType: true },
    });

    if (!event) {
      throw APIError.notFound(`Event ${params.eventId} not found`);
    }

    if (event.scoringType !== 1) {
      log.info(`Defensively rejecting submitCalc for non-points event ${params.eventId} (scoringType=${event.scoringType})`);
      return { jobId: "no-op", generation: 0 };
    }

    // 2. Coalesce/increment generation and create pending job in transaction
    const { jobId, generation } = await prisma.$transaction(async (tx) => {
      const state = await tx.scoreCalcState.upsert({
        where: { eventId: params.eventId },
        create: {
          eventId: params.eventId,
          latestGeneration: 1,
          acceptedGeneration: 0,
        },
        update: {
          latestGeneration: { increment: 1 },
        },
      });

      const nextGen = state.latestGeneration;
      const id = randomUUID();

      await tx.scoreCalcJob.create({
        data: {
          id,
          eventId: params.eventId,
          generation: nextGen,
          requestedUserIds: params.userIds,
          status: "PENDING",
          attempts: 0,
          requestedAt: new Date(),
        },
      });

      return { jobId: id, generation: nextGen };
    });

    // 3. Publish request event to scorecalc-requested topic
    await scoreCalcRequestedTopic.publish({
      version: 1,
      jobId,
      eventId: params.eventId,
      generation,
      requestedAt: new Date().toISOString(),
    });

    // 4. Report status to public topic
    await scoreCalcStatusTopic.publish({
      eventId: params.eventId,
      userIds: params.userIds,
      status: "queued",
      timestamp: new Date().toISOString(),
    });

    return { jobId, generation };
  }
);

// Subscription handler for completed calculations
export async function handleScoreCalcCompleted(event: ScoreCalcCompleted): Promise<void> {
  const { jobId, eventId, generation, result, resultChecksum } = event;

  log.info(`Received ScoreCalcCompleted message: jobId=${jobId}, eventId=${eventId}, gen=${generation}`);

  try {
    const processed = await prisma.$transaction(async (tx) => {
      const job = await tx.scoreCalcJob.findUnique({
        where: { id: jobId },
      });

      if (!job) {
        log.warn(`Job ${jobId} not found in database. Skipping.`);
        return { success: false };
      }

      if (job.status === "COMPLETED" || job.status === "SUPERSEDED") {
        log.info(`Job ${jobId} is already ${job.status}. Skipping.`);
        return { success: false };
      }

      const state = await tx.scoreCalcState.findUnique({
        where: { eventId },
      });

      if (!state) {
        log.error(`ScoreCalcState not found for event ${eventId}. Skipping.`);
        return { success: false };
      }

      // Fencing check: stale calculation cannot overwrite a newer generation
      if (generation < state.latestGeneration) {
        log.info(`Ignoring stale completion: generation ${generation} is older than latest ${state.latestGeneration}.`);
        await tx.scoreCalcJob.update({
          where: { id: jobId },
          data: { status: "SUPERSEDED" },
        });
        return { success: false };
      }

      // Apply results and update job status
      for (const entry of result.entries) {
        await tx.eventPointsEntry.upsert({
          where: { eventId_userId: { eventId, userId: entry.userId } },
          create: {
            id: randomUUID(),
            eventId,
            userId: entry.userId,
            points: entry.points,
            resultStatus: entry.resultStatus ?? null,
          },
          update: {
            points: entry.points,
            resultStatus: entry.resultStatus ?? null,
          },
        });
      }

      // Update state and job atomically
      await tx.scoreCalcState.update({
        where: { eventId },
        data: { acceptedGeneration: generation },
      });

      await tx.scoreCalcJob.update({
        where: { id: jobId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          resultChecksum,
        },
      });

      const requestedUserIds = job.requestedUserIds as string[] | null;
      return { success: true, userIds: requestedUserIds ?? [] };
    });

    if (processed.success) {
      // Post-commit cache invalidation
      await eventDetailCache.delete({ id: eventId });

      // Publish status event with originally requested userIds
      await scoreCalcStatusTopic.publish({
        eventId,
        userIds: processed.userIds,
        status: "completed",
        timestamp: new Date().toISOString(),
      });
      log.info(`Successfully persisted score projection for jobId=${jobId}`);
    }

  } catch (err: any) {
    log.error(err, `Failed to handle ScoreCalcCompleted for Job ${jobId}`);
    throw err;
  }
}

// Subscription handler for failed calculations
export async function handleScoreCalcFailed(event: ScoreCalcFailed): Promise<void> {
  const { jobId, eventId, generation, errorMessage } = event;

  log.info(`Received ScoreCalcFailed message: jobId=${jobId}, eventId=${eventId}, gen=${generation}`);

  try {
    const processed = await prisma.$transaction(async (tx) => {
      const job = await tx.scoreCalcJob.findUnique({
        where: { id: jobId },
      });

      if (!job) {
        log.warn(`Job ${jobId} not found. Skipping.`);
        return { success: false };
      }

      if (job.status === "COMPLETED" || job.status === "SUPERSEDED") {
        return { success: false };
      }

      const state = await tx.scoreCalcState.findUnique({
        where: { eventId },
      });

      // Ensure stale failures don't regress newer generation's status
      if (state && generation < state.latestGeneration) {
        await tx.scoreCalcJob.update({
          where: { id: jobId },
          data: { status: "SUPERSEDED" },
        });
        return { success: false };
      }

      await tx.scoreCalcJob.update({
        where: { id: jobId },
        data: {
          status: "FAILED",
          lastError: errorMessage,
          completedAt: new Date(),
        },
      });

      const requestedUserIds = job.requestedUserIds as string[] | null;
      return { success: true, userIds: requestedUserIds ?? [] };
    });

    if (processed.success) {
      await scoreCalcStatusTopic.publish({
        eventId,
        userIds: processed.userIds,
        status: "failed",
        timestamp: new Date().toISOString(),
      });
    }

  } catch (err: any) {
    log.error(err, `Failed to handle ScoreCalcFailed for Job ${jobId}`);
    throw err;
  }
}

const _onCompleted = new Subscription(scoreCalcCompletedTopic, "scorecalc-completed-handler", {
  handler: handleScoreCalcCompleted,
});

const _onFailed = new Subscription(scoreCalcFailedTopic, "scorecalc-failed-handler", {
  handler: handleScoreCalcFailed,
});
