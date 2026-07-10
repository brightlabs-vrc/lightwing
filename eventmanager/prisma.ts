import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { SQLDatabase } from "encore.dev/storage/sqldb";

// The event manager reuses the shared database provisioned by the auth service.
// Prisma owns the schema/migrations for the whole app, so the same generated
// client exposes the event models declared in prisma/schema.prisma.
const db = SQLDatabase.named("lightwing");

const adapter = new PrismaPg({
  connectionString: db.connectionString,
});

export const prisma = new PrismaClient({
  adapter,
});
