import { defineConfig, devices } from "@playwright/test";

const PORT = 3217;

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
      NEXT_TELEMETRY_DISABLED: "1",
      GOOGLE_AUTH_ENABLED: "false",
      NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: "false",
    },
  },
});
