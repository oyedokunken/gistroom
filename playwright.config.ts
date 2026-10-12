import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { loadDotEnv } from "./scripts/assert-safe-db.mjs";

const PORT = 3217;

// With TEST_DATABASE_URL set (in .env or the environment) the browser suites also run signed in against the
// gistroom_test schema. Without it they still run, and the signed in specs skip themselves.
const dotenv = loadDotEnv(path.join(process.cwd(), ".env"));
const testUrl = process.env.TEST_DATABASE_URL ?? dotenv.TEST_DATABASE_URL;
const dbEnv: Record<string, string> = testUrl
  ? {
      DATABASE_URL: testUrl,
      DIRECT_URL: testUrl,
      DATABASE_SCHEMA: "gistroom_test",
      SESSION_SECRET: "e".repeat(48),
      REALTIME_PASS_SECRET: "r".repeat(48),
      INTERNAL_SERVICE_TOKEN: "i".repeat(48),
      CRON_SECRET: "c".repeat(24),
      MAIL_TRANSPORT: "capture",
      MAIL_ALLOWED_DOMAINS: "example.com",
      GOOGLE_MODE: "mock",
      APP_URL: `http://localhost:${PORT}`,
      NEXT_PUBLIC_APP_URL: `http://localhost:${PORT}`,
    }
  : {};
if (testUrl) Object.assign(process.env, { TEST_DATABASE_URL: testUrl, ...dbEnv });

/**
 * Browser, a11y and responsive tests. They run against a production build on its own port and its own build folder (npm run e2e:build),
 * so a dev server you have on port 3000 is left alone and edits made during a run cannot reload the page. No database is needed: public pages show friendly
 * empty states when it is missing, and that is exactly what several tests check.
 */
export default defineConfig({
  testDir: "tests/browser",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  globalSetup: "./tests/browser/global-setup.ts",
  globalTeardown: "./tests/browser/global-teardown.ts",
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices["Desktop Chrome"],
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npm run start:e2e -w apps/web`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: true,
    timeout: 180_000,
    env: {
      ...dbEnv,
      NEXT_TELEMETRY_DISABLED: "1",
      GOOGLE_AUTH_ENABLED: "false",
      NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: "false",
    },
  },
});
