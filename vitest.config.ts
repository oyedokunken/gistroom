import path from "node:path";
import { defineConfig } from "vitest/config";
import { loadDotEnv } from "./scripts/assert-safe-db.mjs";

// Integration and socket tests run against the gistroom_test schema when TEST_DATABASE_URL is set in .env or the environment.
const dotenv = loadDotEnv(path.join(import.meta.dirname, ".env"));
const testUrl = process.env.TEST_DATABASE_URL ?? dotenv.TEST_DATABASE_URL;
const dbEnv = testUrl ? { TEST_DATABASE_URL: testUrl, DATABASE_SCHEMA: "gistroom_test" } : {};

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "apps/web/src") } },
  test: {
    projects: [
      {
        oxc: { jsx: { runtime: "automatic" } },
        test: {
          name: "unit",
          include: [
            "tests/unit/**/*.test.{ts,tsx}",
            "packages/**/src/**/*.test.ts",
            "apps/**/src/**/*.test.ts",
          ],
          environment: "node",
        },
      },
      {
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          env: dbEnv,
          testTimeout: 60_000,
          hookTimeout: 60_000,
        },
      },
      {
        test: {
          name: "socket",
          include: ["tests/socket/**/*.test.ts"],
          environment: "node",
          env: dbEnv,
          testTimeout: 60_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
