import { SQLDatabase } from "encore.dev/storage/sqldb";

// Encore still provisions the auth database, but Prisma now owns the schema
// and migrations for this service.
export const db = new SQLDatabase("auth");
