import { afterEach, describe, expect, it, vi } from "vitest";
import { requireTestDb, testDbConfigured } from "../helpers/require-test-db";

describe("requireTestDb", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("runs the suite when the test database is configured", () => {
    vi.stubEnv("TEST_DATABASE_URL", "postgresql://u:p@localhost:5432/db");
    vi.stubEnv("DATABASE_SCHEMA", "gistroom_test");
    vi.stubEnv("CI", "true");
    expect(testDbConfigured()).toBe(true);
    expect(requireTestDb()).toBe(true);
  });

  it("skips locally when there is no test database", () => {
    vi.stubEnv("TEST_DATABASE_URL", "");
    vi.stubEnv("DATABASE_SCHEMA", "gistroom_test");
    vi.stubEnv("CI", "");
    expect(requireTestDb()).toBe(false);
  });

  it("skips locally when the schema is not the test schema", () => {
    vi.stubEnv("TEST_DATABASE_URL", "postgresql://u:p@localhost:5432/db");
    vi.stubEnv("DATABASE_SCHEMA", "gistroom_dev");
    vi.stubEnv("CI", "");
    expect(requireTestDb()).toBe(false);
  });

  it("throws in CI instead of skipping when the database is missing", () => {
    vi.stubEnv("TEST_DATABASE_URL", "");
    vi.stubEnv("DATABASE_SCHEMA", "gistroom_test");
    vi.stubEnv("CI", "true");
    expect(() => requireTestDb()).toThrow(/Refusing to skip database suites in CI/);
  });

  it("throws in CI when the schema is wrong", () => {
    vi.stubEnv("TEST_DATABASE_URL", "postgresql://u:p@localhost:5432/db");
    vi.stubEnv("DATABASE_SCHEMA", "public");
    vi.stubEnv("CI", "true");
    expect(() => requireTestDb()).toThrow();
  });
});
