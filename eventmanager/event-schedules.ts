import { randomUUID } from "node:crypto";
import { api, APIError, Header } from "encore.dev/api";
import { prisma } from "./prisma";
import { requireEventPermission } from "../auth/rbac";
import { loadEvent, type EventDetail } from "./events";
import { invalidateEventCaches } from "./cache-utils";

interface AddScheduleParams {
  id: string;
  authorization: Header<"Authorization">;
  title?: string | null;
  startsAt: string;
  endsAt?: string | null;
  location?: string | null;
}

// Adds a schedule slot to an event (issue #4).
export const addEventSchedule = api(
  { expose: true, auth: true, method: "POST", path: "/api/events/:id/schedules" },
  async (params: AddScheduleParams): Promise<EventDetail> => {
    const event = await prisma.event.findUnique({ where: { id: params.id } });
    if (!event) {
      throw APIError.notFound("event not found");
    }
    await requireEventPermission(prisma, {
      authorization: params.authorization,
      eventId: params.id,
      action: "update",
    });

    await prisma.eventSchedule.create({
      data: {
        id: randomUUID(),
        eventId: params.id,
        title: params.title ?? null,
        startsAt: new Date(params.startsAt),
        endsAt: params.endsAt ? new Date(params.endsAt) : null,
        location: params.location ?? null,
      },
    });

    await invalidateEventCaches(params.id);

    return loadEvent(params.id);
  },
);
