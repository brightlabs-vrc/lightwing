import { Subscription } from "encore.dev/pubsub";
import log from "encore.dev/log";
import { prisma } from "./prisma";
import { scoreCalcRequestedTopic, scoreCalcCompletedTopic, scoreCalcFailedTopic, type ScoreCalcRequested } from "../scorecalc/events";
import { calculateEventProjection, computeChecksum } from "../scorecalc/core/calculate";

export async function handleScoreCalcRequest(event: ScoreCalcRequested): Promise<void> {
  const jobId = event.jobId;
  const eventId = event.eventId;
  const generation = event.generation;

  log.info(`Received ScoreCalcRequested message: jobId=${jobId}, eventId=${eventId}, gen=${generation}`);

  try {
    // 1. Claim job inside transaction
    const claimResult = await prisma.$transaction(async (tx) => {
      const job = await tx.scoreCalcJob.findUnique({
        where: { id: jobId },
      });

      if (!job) {
        log.warn(`Job ${jobId} not found in database.`);
        return { shouldProceed: false };
      }

      if (job.status === "COMPLETED" || job.status === "SUPERSEDED") {
        log.info(`Job ${jobId} is already ${job.status}. Skipping.`);
        return { shouldProceed: false };
      }

      // Check if generation is superseded
      const state = await tx.scoreCalcState.findUnique({
        where: { eventId: job.eventId },
      });

      if (state && job.generation < state.latestGeneration) {
        log.info(`Job ${jobId} generation ${job.generation} is superseded by latest generation ${state.latestGeneration}.`);
        await tx.scoreCalcJob.update({
          where: { id: jobId },
          data: { status: "SUPERSEDED" },
        });
        return { shouldProceed: false };
      }

      // Only transition pending
      if (job.status !== "PENDING") {
        log.info(`Job ${jobId} is in status ${job.status}. Skipping.`);
        return { shouldProceed: false };
      }

      // Atomically claim the job
      const updatedJob = await tx.scoreCalcJob.update({
        where: { id: jobId },
        data: {
          status: "PROCESSING",
          attempts: job.attempts + 1,
          startedAt: new Date(),
        },
      });

      return { shouldProceed: true, job: updatedJob };
    });

    if (!claimResult.shouldProceed || !claimResult.job) {
      return;
    }

    const job = claimResult.job;

    // 2. Validate event and check scoringType
    const dbEvent = await prisma.event.findUnique({
      where: { id: job.eventId },
      select: { id: true, scoringType: true },
    });

    if (!dbEvent) {
      // Permanent failure: Event not found
      log.error(`Event ${job.eventId} not found for Job ${jobId}. Marking failed.`);
      await prisma.scoreCalcJob.update({
        where: { id: jobId },
        data: {
          status: "FAILED",
          lastError: `Event ${job.eventId} not found.`,
          completedAt: new Date(),
        },
      });

      await scoreCalcFailedTopic.publish({
        version: 1,
        jobId,
        eventId,
        generation,
        failedAt: new Date().toISOString(),
        errorCode: "EVENT_NOT_FOUND",
        errorMessage: `Event ${job.eventId} not found.`,
        retryable: false,
      });
      return;
    }

    if (dbEvent.scoringType !== 1) {
      // Defensively reject non-points based events
      log.info(`Event ${job.eventId} is not points-based (scoringType=${dbEvent.scoringType}). Rejecting job ${jobId}.`);
      await prisma.scoreCalcJob.update({
        where: { id: jobId },
        data: {
          status: "SUPERSEDED",
          lastError: `Rejected: event is not points-based (scoringType=${dbEvent.scoringType})`,
          completedAt: new Date(),
        },
      });
      return;
    }

    // 3. Load canonical source data
    const members = await prisma.eventMember.findMany({
      where: { eventId: job.eventId },
      select: { userId: true },
    });
    const memberUserIds = members.map((m) => m.userId);

    const raceResults = await prisma.raceResult.findMany({
      where: { raceEvent: { eventId: job.eventId } },
      select: { userId: true, points: true },
    });

    // 4. Run calculation
    const projection = calculateEventProjection({
      eventId: job.eventId,
      members: memberUserIds,
      raceResults: raceResults.map((r) => ({
        userId: r.userId,
        points: r.points,
      })),
    });

    const resultChecksum = computeChecksum(projection.entries);

    // 5. Publish completed
    log.info(`Calculation completed for Job ${jobId}, publishing results. Checksum: ${resultChecksum}`);
    await scoreCalcCompletedTopic.publish({
      version: 1,
      jobId,
      eventId: job.eventId,
      generation: job.generation,
      computedAt: new Date().toISOString(),
      result: projection,
      resultChecksum,
    });

  } catch (err: any) {
    log.error(err, `Error processing ScoreCalcRequested for Job ${jobId}`);
    // Throw to let Subscription retry transient errors
    throw err;
  }
}

const _ = new Subscription(scoreCalcRequestedTopic, "scorecalc-worker-requests", {
  handler: handleScoreCalcRequest,
});
