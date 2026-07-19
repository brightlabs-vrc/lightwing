import { randomUUID } from "node:crypto";
import { api, APIError, Header } from "encore.dev/api";
import { prisma } from "./prisma";
import { requireEventPermission } from "../auth/rbac";

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

interface ListDatasetsParams {
  eventId: string;
}

// Lists datasets scoped by event
export const listDatasets = api(
  { expose: true, method: "GET", path: "/api/events/:eventId/datasets" },
  async ({ eventId }: ListDatasetsParams): Promise<{ datasets: DatasetView[] }> => {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw APIError.notFound("event not found");
    }

    const datasets = await prisma.dataset.findMany({
      where: { eventId },
      orderBy: { createdAt: "desc" },
    });

    return {
      datasets: datasets.map((d) => ({
        id: d.id,
        eventId: d.eventId,
        source: d.source,
        rows: d.rows,
        status: d.status as DatasetStatus,
        importedAt: d.importedAt ? d.importedAt.toISOString() : null,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
      })),
    };
  }
);

interface CreateDatasetParams {
  eventId: string;
  authorization: Header<"Authorization">;
  source: string;
  rows: number;
  status?: DatasetStatus;
}

// Creates a dataset record for an event
export const createDataset = api(
  { expose: true, auth: true, method: "POST", path: "/api/events/:eventId/datasets" },
  async (params: CreateDatasetParams): Promise<DatasetView> => {
    const event = await prisma.event.findUnique({ where: { id: params.eventId } });
    if (!event) {
      throw APIError.notFound("event not found");
    }
    await requireEventPermission(prisma, {
      authorization: params.authorization,
      eventId: params.eventId,
      action: "update",
    });

    const d = await prisma.dataset.create({
      data: {
        id: randomUUID(),
        eventId: params.eventId,
        source: params.source,
        rows: params.rows,
        status: params.status ?? "PENDING",
        importedAt: params.status === "DONE" ? new Date() : null,
      },
    });

    return {
      id: d.id,
      eventId: d.eventId,
      source: d.source,
      rows: d.rows,
      status: d.status as DatasetStatus,
      importedAt: d.importedAt ? d.importedAt.toISOString() : null,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    };
  }
);

interface UpdateDatasetStatusParams {
  eventId: string;
  datasetId: string;
  authorization: Header<"Authorization">;
  status: DatasetStatus;
}

// Updates a dataset record's processing status
export const updateDatasetStatus = api(
  { expose: true, auth: true, method: "PUT", path: "/events/:eventId/datasets/:datasetId/status" },
  async (params: UpdateDatasetStatusParams): Promise<DatasetView> => {
    const event = await prisma.event.findUnique({ where: { id: params.eventId } });
    if (!event) {
      throw APIError.notFound("event not found");
    }
    await requireEventPermission(prisma, {
      authorization: params.authorization,
      eventId: params.eventId,
      action: "update",
    });

    const dataset = await prisma.dataset.findFirst({
      where: { id: params.datasetId, eventId: params.eventId },
    });
    if (!dataset) {
      throw APIError.notFound("dataset not found");
    }

    const now = new Date();
    const importedAt = params.status === "DONE" ? now : dataset.importedAt;

    const d = await prisma.dataset.update({
      where: { id: params.datasetId },
      data: {
        status: params.status,
        importedAt,
      },
    });

    return {
      id: d.id,
      eventId: d.eventId,
      source: d.source,
      rows: d.rows,
      status: d.status as DatasetStatus,
      importedAt: d.importedAt ? d.importedAt.toISOString() : null,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    };
  }
);
