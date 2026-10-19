/**
 * The one place that decides whether database backed suites run (integration, socket and signed in browser specs).
 *
 * Locally, with no test database configured, they skip so day to day work is not blocked. In CI (CI=true) a missing
 * database is a configuration error, so this throws instead of letting a suite skip and report a green run.
 * Kept free of imports so vitest and Playwright can both load it.
 */
export function testDbConfigured(): boolean {
  return Boolean(process.env.TEST_DATABASE_URL) && process.env.DATABASE_SCHEMA === "gistroom_test";
}

/** Returns true when the suite should run, false when it should skip locally, and throws in CI when the database is missing. */
export function requireTestDb(): boolean {
  if (testDbConfigured()) return true;
  if (process.env.CI === "true") {
    throw new Error(
      "CI is set but no test database is configured. Set TEST_DATABASE_URL and DATABASE_SCHEMA=gistroom_test. Refusing to skip database suites in CI.",
    );
  }
  return false;
}
