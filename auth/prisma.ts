import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { db } from "../db";

const adapter = new PrismaPg({
  connectionString: db.connectionString,
});

export const prisma = new PrismaClient({
  adapter,
});
