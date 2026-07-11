import { randomUUID } from "node:crypto";
import { describe, expect, test, afterEach } from "vitest";
import { prisma } from "./prisma";
import { submitCalc, processQueue } from "./scorecalc";

describe("Scorecalc Service", () => {
  const createdUserIds: string[] = [];
  const createdEventIds: string[] = [];
  const createdRaceEventIds: string[] = [];
  const createdRaceResultIds: string[] = [];
  const createdEventMemberIds: string[] = [];

  afterEach(async () => {
    // Delete only the records created by this test file to avoid interfering with concurrent/other tests
    if (createdEventIds.length > 0) {
      await prisma.scoreCalcTask.deleteMany({ where: { eventId: { in: createdEventIds } } });
      await prisma.eventPointsEntry.deleteMany({ where: { eventId: { in: createdEventIds } } });
    }
    // Delete any manual failed task eventIds we might have inserted
    await prisma.scoreCalcTask.deleteMany({
      where: { eventId: { in: ["non-existent-event-id", "test-fail-event-id"] } },
    });

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

  async function setupTestEvent() {
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

    // Seed Event (scoringType: 1 is points-based)
    await prisma.event.create({
      data: {
        id: eventId,
        name: "Test Points Event",
        ownerType: "USER",
        ownerUserId: userId,
        scoringType: 1,
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

  test("should successfully enqueue work, process queue in FIFO batches, and recompute points", async () => {
    const { userId, eventId, raceId1, raceId2 } = await setupTestEvent();

    // 1. Create race results for the participant
    const resId1 = randomUUID();
    await prisma.raceResult.create({
      data: {
        id: resId1,
        raceEventId: raceId1,
        userId: userId,
        points: 25,
        position: 1,
      },
    });
    createdRaceResultIds.push(resId1);

    const resId2 = randomUUID();
    await prisma.raceResult.create({
      data: {
        id: resId2,
        raceEventId: raceId2,
        userId: userId,
        points: 18,
        position: 2,
      },
    });
    createdRaceResultIds.push(resId2);

    // 2. Submit calculation work to the scorecalc service queue
    await submitCalc({
      eventId: eventId,
      userIds: [userId],
    });

    // 3. Verify task is enqueued in ScoreCalcTask in PENDING status
    const tasks = await prisma.scoreCalcTask.findMany({
      where: { eventId, userId },
    });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].status).toBe("PENDING");

    // 4. Force queue processing (simulating the background process or cron run)
    await processQueue();

    // 5. Verify the task has been marked as COMPLETED
    const updatedTasks = await prisma.scoreCalcTask.findMany({
      where: { eventId, userId },
    });
    expect(updatedTasks).toHaveLength(1);
    expect(updatedTasks[0].status).toBe("COMPLETED");

    // 6. Verify event points are aggregated correctly (25 + 18 = 43)
    const pointsEntry = await prisma.eventPointsEntry.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
    expect(pointsEntry).not.toBeNull();
    expect(pointsEntry?.points).toBe(43);
  });

  test("should implement backoff intervals and stop retrying after 5 failures", async () => {
    const invalidEventId = "non-existent-event-id";
    const invalidUserId = "non-existent-user-id";

    // 1. Enqueue task with non-existent IDs to trigger db foreign key constraints failure on upsert
    await submitCalc({
      eventId: invalidEventId,
      userIds: [invalidUserId],
    });

    let tasks = await prisma.scoreCalcTask.findMany({
      where: { eventId: invalidEventId, userId: invalidUserId },
    });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].status).toBe("PENDING");
    expect(tasks[0].retryCount).toBe(0);

    // --- FAILURE 1 ---
    await processQueue();
    tasks = await prisma.scoreCalcTask.findMany({
      where: { eventId: invalidEventId, userId: invalidUserId },
    });
    expect(tasks[0].status).toBe("PENDING");
    expect(tasks[0].retryCount).toBe(1);
    const delay1 = tasks[0].nextRunAt.getTime() - Date.now();
    expect(delay1).toBeGreaterThan(4000); // 5s backoff
    expect(delay1).toBeLessThan(6000);

    // --- FAILURE 2 ---
    await prisma.scoreCalcTask.update({
      where: { id: tasks[0].id },
      data: { nextRunAt: new Date(Date.now() - 1000) },
    });
    await processQueue();
    tasks = await prisma.scoreCalcTask.findMany({
      where: { eventId: invalidEventId, userId: invalidUserId },
    });
    expect(tasks[0].retryCount).toBe(2);
    const delay2 = tasks[0].nextRunAt.getTime() - Date.now();
    expect(delay2).toBeGreaterThan(9000); // 10s backoff

    // --- FAILURE 3 ---
    await prisma.scoreCalcTask.update({
      where: { id: tasks[0].id },
      data: { nextRunAt: new Date(Date.now() - 1000) },
    });
    await processQueue();
    tasks = await prisma.scoreCalcTask.findMany({
      where: { eventId: invalidEventId, userId: invalidUserId },
    });
    expect(tasks[0].retryCount).toBe(3);
    const delay3 = tasks[0].nextRunAt.getTime() - Date.now();
    expect(delay3).toBeGreaterThan(29000); // 30s backoff

    // --- FAILURE 4 ---
    await prisma.scoreCalcTask.update({
      where: { id: tasks[0].id },
      data: { nextRunAt: new Date(Date.now() - 1000) },
    });
    await processQueue();
    tasks = await prisma.scoreCalcTask.findMany({
      where: { eventId: invalidEventId, userId: invalidUserId },
    });
    expect(tasks[0].retryCount).toBe(4);
    const delay4 = tasks[0].nextRunAt.getTime() - Date.now();
    expect(delay4).toBeGreaterThan(59000); // 60s backoff

    // --- FAILURE 5 (Max limit reached) ---
    await prisma.scoreCalcTask.update({
      where: { id: tasks[0].id },
      data: { nextRunAt: new Date(Date.now() - 1000) },
    });
    await processQueue();
    tasks = await prisma.scoreCalcTask.findMany({
      where: { eventId: invalidEventId, userId: invalidUserId },
    });
    expect(tasks[0].status).toBe("FAILED");
    expect(tasks[0].retryCount).toBe(5);

    // --- Try running again ---
    await prisma.scoreCalcTask.update({
      where: { id: tasks[0].id },
      data: { nextRunAt: new Date(Date.now() - 1000) },
    });
    await processQueue();
    tasks = await prisma.scoreCalcTask.findMany({
      where: { eventId: invalidEventId, userId: invalidUserId },
    });
    // Task should remain in FAILED status, never calculated again
    expect(tasks[0].status).toBe("FAILED");
    expect(tasks[0].retryCount).toBe(5);
  });
});
