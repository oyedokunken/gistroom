import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prepareTestEnv, resetTestDb, testDbEnabled, testEmail } from "../helpers/db";

prepareTestEnv();

// Imported lazily so that a skipped run never loads the database client.
async function load() {
  const [svc, google, mail, pw, db] = await Promise.all([
    import("../../apps/web/src/server/auth/auth-service"),
    import("../../apps/web/src/server/auth/google-service"),
    import("../../apps/web/src/server/mail/transport"),
    import("../../apps/web/src/server/auth/password"),
    import("@gistroom/db"),
  ]);
  return {
    ...svc,
    ...google,
    hashPassword: pw.hashPassword,
    captured: mail.capturedMail,
    db: db.getDb(),
  };
}

function lastCode(captured: { to: string; text: string }[], to: string): string {
  const msg = [...captured].reverse().find((m) => m.to === to && /Your code:/.test(m.text));
  const match = /Your code: (\d{6})/.exec(msg?.text ?? "");
  if (!match?.[1]) throw new Error("no code captured");
  return match[1];
}

const PASSWORD = "a long enough passphrase";

describe.skipIf(!testDbEnabled)("sign up and password sign in", () => {
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

  async function signUpAndSetPassword(email: string, ip: string) {
    await m.startSignup(email, ip);
    const { user } = await m.completeSignup(email, lastCode(m.captured, email), ip);
    return m.db.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await m.hashPassword(PASSWORD),
        onboardedAt: new Date(),
        name: "Test Person",
        username: `test_${user.id.slice(-8)}`,
      },
    });
  }

  it("sends one code at sign up and creates an unfinished account", async () => {
    const email = testEmail("a");
    await m.startSignup(email, "10.0.0.1");
    const { user, isNew } = await m.completeSignup(email, lastCode(m.captured, email), "10.0.0.1");
    expect(isNew).toBe(true);
    expect(user.emailVerifiedAt).not.toBeNull();
    expect(user.passwordHash).toBeNull();
    expect(user.onboardedAt).toBeNull();
  });

  it("signs in with the password and never sends a code again", async () => {
    const email = testEmail("b");
    await signUpAndSetPassword(email, "10.0.0.2");
    m.captured.length = 0;
    const user = await m.login(email, PASSWORD, "10.0.0.2");
    expect(user.email).toBe(email);
    expect(m.captured).toHaveLength(0);
  });

  it("gives a wrong password and an unknown email the same answer", async () => {
    const email = testEmail("c");
    await signUpAndSetPassword(email, "10.0.0.3");
    const wrong = await m
      .login(email, "not the password", "10.0.0.3")
      .catch((e: { status: number; message: string }) => e);
    const unknown = await m
      .login(testEmail("nobody"), "whatever it is", "10.0.0.3")
      .catch((e: { status: number; message: string }) => e);
    expect(wrong).toMatchObject({ status: 401 });
    expect(unknown).toMatchObject({ status: 401 });
    expect((wrong as { message: string }).message).toBe((unknown as { message: string }).message);
  });

  it("locks password attempts for one email after eight tries", async () => {
    const email = testEmail("d");
    await signUpAndSetPassword(email, "10.0.0.4");
    for (let i = 0; i < 8; i += 1)
      await m.login(email, `wrong ${i}`, `10.0.1.${i}`).catch(() => undefined);
    await expect(m.login(email, PASSWORD, "10.0.2.1")).rejects.toMatchObject({ status: 429 });
  });

  it("does not let a sign up take over a finished account", async () => {
    const email = testEmail("e");
    await signUpAndSetPassword(email, "10.0.0.5");
    m.captured.length = 0;
    await expect(m.startSignup(email, "10.0.0.5")).rejects.toMatchObject({ status: 409 });
    expect(m.captured.some((x) => /Your code:/.test(x.text))).toBe(false);
  });

  it("resets a password with a code and signs every other device out", async () => {
    const email = testEmail("f");
    const user = await signUpAndSetPassword(email, "10.0.0.6");
    await m.db.session.create({
      data: { userId: user.id, tokenHash: "h1", expiresAt: new Date(Date.now() + 1e6) },
    });
    await m.startReset(email, "10.0.0.6");
    const updated = await m.completeReset(
      email,
      lastCode(m.captured, email),
      "a brand new passphrase",
      "10.0.0.6",
    );
    expect(updated.id).toBe(user.id);
    expect(await m.db.session.count({ where: { userId: user.id, revokedAt: null } })).toBe(0);
    await expect(m.login(email, PASSWORD, "10.0.0.7")).rejects.toMatchObject({ status: 401 });
    await expect(m.login(email, "a brand new passphrase", "10.0.0.7")).resolves.toMatchObject({
      id: user.id,
    });
  });

  it("answers a reset for an unknown email like any other, and sends nothing", async () => {
    await expect(m.startReset(testEmail("ghost"), "10.0.0.8")).resolves.toMatchObject({
      resendAfterSec: 60,
    });
    await expect(m.startReset("no_such_person", "10.0.0.8")).resolves.toMatchObject({
      resendAfterSec: 60,
    });
    expect(m.captured).toHaveLength(0);
  });

  it("resets by username and sends the code to that account's email", async () => {
    const email = testEmail("u");
    const user = await signUpAndSetPassword(email, "10.0.0.11");
    await m.startReset(user.username, "10.0.0.11");
    expect(m.captured.some((x) => x.to === email && /Your code:/.test(x.text))).toBe(true);
    const updated = await m.completeReset(
      user.username,
      lastCode(m.captured, email),
      "another long passphrase",
      "10.0.0.11",
    );
    expect(updated.id).toBe(user.id);
  });

  it("says email or username in the wrong password message, matching what was typed", async () => {
    const email = testEmail("w");
    const user = await signUpAndSetPassword(email, "10.0.0.12");
    await expect(m.login(email, "nope nope nope", "10.0.0.12")).rejects.toMatchObject({
      status: 401,
      message: "Email or password is incorrect.",
    });
    await expect(m.login(user.username, "nope nope nope", "10.0.0.13")).rejects.toMatchObject({
      status: 401,
      message: "Username or password is incorrect.",
    });
    await expect(m.login(user.username, PASSWORD, "10.0.0.14")).resolves.toMatchObject({
      id: user.id,
    });
  });

  it("tells a sign up with a finished email to sign in instead", async () => {
    const email = testEmail("h");
    await signUpAndSetPassword(email, "10.0.0.10");
    await expect(m.startSignup(email, "10.0.0.10")).rejects.toMatchObject({ status: 409 });
  });

  it("refuses suspended accounts at sign in", async () => {
    const email = testEmail("g");
    const user = await signUpAndSetPassword(email, "10.0.0.9");
    await m.db.user.update({ where: { id: user.id }, data: { status: "SUSPENDED" } });
    await expect(m.login(email, PASSWORD, "10.0.0.9")).rejects.toMatchObject({ status: 403 });
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

  it("links to an existing account with the same verified email", async () => {
    const email = testEmail("g2");
    const existing = await m.db.user.create({
      data: { email, emailVerifiedAt: new Date(), name: "", username: "u_g2" },
    });
    const linked = await m.signInWithGoogle(identity(email, "g-2"));
    expect(linked.user.id).toBe(existing.id);
    expect(await m.db.authAccount.count({ where: { userId: existing.id } })).toBe(1);
  });

  it("refuses an unverified Google email", async () => {
    await expect(m.signInWithGoogle(identity(testEmail("g3"), "g-3", false))).rejects.toMatchObject(
      { status: 400 },
    );
  });
});
