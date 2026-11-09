import { describe, expect, it } from "vitest";
import {
  emailSchema,
  loginPasswordSchema,
  noteBodySchema,
  onboardingSchema,
  otpCodeSchema,
  requiredMessage,
  roomForwardSchema,
  roomInviteFriendsSchema,
  usernameSchema,
  validation,
} from "../../packages/shared/src";
import { z } from "zod";
import { fieldErrors } from "../../apps/web/src/server/http";

const messages = (schema: z.ZodType, input: unknown) => {
  const result = schema.safeParse(input);
  return result.success ? [] : result.error.issues.map((i) => i.message);
};

describe("required messages (the Zod 3 required_error rule)", () => {
  it("shows our message only when the field is missing", () => {
    expect(messages(emailSchema, undefined)).toEqual([validation.emailRequired]);
    expect(messages(otpCodeSchema, undefined)).toEqual([validation.codeInvalid]);
    expect(messages(usernameSchema, undefined)).toEqual([validation.usernameInvalid]);
    expect(messages(noteBodySchema, undefined)).toEqual(["Write something first."]);
    expect(messages(loginPasswordSchema, undefined).length).toBe(1);
  });

  it("leaves Zod's own type message for a value of the wrong type", () => {
    const wrong = messages(emailSchema, 42);
    expect(wrong).toHaveLength(1);
    expect(wrong[0]).not.toBe(validation.emailRequired);
  });

  it("helper returns undefined for any present value so the next message applies", () => {
    const fn = requiredMessage("Say it.");
    expect(fn({ input: undefined })).toBe("Say it.");
    expect(fn({ input: "" })).toBeUndefined();
    expect(fn({ input: 0 })).toBeUndefined();
    expect(fn({})).toBe("Say it.");
  });
});

describe("literal checkbox messages", () => {
  const base = { name: "Ada Obi", username: "ada_obi", ageConfirmed: true, termsAccepted: true };

  it("uses the age and terms messages for false, missing or any other value", () => {
    for (const bad of [false, undefined, "yes", 0]) {
      expect(messages(onboardingSchema, { ...base, ageConfirmed: bad })).toContain(
        validation.ageRequired,
      );
      expect(messages(onboardingSchema, { ...base, termsAccepted: bad })).toContain(
        validation.termsRequired,
      );
    }
    expect(onboardingSchema.safeParse(base).success).toBe(true);
  });
});

describe("email format", () => {
  it("still accepts normal addresses, lowercases and trims, and rejects broken ones", () => {
    expect(emailSchema.parse("  Ada.Obi+gist@Example.NG ")).toBe("ada.obi+gist@example.ng");
    for (const bad of [
      "ada",
      "ada@",
      "@example.com",
      "ada@example",
      "ada obi@example.com",
      "a..b@example.com",
    ]) {
      expect(messages(emailSchema, bad)).toContain(validation.emailInvalid);
    }
  });
});

describe("array length limits stay bounded", () => {
  it("stops at the length check instead of validating every element", () => {
    const huge = Array.from({ length: 1_000_000 }, () => 1);
    for (const [schema, key] of [
      [roomInviteFriendsSchema, "userIds"],
      [roomForwardSchema, "conversationIds"],
    ] as const) {
      const started = Date.now();
      const result = schema.safeParse({ [key]: huge });
      expect(result.success).toBe(false);
      // One too_big issue, not one issue per element.
      expect(result.success ? 0 : result.error.issues.length).toBeLessThanOrEqual(2);
      expect(Date.now() - started).toBeLessThan(1000);
    }
  });

  it("keeps the exact limits", () => {
    const ids = (n: number) => Array.from({ length: n }, (_, i) => `u${i}`);
    expect(roomInviteFriendsSchema.safeParse({ userIds: ids(20) }).success).toBe(true);
    expect(roomInviteFriendsSchema.safeParse({ userIds: ids(21) }).success).toBe(false);
    expect(roomInviteFriendsSchema.safeParse({ userIds: [] }).success).toBe(false);
    expect(roomForwardSchema.safeParse({ conversationIds: ids(10) }).success).toBe(true);
    expect(roomForwardSchema.safeParse({ conversationIds: ids(11) }).success).toBe(false);
  });
});

describe("the shape the client reads", () => {
  it("is one message per dotted path, first issue wins", () => {
    const result = onboardingSchema.safeParse({ name: "", username: "A", ageConfirmed: false });
    expect(result.success).toBe(false);
    if (result.success) return;
    const fields = fieldErrors(result.error);
    expect(Object.keys(fields).sort()).toEqual([
      "ageConfirmed",
      "name",
      "termsAccepted",
      "username",
    ]);
    for (const message of Object.values(fields)) expect(typeof message).toBe("string");
  });
});
