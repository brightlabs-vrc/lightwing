import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { SQLDatabase } from "encore.dev/storage/sqldb";

// Reuse the shared database provisioned by the auth/lightwing system.
const db = SQLDatabase.named("lightwing");

const adapter = new PrismaPg({
  connectionString: db.connectionString,
});

export const prisma = new PrismaClient({
  adapter,
});
