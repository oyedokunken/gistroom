import { describe, expect, it } from "vitest";
import { BIO_MAX, isValidTimeZone, updateProfileSchema } from "../../packages/shared/src";

describe("profile update", () => {
  it("accepts real time zones and refuses made up ones", () => {
    expect(isValidTimeZone("Africa/Lagos")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    for (const bad of ["Not/AZone", "Lagos", "", "../etc/passwd", "x".repeat(100)]) {
      expect(isValidTimeZone(bad)).toBe(false);
      expect(updateProfileSchema.safeParse({ timezone: bad }).success).toBe(false);
    }
    expect(updateProfileSchema.safeParse({ timezone: "Africa/Lagos" }).success).toBe(true);
  });

  it("takes any subset of the allowed fields", () => {
    expect(updateProfileSchema.safeParse({}).success).toBe(true);
    expect(updateProfileSchema.safeParse({ discoverable: false, dataSaver: true }).success).toBe(
      true,
    );
    expect(updateProfileSchema.safeParse({ roomInvitesFrom: "NOBODY" }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ discoverable: "yes" }).success).toBe(false);
  });

  it("limits the bio and name length", () => {
    expect(updateProfileSchema.safeParse({ bio: "a".repeat(BIO_MAX) }).success).toBe(true);
    expect(updateProfileSchema.safeParse({ bio: "a".repeat(BIO_MAX + 1) }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ name: "a".repeat(200) }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("drops fields that are not part of the profile, so role and email cannot be set", () => {
    const parsed = updateProfileSchema.parse({
      name: "Ada",
      role: "ADMIN",
      email: "x@y.z",
      id: "other",
    });
    expect(parsed).toEqual({ name: "Ada" });
  });
});
