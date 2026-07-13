import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, test } from "vitest";
import { prisma } from "./prisma";
import { createDataset, listDatasets, updateDatasetStatus } from "./datasets";

const createdUserIds: string[] = [];
const createdSessionTokens: string[] = [];
const createdEventIds: string[] = [];
const createdDatasetIds: string[] = [];

async function createUser(prefix: string, name: string, siteRole: "USER" | "SITE_ADMIN" = "USER") {
  const id = `${prefix}-${randomUUID()}`;
  await prisma.user.create({
    data: {
      id,
      name,
      email: `${id}@example.com`,
      siteRole,
    },
  });
  createdUserIds.push(id);
  return id;
}

async function createSession(userId: string) {
  const token = `token-${randomUUID()}`;
  await prisma.session.create({
    data: {
      id: `session-${randomUUID()}`,
      token,
      userId,
      expiresAt: new Date(Date.now() + 60_000 * 60),
    },
  });
  createdSessionTokens.push(token);
  return token;
}

async function createEvent(userId: string, name: string) {
  const id = `event-${randomUUID()}`;
  await prisma.event.create({
    data: {
      id,
      name,
      ownerType: "USER",
      ownerUserId: userId,
      scoringType: 1,
    },
  });
  createdEventIds.push(id);
  return id;
}

afterEach(async () => {
  if (createdDatasetIds.length > 0) {
    await prisma.dataset.deleteMany({ where: { id: { in: createdDatasetIds } } });
    createdDatasetIds.length = 0;
  }

  if (createdEventIds.length > 0) {
    await prisma.event.deleteMany({ where: { id: { in: createdEventIds } } });
    createdEventIds.length = 0;
  }

  if (createdSessionTokens.length > 0) {
    await prisma.session.deleteMany({ where: { token: { in: createdSessionTokens } } });
    createdSessionTokens.length = 0;
  }

  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    createdUserIds.length = 0;
  }
});

describe("datasets endpoints", () => {
  test("create, list, and update dataset status", async () => {
    // 1. Setup user, session, and event
    const userId = await createUser("event-owner", "Event Owner", "SITE_ADMIN");
    const token = await createSession(userId);
    const eventId = await createEvent(userId, "Main Championship");

    // 2. Create a dataset
    const created = await createDataset({
      eventId,
      authorization: `Bearer ${token}`,
      source: "results_test.csv",
      rows: 150,
      status: "PENDING",
    });

    expect(created.id).toBeDefined();
    expect(created.eventId).toBe(eventId);
    expect(created.source).toBe("results_test.csv");
    expect(created.rows).toBe(150);
    expect(created.status).toBe("PENDING");
    createdDatasetIds.push(created.id);

    // 3. List datasets for the event
    const listResult = await listDatasets({ eventId });
    expect(listResult.datasets.length).toBe(1);
    expect(listResult.datasets[0].id).toBe(created.id);

    // 4. Update dataset status
    const updated = await updateDatasetStatus({
      eventId,
      datasetId: created.id,
      authorization: `Bearer ${token}`,
      status: "DONE",
    });

    expect(updated.status).toBe("DONE");
    expect(updated.importedAt).not.toBeNull();

    // Verify it in the list again
    const listResult2 = await listDatasets({ eventId });
    expect(listResult2.datasets[0].status).toBe("DONE");
  });

  test("rejects dataset creation on non-existent event", async () => {
    const userId = await createUser("user", "Regular User", "USER");
    const token = await createSession(userId);

    await expect(
      createDataset({
        eventId: "non-existent-event",
        authorization: `Bearer ${token}`,
        source: "test.csv",
        rows: 10,
      })
    ).rejects.toMatchObject({
      code: "not_found",
    });
  });
});
