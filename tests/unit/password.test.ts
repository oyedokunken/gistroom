import { describe, expect, it } from "vitest";
import { levelFor } from "../../apps/web/src/lib/password-strength";
import { safeNext } from "../../apps/web/src/server/auth/google";
import {
  PASSWORD_MAX,
  PASSWORD_MIN,
  loginSchema,
  newPasswordSchema,
  onboardingSchema,
  passwordIssue,
  passwordMessages,
  passwordChecks,
  resetCompleteSchema,
} from "../../packages/shared/src";
import {
  dummyHash,
  hashPassword,
  needsRehash,
  verifyPassword,
} from "../../apps/web/src/server/auth/password";
import {
  accountState,
  isCompleteAccount,
  nextAuthStep,
  isNewDevice,
  passwordRequiredAtOnboarding,
} from "../../apps/web/src/server/auth/rules";

describe("password hashing", () => {
  it("round trips, salts every hash and never stores the password", async () => {
    const a = await hashPassword("correct horse battery");
    const b = await hashPassword("correct horse battery");
    expect(a).not.toBe(b);
    expect(a).not.toContain("correct horse");
    expect(a.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct horse battery", a)).toBe(true);
    expect(await verifyPassword("correct horse batterY", a)).toBe(false);
    expect(await verifyPassword("", a)).toBe(false);
  });
  it("treats composed and decomposed characters as the same password", async () => {
    const h = await hashPassword("café-gist-2026");
    expect(await verifyPassword("café-gist-2026", h)).toBe(true);
  });
  it("returns false for malformed stored values instead of throwing", async () => {
    for (const bad of [
      "",
      "nonsense",
      "scrypt$1$2$3",
      "bcrypt$x$y$z$a$b",
      "scrypt$0$8$1$AAAA$AAAA",
    ]) {
      expect(await verifyPassword("whatever", bad)).toBe(false);
    }
  });
  it("flags hashes that use weaker settings for an upgrade", async () => {
    expect(needsRehash(await hashPassword("some long password"))).toBe(false);
    expect(needsRehash("scrypt$1024$8$1$AAAA$AAAA")).toBe(true);
    expect(needsRehash("legacy$hash")).toBe(true);
  });
  it("has a dummy hash for unknown emails", async () => {
    expect(await verifyPassword("anything", await dummyHash())).toBe(false);
  });
});

describe("password rules", () => {
  it("applies length, repetition and common password rules", () => {
    expect(passwordIssue("a".repeat(PASSWORD_MIN - 1))).toBe("TOO_SHORT");
    expect(passwordIssue("a".repeat(PASSWORD_MAX + 1))).toBe("TOO_LONG");
    expect(passwordIssue("aaaaaaaaaa")).toBe("ONE_CHARACTER");
    expect(passwordIssue("Password123")).toBe("COMMON");
    expect(passwordIssue("a sensible passphrase here")).toBeNull();
  });
  it("refuses the email or the name as the password", () => {
    expect(passwordIssue("kenny@example.com", { email: "kenny@example.com" })).toBe(
      "SAME_AS_EMAIL",
    );
    expect(passwordIssue("kennyoyedokun", { email: "kennyoyedokun@example.com" })).toBe(
      "SAME_AS_EMAIL",
    );
    expect(passwordIssue("Tunde Bakare", { name: "tunde bakare" })).toBe("SAME_AS_NAME");
  });
  it("gives the form the same messages", () => {
    const r = newPasswordSchema.safeParse("short");
    expect(r.success).toBe(false);
    expect(r.success ? "" : r.error.issues[0]?.message).toBe(passwordMessages.TOO_SHORT);
  });
});

describe("auth schemas", () => {
  it("login only needs something to check, not a strong password", () => {
    expect(loginSchema.safeParse({ email: "A@Example.com", password: "x" }).success).toBe(true);
    expect(loginSchema.safeParse({ email: "a@example.com", password: "" }).success).toBe(false);
  });
  it("reset needs the code and a good new password", () => {
    expect(
      resetCompleteSchema.safeParse({
        email: "a@example.com",
        code: "123456",
        password: "a long enough one",
      }).success,
    ).toBe(true);
    expect(
      resetCompleteSchema.safeParse({
        email: "a@example.com",
        code: "12",
        password: "a long enough one",
      }).success,
    ).toBe(false);
    expect(
      resetCompleteSchema.safeParse({ email: "a@example.com", code: "123456", password: "short" })
        .success,
    ).toBe(false);
  });
  it("onboarding takes an optional password that must still be good", () => {
    const base = { name: "Kenny", username: "kenny", ageConfirmed: true, termsAccepted: true };
    expect(onboardingSchema.safeParse(base).success).toBe(true);
    expect(onboardingSchema.safeParse({ ...base, password: "a long enough one" }).success).toBe(
      true,
    );
    expect(onboardingSchema.safeParse({ ...base, password: "short" }).success).toBe(false);
  });
});

describe("account rules", () => {
  it("counts a password, a Google link or a profile as a finished account", () => {
    const none = { passwordHash: null, onboardedAt: null, googleLinked: false };
    expect(isCompleteAccount(none)).toBe(false);
    expect(isCompleteAccount({ ...none, passwordHash: "x" })).toBe(true);
    expect(isCompleteAccount({ ...none, onboardedAt: new Date() })).toBe(true);
    expect(isCompleteAccount({ ...none, googleLinked: true })).toBe(true);
  });
  it("only calls a device new after a first sign in elsewhere", () => {
    expect(isNewDevice([], "Chrome on Windows")).toBe(false);
    expect(isNewDevice(["Chrome on Windows", null], "Chrome on Windows")).toBe(false);
    expect(isNewDevice(["Chrome on Windows"], "Safari on iOS")).toBe(true);
  });
  it("asks Google people for no password at onboarding", () => {
    expect(passwordRequiredAtOnboarding({ googleLinked: false, hasPassword: false })).toBe(true);
    expect(passwordRequiredAtOnboarding({ googleLinked: true, hasPassword: false })).toBe(false);
    expect(passwordRequiredAtOnboarding({ googleLinked: false, hasPassword: true })).toBe(false);
  });
});

describe("account state and the next sign up step", () => {
  const base = { passwordHash: null, onboardedAt: null, googleLinked: false };
  it("names what sign in should do with an email", () => {
    expect(accountState(null)).toBe("NONE");
    expect(accountState(base)).toBe("UNFINISHED");
    expect(accountState({ ...base, passwordHash: "x" })).toBe("PASSWORD");
    expect(accountState({ ...base, googleLinked: true })).toBe("GOOGLE_ONLY");
  });
  it("goes email, password, profile, then done", () => {
    expect(nextAuthStep(base)).toBe("password");
    expect(nextAuthStep({ ...base, passwordHash: "x" })).toBe("onboarding");
    expect(nextAuthStep({ ...base, googleLinked: true })).toBe("onboarding");
    expect(nextAuthStep({ ...base, passwordHash: "x", onboardedAt: new Date() })).toBe("done");
  });
});

describe("password checks and levels", () => {
  it("asks for a mix of letters and a number unless the passphrase is long", () => {
    expect(passwordIssue("alllowercaseonly")).toBeNull();
    expect(passwordIssue("alllower12")).toBe("NEEDS_MIX");
    expect(passwordIssue("Mixed12345")).toBeNull();
    expect(passwordChecks("Mixed1234!").symbol).toBe(true);
    expect(passwordChecks("mixed1234").mixedCase).toBe(false);
  });
  it("rates a password weak, okay or strong from the estimator and the rules", () => {
    const strong = passwordChecks("Tr0ub4dor&3xyz!");
    expect(levelFor(null, true, strong)).toBe("weak");
    expect(levelFor(1, true, strong)).toBe("weak");
    expect(levelFor(4, false, strong)).toBe("weak");
    expect(levelFor(2, true, strong)).toBe("okay");
    expect(levelFor(4, true, strong)).toBe("strong");
    expect(levelFor(3, true, passwordChecks("alllowercaseonlyok"))).toBe("okay");
    expect(levelFor(4, true, passwordChecks("alllowercaseonlyok"))).toBe("strong");
  });
});

describe("the next path after sign in", () => {
  it("only ever keeps a single slash path on this site", () => {
    expect(safeNext("/app/chats")).toBe("/app/chats");
    expect(safeNext("/password?next=%2Fapp%2Fchats")).toBe("/password?next=%2Fapp%2Fchats");
    expect(safeNext("https://evil.example")).toBe("/app/chats");
    expect(safeNext("//evil.example")).toBe("/app/chats");
    expect(safeNext("/\\evil.example")).toBe("/app/chats");
    expect(safeNext("javascript:alert(1)")).toBe("/app/chats");
    expect(safeNext(undefined)).toBe("/app/chats");
    expect(safeNext("")).toBe("/app/chats");
  });
});
