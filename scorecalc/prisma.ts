import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { SQLDatabase } from "encore.dev/storage/sqldb";

// The scorecalc service reuses the shared database provisioned by the auth service.
const db = SQLDatabase.named("lightwing");

const adapter = new PrismaPg({
  connectionString: db.connectionString,
});

export const prisma = new PrismaClient({
  adapter,
});
