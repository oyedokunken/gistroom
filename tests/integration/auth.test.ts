import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prepareTestEnv, resetTestDb, testDbEnabled, testEmail } from "../helpers/db";

prepareTestEnv();

// Imported lazily so that a skipped run never loads the database client.
async function load() {
  const [otp, google, mail, db] = await Promise.all([
    import("../../apps/web/src/server/auth/otp-service"),
    import("../../apps/web/src/server/auth/google-service"),
    import("../../apps/web/src/server/mail/transport"),
    import("@gistroom/db"),
  ]);
  return { ...otp, ...google, captured: mail.capturedMail, db: db.getDb() };
}

function lastCode(captured: { to: string; text: string }[], to: string): string {
  const msg = [...captured].reverse().find((m) => m.to === to);
  const match = /Your code: (\d{6})/.exec(msg?.text ?? "");
  if (!match?.[1]) throw new Error("no code captured");
  return match[1];
}

describe.skipIf(!testDbEnabled)("email OTP flow", () => {
  let m: Awaited<ReturnType<typeof load>>;
  beforeAll(async () => {
    m = await load();
  });
  beforeEach(async () => {
    await resetTestDb();
    m.captured.length = 0;
  });
  afterAll(async () => {
    await resetTestDb();
  });

  it("creates the account on first verification and reuses it after", async () => {
    const email = testEmail("a");
    await m.requestOtp(email, "10.0.0.1");
    const first = await m.verifyOtp(email, lastCode(m.captured, email), "10.0.0.1");
    expect(first.isNew).toBe(true);
    expect(first.user.onboardedAt).toBeNull();
    expect(first.user.emailVerifiedAt).not.toBeNull();

    // The cooldown is 60 seconds, so age the challenge instead of waiting.
    await m.db.otpChallenge.updateMany({ data: { lastSentAt: new Date(Date.now() - 120_000) } });
    await m.requestOtp(email, "10.0.0.1");
    const second = await m.verifyOtp(email, lastCode(m.captured, email), "10.0.0.1");
    expect(second.isNew).toBe(false);
    expect(second.user.id).toBe(first.user.id);
  });

  it("uses the sign in template for a known email and never reveals it in the response", async () => {
    const email = testEmail("b");
    const r1 = await m.requestOtp(email, "10.0.0.2");
    await m.verifyOtp(email, lastCode(m.captured, email), "10.0.0.2");
    await m.db.otpChallenge.updateMany({ data: { lastSentAt: new Date(Date.now() - 120_000) } });
    const r2 = await m.requestOtp(email, "10.0.0.2");
    expect(r1).toEqual(r2);
  });

  it("enforces the 60 second resend cooldown", async () => {
    const email = testEmail("c");
    await m.requestOtp(email, "10.0.0.3");
    await expect(m.requestOtp(email, "10.0.0.3")).rejects.toMatchObject({ status: 429 });
  });

  it("locks after five wrong codes and the lock survives asking for a new code", async () => {
    const email = testEmail("d");
    await m.requestOtp(email, "10.0.0.4");
    const right = lastCode(m.captured, email);
    const wrong = right === "000000" ? "111111" : "000000";
    for (let i = 0; i < 4; i += 1) {
      await expect(m.verifyOtp(email, wrong, "10.0.0.4")).rejects.toMatchObject({ status: 400 });
    }
    await expect(m.verifyOtp(email, wrong, "10.0.0.4")).rejects.toMatchObject({ status: 429 });
    await expect(m.verifyOtp(email, right, "10.0.0.4")).rejects.toMatchObject({ status: 429 });
    await m.db.otpChallenge.updateMany({ data: { lastSentAt: new Date(Date.now() - 120_000) } });
    await expect(m.requestOtp(email, "10.0.0.4")).rejects.toMatchObject({ status: 429 });
  });

  it("does not accept a code twice", async () => {
    const email = testEmail("e");
    await m.requestOtp(email, "10.0.0.5");
    const code = lastCode(m.captured, email);
    await m.verifyOtp(email, code, "10.0.0.5");
    await expect(m.verifyOtp(email, code, "10.0.0.5")).rejects.toMatchObject({ status: 400 });
  });

  it("refuses suspended accounts", async () => {
    const email = testEmail("f");
    await m.requestOtp(email, "10.0.0.6");
    const { user } = await m.verifyOtp(email, lastCode(m.captured, email), "10.0.0.6");
    await m.db.user.update({ where: { id: user.id }, data: { status: "SUSPENDED" } });
    await m.db.otpChallenge.updateMany({ data: { lastSentAt: new Date(Date.now() - 120_000) } });
    await m.requestOtp(email, "10.0.0.6");
    await expect(m.verifyOtp(email, lastCode(m.captured, email), "10.0.0.6")).rejects.toMatchObject(
      {
        status: 403,
      },
    );
  });
});

describe.skipIf(!testDbEnabled)("google sign in", () => {
  let m: Awaited<ReturnType<typeof load>>;
  beforeAll(async () => {
    m = await load();
  });
  beforeEach(async () => {
    await resetTestDb();
  });

  const identity = (email: string, sub = "g-1", verified = true) => ({
    sub,
    email,
    emailVerified: verified,
    name: "Test Person",
  });

  it("creates an account, then signs the same person in again", async () => {
    const a = await m.signInWithGoogle(identity(testEmail("g1")));
    expect(a.isNew).toBe(true);
    expect(a.user.name).toBe("Test Person");
    const b = await m.signInWithGoogle(identity(testEmail("g1")));
    expect(b.isNew).toBe(false);
    expect(b.user.id).toBe(a.user.id);
  });

  it("links to an existing OTP account with the same verified email", async () => {
    const email = testEmail("g2");
    const existing = await m.findOrCreateUser(email, new Date());
    const linked = await m.signInWithGoogle(identity(email, "g-2"));
    expect(linked.user.id).toBe(existing.user.id);
    expect(await m.db.authAccount.count({ where: { userId: existing.user.id } })).toBe(1);
  });

  it("refuses an unverified Google email", async () => {
    await expect(m.signInWithGoogle(identity(testEmail("g3"), "g-3", false))).rejects.toMatchObject(
      { status: 400 },
    );
  });
});
