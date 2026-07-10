import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { SQLDatabase } from "encore.dev/storage/sqldb";

// Team/organization data lives in the auth-owned database. Like the event
// manager, this service reuses that shared database via SQLDatabase.named:
// Prisma owns the schema/migrations for the whole app, so the same generated
// client exposes the organization models declared in prisma/schema.prisma.
const db = SQLDatabase.named("lightwing");

const adapter = new PrismaPg({
  connectionString: db.connectionString,
});

export const prisma = new PrismaClient({
  adapter,
});
