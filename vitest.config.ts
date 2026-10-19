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
    coverage: {
      provider: "v8",
      // Write the report even when a test fails, so a failure never hides the numbers.
      reportOnFailure: true,
      reportsDirectory: "coverage",
      // Floors just under the measured numbers (D90), so a drop fails CI. The whole tree includes UI components that only
      // browser tests exercise, so the server, shared and realtime code carry their own, higher floors.
      thresholds: {
        lines: 32,
        statements: 31,
        branches: 27,
        functions: 25,
        "apps/web/src/server/**": { lines: 79, statements: 76, branches: 63, functions: 78 },
        "packages/shared/src/**": { lines: 87, statements: 86, branches: 81, functions: 82 },
        "apps/realtime/src/**": { lines: 62, statements: 59, branches: 49, functions: 54 },
      },
      reporter: ["text-summary", "json-summary", "lcov", "html"],
      // All application source, so a file no test touches counts as uncovered instead of vanishing from the report.
      include: ["apps/*/src/**/*.{ts,tsx}", "packages/*/src/**/*.{ts,tsx}"],
      exclude: ["**/generated/**", "**/*.test.{ts,tsx}", "**/*.d.ts", "**/node_modules/**"],
    },
    projects: [
      {
        oxc: { jsx: { runtime: "automatic" } },
        test: {
          name: "unit",
          // Coverage instrumentation makes the first import of a big module slow, so the default 5 seconds is not enough.
          testTimeout: 30_000,
          hookTimeout: 30_000,
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
          fileParallelism: false,
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
