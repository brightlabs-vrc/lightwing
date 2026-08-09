import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/e2e/**",
      "**/*.spec.ts",
    ],
    alias: {
      "~encore": path.resolve(__dirname, "./encore.gen"),
    },
  },
});
