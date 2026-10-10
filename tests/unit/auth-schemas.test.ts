import { describe, expect, it } from "vitest";
import {
  emailSchema,
  onboardingSchema,
  otpCodeSchema,
  peopleSearchSchema,
  usernameSchema,
  validation,
} from "../../packages/shared/src";

describe("emailSchema", () => {
  it("trims and lowercases", () => {
    expect(emailSchema.parse("  Kenny@Example.COM ")).toBe("kenny@example.com");
  });
  it("explains what to do", () => {
    const r = emailSchema.safeParse("nope");
    expect(r.success).toBe(false);
    expect(r.success ? "" : r.error.issues[0]?.message).toBe(validation.emailInvalid);
    expect(emailSchema.safeParse("").success).toBe(false);
  });
});

describe("otpCodeSchema", () => {
  it("accepts exactly six digits", () => {
    expect(otpCodeSchema.safeParse("012345").success).toBe(true);
    for (const bad of ["12345", "1234567", "12a456", "", "      "])
      expect(otpCodeSchema.safeParse(bad).success).toBe(false);
  });
});

describe("usernameSchema", () => {
  it("follows the username rules", () => {
    expect(usernameSchema.parse("Kenny_01")).toBe("kenny_01");
    for (const bad of ["ab", "a".repeat(21), "has space", "dash-name", "emoji\u{1F600}"]) {
      expect(usernameSchema.safeParse(bad).success).toBe(false);
    }
  });
  it("blocks reserved words in any case", () => {
    for (const word of ["admin", "Gistroom", "SUPPORT", "settings"]) {
      const r = usernameSchema.safeParse(word);
      expect(r.success).toBe(false);
      expect(r.success ? "" : r.error.issues[0]?.message).toBe(validation.usernameReserved);
    }
  });
});

describe("onboardingSchema", () => {
  const ok = { name: "Kenny", username: "kenny", ageConfirmed: true, termsAccepted: true };
  it("passes with everything confirmed", () => {
    expect(onboardingSchema.safeParse(ok).success).toBe(true);
  });
  it("needs age and terms confirmation with clear messages", () => {
    const r = onboardingSchema.safeParse({ ...ok, ageConfirmed: false, termsAccepted: false });
    expect(r.success).toBe(false);
    const messages = r.success ? [] : r.error.issues.map((i) => i.message);
    expect(messages).toContain(validation.ageRequired);
    expect(messages).toContain(validation.termsRequired);
  });
  it("keeps names to 60 characters", () => {
    expect(onboardingSchema.safeParse({ ...ok, name: "x".repeat(61) }).success).toBe(false);
  });
});

describe("peopleSearchSchema", () => {
  it("needs two characters and a valid page size", () => {
    expect(peopleSearchSchema.safeParse({ q: "a" }).success).toBe(false);
    expect(peopleSearchSchema.parse({ q: " ke " })).toMatchObject({ q: "ke", limit: 20 });
    expect(peopleSearchSchema.safeParse({ q: "ke", limit: 7 }).success).toBe(false);
  });
});
