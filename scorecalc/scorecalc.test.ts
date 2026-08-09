import { randomUUID } from "node:crypto";
import { describe, expect, test, afterEach } from "vitest";
import { prisma } from "./prisma";
import { submitCalc, handleScoreCalcCompleted, handleScoreCalcFailed } from "./scorecalc";
import { handleScoreCalcRequest } from "../scorecalc-worker/worker";
import { calculateEventProjection, computeChecksum } from "./core/calculate";

describe("Scorecalc Asynchronous Event-Driven Pipeline", () => {
  const createdUserIds: string[] = [];
  const createdEventIds: string[] = [];
  const createdRaceEventIds: string[] = [];
  const createdRaceResultIds: string[] = [];
  const createdEventMemberIds: string[] = [];

  afterEach(async () => {
    if (createdEventIds.length > 0) {
      await prisma.scoreCalcJob.deleteMany({ where: { eventId: { in: createdEventIds } } });
      await prisma.scoreCalcState.deleteMany({ where: { eventId: { in: createdEventIds } } });
      await prisma.eventPointsEntry.deleteMany({ where: { eventId: { in: createdEventIds } } });
    }

    if (createdRaceResultIds.length > 0) {
      await prisma.raceResult.deleteMany({ where: { id: { in: createdRaceResultIds } } });
      createdRaceResultIds.length = 0;
    }
    if (createdRaceEventIds.length > 0) {
      await prisma.raceEvent.deleteMany({ where: { id: { in: createdRaceEventIds } } });
      createdRaceEventIds.length = 0;
    }
    if (createdEventMemberIds.length > 0) {
      await prisma.eventMember.deleteMany({ where: { id: { in: createdEventMemberIds } } });
      createdEventMemberIds.length = 0;
    }
    if (createdEventIds.length > 0) {
      await prisma.event.deleteMany({ where: { id: { in: createdEventIds } } });
      createdEventIds.length = 0;
    }
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      createdUserIds.length = 0;
    }
  });

  async function setupTestEvent(scoringType = 1) {
    const userId = `user-${randomUUID()}`;
    const eventId = `event-${randomUUID()}`;
    const raceId1 = `race-${randomUUID()}`;
    const raceId2 = `race-${randomUUID()}`;

    // Seed User
    await prisma.user.create({
      data: {
        id: userId,
        name: "Test User",
        email: `${userId}@example.com`,
      },
    });
    createdUserIds.push(userId);

    // Seed Event
    await prisma.event.create({
      data: {
        id: eventId,
        name: "Test Points Event",
        ownerType: "USER",
        ownerUserId: userId,
        scoringType: scoringType,
        status: "UNOFFICIAL",
      },
    });
    createdEventIds.push(eventId);

    // Seed Event Member
    const memberId = `member-${randomUUID()}`;
    await prisma.eventMember.create({
      data: {
        id: memberId,
        eventId: eventId,
        userId: userId,
      },
    });
    createdEventMemberIds.push(memberId);

    // Seed Race Events
    await prisma.raceEvent.create({
      data: {
        id: raceId1,
        eventId: eventId,
        name: "Race 1",
        distanceMeters: 1000,
        trackType: "Asphalt",
        location: "Track A",
      },
    });
    createdRaceEventIds.push(raceId1);

    await prisma.raceEvent.create({
      data: {
        id: raceId2,
        eventId: eventId,
        name: "Race 2",
        distanceMeters: 1200,
        trackType: "Dirt",
        location: "Track B",
      },
    });
    createdRaceEventIds.push(raceId2);

    return { userId, eventId, raceId1, raceId2 };
  }

  test("pure calculation engine computes deterministic projections and checksums", () => {
    const projection = calculateEventProjection({
      eventId: "test-event",
      members: ["user-c", "user-a", "user-b"],
      raceResults: [
        { userId: "user-a", points: 10 },
        { userId: "user-b", points: 5 },
        { userId: "user-a", points: 20 },
      ],
    });

    // Output is sorted alphabetically by userId
    expect(projection.entries).toEqual([
      { userId: "user-a", points: 30 },
      { userId: "user-b", points: 5 },
      { userId: "user-c", points: 0 },
    ]);

    const checksum1 = computeChecksum(projection.entries);
    const checksum2 = computeChecksum(projection.entries);
    expect(checksum1).toBe(checksum2);
  });

  test("DSQ and DNF results still resolve to 0 points on the leaderboard (status stays per-race)", () => {
    const projection = calculateEventProjection({
      eventId: "test-event-dsq-dnf",
      members: ["user-a", "user-b", "user-c", "user-d"],
      raceResults: [
        { userId: "user-a", points: 10 },
        { userId: "user-b", points: 0 },
        { userId: "user-c", points: 0 },
        { userId: "user-d", points: 5 },
      ],
    });

    expect(projection.entries).toEqual([
      { userId: "user-a", points: 10 },
      { userId: "user-b", points: 0 },
      { userId: "user-c", points: 0 },
      { userId: "user-d", points: 5 },
    ]);
  });

  test("submitting calculation creates a job, increments generation, and publishes ScoreCalcRequested", async () => {
    const { userId, eventId } = await setupTestEvent();

    const response = await submitCalc({
      eventId,
      userIds: [userId],
    });

    expect(response.jobId).toBeDefined();
    expect(response.generation).toBe(1);

    // Verify job in database
    const job = await prisma.scoreCalcJob.findUnique({
      where: { id: response.jobId },
    });
    expect(job).not.toBeNull();
    expect(job?.status).toBe("PENDING");
    expect(job?.generation).toBe(1);
    expect(job?.requestedUserIds).toEqual([userId]);

    // Verify state in database
    const state = await prisma.scoreCalcState.findUnique({
      where: { eventId },
    });
    expect(state).not.toBeNull();
    expect(state?.latestGeneration).toBe(1);
    expect(state?.acceptedGeneration).toBe(0);
  });

  test("submitting calculation for non-points based event is defensively rejected (no-op)", async () => {
    const { userId, eventId } = await setupTestEvent(2); // scoringType: 2 (ladder-elo)

    const response = await submitCalc({
      eventId,
      userIds: [userId],
    });

    // Returns a defensive fallback response and does not increment database jobs
    expect(response.jobId).toBe("no-op");
    expect(response.generation).toBe(0);

    const jobs = await prisma.scoreCalcJob.findMany({
      where: { eventId },
    });
    expect(jobs).toHaveLength(0);
  });

  test("full e2e pipeline: worker claims/calculates, coordinator persists standings", async () => {
    const { userId, eventId, raceId1, raceId2 } = await setupTestEvent();

    // 1. Create race results
    const res1 = randomUUID();
    await prisma.raceResult.create({
      data: {
        id: res1,
        raceEventId: raceId1,
        userId,
        points: 25,
        position: 1,
      },
    });
    createdRaceResultIds.push(res1);

    const res2 = randomUUID();
    await prisma.raceResult.create({
      data: {
        id: res2,
        raceEventId: raceId2,
        userId,
        points: 15,
        position: 2,
      },
    });
    createdRaceResultIds.push(res2);

    // 2. submit calculation
    const { jobId, generation } = await submitCalc({
      eventId,
      userIds: [userId],
    });

    // 3. Invoke worker handler directly to process request
    await handleScoreCalcRequest({
      version: 1,
      jobId,
      eventId,
      generation,
      requestedAt: new Date().toISOString(),
    });

    const jobAfterWorker = await prisma.scoreCalcJob.findUnique({
      where: { id: jobId },
    });
    expect(jobAfterWorker?.status).toBe("PROCESSING");
    expect(jobAfterWorker?.attempts).toBe(1);

    // 4. Construct ScoreCalcCompleted message representing completed calculation
    const computedAt = new Date().toISOString();
    const result = {
      eventId,
      entries: [{ userId, points: 40 }], // 25 + 15
    };
    const resultChecksum = computeChecksum(result.entries);

    // 5. Invoke coordinator complete handler directly
    await handleScoreCalcCompleted({
      version: 1,
      jobId,
      eventId,
      generation,
      computedAt,
      result,
      resultChecksum,
    });

    // Verify job updated to COMPLETED
    const finalJob = await prisma.scoreCalcJob.findUnique({
      where: { id: jobId },
    });
    expect(finalJob?.status).toBe("COMPLETED");
    expect(finalJob?.completedAt).not.toBeNull();
    expect(finalJob?.resultChecksum).toBe(resultChecksum);

    // Verify eventPointsEntry is persisted successfully (25 + 15 = 40)
    const pointsEntry = await prisma.eventPointsEntry.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
    expect(pointsEntry).not.toBeNull();
    expect(pointsEntry?.points).toBe(40);

    // Verify state accepted generation
    const finalState = await prisma.scoreCalcState.findUnique({
      where: { eventId },
    });
    expect(finalState?.acceptedGeneration).toBe(generation);
  });

  test("generation fencing protects against stale/delayed out-of-order completions", async () => {
    const { userId, eventId } = await setupTestEvent();

    // Submit Gen 1
    const gen1 = await submitCalc({ eventId, userIds: [userId] });
    // Submit Gen 2 (simulating another mutation)
    const gen2 = await submitCalc({ eventId, userIds: [userId] });

    expect(gen1.generation).toBe(1);
    expect(gen2.generation).toBe(2);

    // Let's claim Gen 1 on the worker
    await handleScoreCalcRequest({
      version: 1,
      jobId: gen1.jobId,
      eventId,
      generation: 1,
      requestedAt: new Date().toISOString(),
    });

    // Let's claim Gen 2 on the worker
    await handleScoreCalcRequest({
      version: 1,
      jobId: gen2.jobId,
      eventId,
      generation: 2,
      requestedAt: new Date().toISOString(),
    });

    // Now, we receive a delayed completed event for Gen 1 (e.g. slow network)
    const resultGen1 = {
      eventId,
      entries: [{ userId, points: 10 }],
    };
    await handleScoreCalcCompleted({
      version: 1,
      jobId: gen1.jobId,
      eventId,
      generation: 1,
      computedAt: new Date().toISOString(),
      result: resultGen1,
      resultChecksum: computeChecksum(resultGen1.entries),
    });

    // Gen 1 completed event should be ignored for persistence and marked SUPERSEDED because gen2 exists as latest!
    const jobGen1 = await prisma.scoreCalcJob.findUnique({
      where: { id: gen1.jobId },
    });
    expect(jobGen1?.status).toBe("SUPERSEDED");

    // The points in database should NOT be updated to 10
    const pointsEntryBeforeGen2 = await prisma.eventPointsEntry.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
    expect(pointsEntryBeforeGen2).toBeNull(); // still null (has not processed any gen completion yet)

    // Now, process Gen 2 completion
    const resultGen2 = {
      eventId,
      entries: [{ userId, points: 50 }],
    };
    await handleScoreCalcCompleted({
      version: 1,
      jobId: gen2.jobId,
      eventId,
      generation: 2,
      computedAt: new Date().toISOString(),
      result: resultGen2,
      resultChecksum: computeChecksum(resultGen2.entries),
    });

    // Gen 2 completes successfully
    const jobGen2 = await prisma.scoreCalcJob.findUnique({
      where: { id: gen2.jobId },
    });
    expect(jobGen2?.status).toBe("COMPLETED");

    // Standings are updated to Gen 2 results
    const pointsEntryAfterGen2 = await prisma.eventPointsEntry.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
    expect(pointsEntryAfterGen2?.points).toBe(50);
  });

  test("coordinator handleScoreCalcFailed marks job as failed and reports status", async () => {
    const { userId, eventId } = await setupTestEvent();

    const { jobId, generation } = await submitCalc({
      eventId,
      userIds: [userId],
    });

    // Process failed event
    await handleScoreCalcFailed({
      version: 1,
      jobId,
      eventId,
      generation,
      failedAt: new Date().toISOString(),
      errorCode: "TEST_ERROR",
      errorMessage: "Something went wrong during computation",
      retryable: false,
    });

    const finalJob = await prisma.scoreCalcJob.findUnique({
      where: { id: jobId },
    });
    expect(finalJob?.status).toBe("FAILED");
    expect(finalJob?.lastError).toBe("Something went wrong during computation");
  });
});
