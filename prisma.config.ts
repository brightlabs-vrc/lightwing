import { defineConfig, env } from "prisma/config";

const databaseURL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/postgres";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: databaseURL || env("DATABASE_URL"),
  },
  migrations: {
    path: "prisma/migrations",
  },
});
