import { randomUUID } from "node:crypto";
import { api } from "encore.dev/api";
import { Topic } from "encore.dev/pubsub";
import { CronJob } from "encore.dev/cron";
import { appMeta } from "encore.dev";
import log from "encore.dev/log";
import { prisma } from "./prisma";
import { StructKeyspace, expireInSeconds } from "encore.dev/storage/cache";
import { cluster } from "../cache";

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

// Submits a list of user IDs for score calculation for an event.
// Enqueues them in a FIFO queue table and reports status via pub/sub.
export const submitCalc = api(
  { method: "POST", expose: false },
  async (params: SubmitCalcParams): Promise<void> => {
    if (params.userIds.length === 0) {
      return;
    }

    // 1. Enqueue each calculation request in the FIFO table
    for (const userId of params.userIds) {
      await prisma.scoreCalcTask.create({
        data: {
          id: randomUUID(),
          eventId: params.eventId,
          userId,
          status: "PENDING",
          retryCount: 0,
          nextRunAt: new Date(),
        },
      });
    }

    // 2. Report the score calculation status to the pub/sub topic
    await scoreCalcStatusTopic.publish({
      eventId: params.eventId,
      userIds: params.userIds,
      status: "queued",
      timestamp: new Date().toISOString(),
    });

    // 3. Trigger queue processing in the background (except in tests to prevent race conditions)
    let isTest = false;
    try {
      isTest = appMeta().environment.type === "test";
    } catch {
      // fallback
    }

    if (!isTest) {
      processQueue().catch((err) => {
        log.error(err, "failed to process score calculation queue in background");
      });
    }
  }
);

export const cronProcessQueue = api(
  { expose: false, method: "POST" },
  async (): Promise<void> => {
    await processQueue();
  }
);

const _ = new CronJob("scorecalc-queue-processor", {
  title: "Process pending score calculation tasks",
  every: "1m",
  endpoint: cronProcessQueue,
});

const BATCH_SIZE = 50;

// Processes the pending tasks in the queue in FIFO order (by batches).
export async function processQueue(): Promise<void> {
  while (true) {
    const tasks = await prisma.$transaction(async (tx) => {
      const pendingTasks = await tx.scoreCalcTask.findMany({
        where: {
          status: "PENDING",
          retryCount: { lt: 5 },
          nextRunAt: { lte: new Date() },
        },
        orderBy: { createdAt: "asc" },
        take: BATCH_SIZE,
      });

      if (pendingTasks.length === 0) {
        return [];
      }

      const taskIds = pendingTasks.map((t) => t.id);
      await tx.scoreCalcTask.updateMany({
        where: { id: { in: taskIds } },
        data: { status: "PROCESSING" },
      });

      return pendingTasks;
    });

    if (tasks.length === 0) {
      break;
    }

    for (const task of tasks) {
      try {
        await recomputeEventPointsInternal(task.eventId, task.userId);
        await prisma.scoreCalcTask.update({
          where: { id: task.id },
          data: { status: "COMPLETED" },
        });

        // Publish completed status to pub/sub
        await scoreCalcStatusTopic.publish({
          eventId: task.eventId,
          userIds: [task.userId],
          status: "completed",
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        log.error(err, `Failed to compute points for event ${task.eventId}, user ${task.userId}`);
        const nextRetryCount = task.retryCount + 1;
        if (nextRetryCount >= 5) {
          await prisma.scoreCalcTask.update({
            where: { id: task.id },
            data: {
              status: "FAILED",
              retryCount: nextRetryCount,
            },
          });

          // Publish failed status to pub/sub on final retry failure
          await scoreCalcStatusTopic.publish({
            eventId: task.eventId,
            userIds: [task.userId],
            status: "failed",
            timestamp: new Date().toISOString(),
          });
        } else {
          const delaySeconds = getBackoffDelaySeconds(nextRetryCount);
          const nextRunAt = new Date(Date.now() + delaySeconds * 1000);
          await prisma.scoreCalcTask.update({
            where: { id: task.id },
            data: {
              status: "PENDING",
              retryCount: nextRetryCount,
              nextRunAt,
            },
          });
        }
      }
    }
  }
}

// Maps retry counts (1 to 4) to backoff intervals in seconds (5, 10, 30, 60).
function getBackoffDelaySeconds(retryCount: number): number {
  if (retryCount === 1) return 5;
  if (retryCount === 2) return 10;
  if (retryCount === 3) return 30;
  if (retryCount === 4) return 60;
  return 0;
}

// Recomputes the event-level points aggregate for a participant.
async function recomputeEventPointsInternal(eventId: string, userId: string): Promise<void> {
  const aggregate = await prisma.raceResult.aggregate({
    where: { userId, raceEvent: { eventId } },
    _sum: { points: true },
  });
  const total = aggregate._sum.points ?? 0;

  await prisma.eventPointsEntry.upsert({
    where: { eventId_userId: { eventId, userId } },
    create: { id: randomUUID(), eventId, userId, points: total },
    update: { points: total },
  });

  await eventDetailCache.delete({ id: eventId });
}
