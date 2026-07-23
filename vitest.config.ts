import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    alias: {
      "~encore": path.resolve(__dirname, "./encore.gen"),
    },
  },
});
