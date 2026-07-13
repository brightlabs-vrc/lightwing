import { randomUUID } from "node:crypto";
import { api, APIError, Header } from "encore.dev/api";
import { prisma } from "./prisma";
import {
  requireEventPermission,
} from "../auth/rbac";

// API-facing string union mirroring the Prisma DatasetStatus enum. Encore's
// schema parser cannot use Prisma's runtime enum object as a type, so this is
// declared as a plain literal union with byte-identical values.
export type DatasetStatus = "PENDING" | "RUNNING" | "DONE" | "FAILED";

export interface DatasetView {
  id: string;
  eventId: string;
  source: string;
  rows: number;
  status: DatasetStatus;
  importedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface EventIdParams {
  eventId: string;
}

interface CreateDatasetParams {
  eventId: string;
  authorization: Header<"Authorization">;
  source: string;
  rows?: number;
}

// Registers a new dataset import record against an event. The dataset starts in
// the PENDING state; the actual ingest pipeline is not yet wired up, so this
// only records the intent to import `source`.
export const createDataset = api(
  { expose: true, auth: true, method: "POST", path: "/events/:eventId/datasets" },
  async (params: CreateDatasetParams): Promise<DatasetView> => {
    await requireEvent(params.eventId);
    await requireEventPermission(prisma, {
      authorization: params.authorization,
      eventId: params.eventId,
      action: "update",
    });

    if (!params.source.trim()) {
      throw APIError.invalidArgument("source is required");
    }

    const dataset = await prisma.dataset.create({
      data: {
        id: randomUUID(),
        eventId: params.eventId,
        source: params.source.trim(),
        rows: params.rows ?? 0,
      },
    });

    return toView(dataset);
  },
);

interface ListDatasetsParams {
  eventId: string;
}

// Lists the dataset import records scoped to a single event, newest first.
export const listDatasets = api(
  { expose: true, method: "GET", path: "/events/:eventId/datasets" },
  async ({ eventId }: ListDatasetsParams): Promise<{ datasets: DatasetView[] }> => {
    await requireEvent(eventId);

    const datasets = await prisma.dataset.findMany({
      where: { eventId },
      orderBy: { createdAt: "desc" },
    });

    return { datasets: datasets.map(toView) };
  },
);

interface DatasetIdParams {
  eventId: string;
  datasetId: string;
}

interface UpdateDatasetStatusParams {
  eventId: string;
  datasetId: string;
  authorization: Header<"Authorization">;
  status: DatasetStatus;
}

// Mutates a dataset's ingest status (e.g. PENDING -> RUNNING -> DONE/FAILED).
// Transitioning to DONE stamps `importedAt`; clearing it resets the timestamp.
export const updateDatasetStatus = api(
  {
    expose: true,
    auth: true,
    method: "PUT",
    path: "/events/:eventId/datasets/:datasetId/status",
  },
  async (params: UpdateDatasetStatusParams): Promise<DatasetView> => {
    await requireEvent(params.eventId);
    await requireEventPermission(prisma, {
      authorization: params.authorization,
      eventId: params.eventId,
      action: "update",
    });

    const existing = await prisma.dataset.findUnique({
      where: { id: params.datasetId },
    });
    if (!existing || existing.eventId !== params.eventId) {
      throw APIError.notFound("dataset not found");
    }

    const dataset = await prisma.dataset.update({
      where: { id: params.datasetId },
      data: {
        status: params.status,
        importedAt:
          params.status === "DONE"
            ? existing.importedAt ?? new Date()
            : params.status === "PENDING"
              ? null
              : existing.importedAt,
      },
    });

    return toView(dataset);
  },
);

interface DeleteDatasetParams {
  eventId: string;
  datasetId: string;
  authorization: Header<"Authorization">;
}

// Deletes a dataset import record from an event.
export const deleteDataset = api(
  {
    expose: true,
    auth: true,
    method: "DELETE",
    path: "/events/:eventId/datasets/:datasetId",
  },
  async ({ eventId, datasetId, authorization }: DeleteDatasetParams): Promise<{ deleted: boolean }> => {
    await requireEvent(eventId);
    await requireEventPermission(prisma, {
      authorization,
      eventId,
      action: "delete",
    });

    const existing = await prisma.dataset.findUnique({ where: { id: datasetId } });
    if (!existing || existing.eventId !== eventId) {
      throw APIError.notFound("dataset not found");
    }

    await prisma.dataset.delete({ where: { id: datasetId } });
    return { deleted: true };
  },
);

async function requireEvent(id: string) {
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) {
    throw APIError.notFound("event not found");
  }
  return event;
}

function toView(dataset: {
  id: string;
  eventId: string;
  source: string;
  rows: number;
  status: DatasetStatus;
  importedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): DatasetView {
  return {
    id: dataset.id,
    eventId: dataset.eventId,
    source: dataset.source,
    rows: dataset.rows,
    status: dataset.status,
    importedAt: dataset.importedAt ? dataset.importedAt.toISOString() : null,
    createdAt: dataset.createdAt.toISOString(),
    updatedAt: dataset.updatedAt.toISOString(),
  };
}
