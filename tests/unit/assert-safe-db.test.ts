import { describe, expect, it } from "vitest";
// @ts-expect-error plain mjs module without types
import { assertSafe } from "../../scripts/assert-safe-db.mjs";

const url = "postgresql://u:p@db.dev.supabase.co:5432/postgres";

describe("assert-safe-db", () => {
  it("accepts dev and test schemas", () => {
    expect(assertSafe({ DATABASE_SCHEMA: "gistroom_dev", DATABASE_URL: url })).toBeNull();
    expect(assertSafe({ DATABASE_SCHEMA: "gistroom_test", DIRECT_URL: url })).toBeNull();
  });
  it("refuses public, empty or unknown schemas", () => {
    expect(assertSafe({ DATABASE_SCHEMA: "public", DATABASE_URL: url })).not.toBeNull();
    expect(assertSafe({ DATABASE_URL: url })).not.toBeNull();
  });
  it("refuses the production host", () => {
    expect(
      assertSafe({
        DATABASE_SCHEMA: "gistroom_dev",
        DATABASE_URL: url,
        PRODUCTION_DB_HOST: "db.dev.supabase.co",
      }),
    ).not.toBeNull();
  });
});
