import { describe, expect, it } from "vitest";
import { isSerializationFailure, isUniqueViolation } from "../../apps/web/src/server/db-errors";

describe("database error helpers", () => {
  it("recognises a transaction that could not be serialized", () => {
    expect(isSerializationFailure({ code: "P2034" })).toBe(true);
    expect(isSerializationFailure({ code: "40001" })).toBe(true);
    expect(isSerializationFailure({ meta: { code: "40001" } })).toBe(true);
    expect(
      isSerializationFailure(
        new Error("could not serialize access due to read/write dependencies"),
      ),
    ).toBe(true);
    expect(isSerializationFailure(new Error("something else"))).toBe(false);
    expect(isSerializationFailure({ code: "P2002" })).toBe(false);
    expect(isSerializationFailure(null)).toBe(false);
    expect(isSerializationFailure("40001")).toBe(false);
  });

  it("recognises a unique violation, optionally on one field", () => {
    expect(isUniqueViolation({ code: "P2002" })).toBe(true);
    expect(isUniqueViolation({ code: "P2002", meta: { target: ["email"] } }, "email")).toBe(true);
    expect(isUniqueViolation({ code: "P2002", meta: { target: ["email"] } }, "username")).toBe(
      false,
    );
    expect(isUniqueViolation({ code: "P2002", meta: { target: "User_email_key" } }, "email")).toBe(
      true,
    );
    expect(isUniqueViolation({ code: "P2003" })).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
  });
});
