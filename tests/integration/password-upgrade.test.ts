import { randomBytes, scryptSync } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prepareTestEnv, resetTestDb, testEmail } from "../helpers/db";
import { requireTestDb } from "../helpers/require-test-db";

prepareTestEnv();

// The real scrypt still runs. Its salts are recorded so a test can tell which stored hash a sign in spent time on.
const scryptSalts = vi.hoisted(() => [] as string[]);
vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  const scrypt = ((...args: unknown[]) => {
    scryptSalts.push((args[1] as Buffer).toString("base64url"));
    return (actual.scrypt as (...a: unknown[]) => void)(...args);
  }) as typeof actual.scrypt;
  return { ...actual, scrypt };
});
const saltOf = (stored: string) => stored.split("$")[4] as string;

async function load() {
  const [svc, pw, db] = await Promise.all([
    import("../../apps/web/src/server/auth/auth-service"),
    import("../../apps/web/src/server/auth/password"),
    import("@gistroom/db"),
  ]);
  return { login: svc.login, pw, db: db.getDb() };
}

/** A hash exactly as the earlier code wrote it: N = 2^14, r = 8, p = 1. */
function legacyHash(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password.normalize("NFKC"), salt, 64, { N: 16_384, r: 8, p: 1 });
  return ["scrypt", 16_384, 8, 1, salt.toString("base64url"), hash.toString("base64url")].join("$");
}

const PASSWORD = "an older passphrase here";

describe.skipIf(!requireTestDb())("password cost upgrade on sign in", () => {
  let m: Awaited<ReturnType<typeof load>>;
  beforeAll(async () => {
    m = await load();
    // The dummy hash is made on first use. Make it now so its own hashing is not counted by a test.
    await m.pw.dummyHash();
  }, 60_000);
  beforeEach(async () => {
    await resetTestDb();
    scryptSalts.length = 0;
  });
  afterAll(async () => {
    await resetTestDb();
  });

  async function legacyUser(key: string) {
    return m.db.user.create({
      data: {
        email: testEmail(key),
        emailVerifiedAt: new Date(),
        passwordHash: legacyHash(PASSWORD),
        name: `Test ${key}`,
        username: `test_${key}`,
        onboardedAt: new Date(),
      },
    });
  }

  it("rehashes a legacy hash after a good sign in and keeps the same password working", async () => {
    const user = await legacyUser("legacy_ok");
    expect(m.pw.needsRehash(user.passwordHash as string)).toBe(true);

    await m.login(user.email, PASSWORD, "10.1.0.1");

    const after = await m.db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.passwordHash).not.toBe(user.passwordHash);
    expect(after.passwordHash?.split("$").slice(0, 4)).toEqual(["scrypt", "131072", "8", "1"]);
    expect(m.pw.needsRehash(after.passwordHash as string)).toBe(false);
    expect(await m.pw.verifyPassword(PASSWORD, after.passwordHash as string)).toBe(true);

    // A second sign in has nothing left to upgrade.
    await m.login(user.email, PASSWORD, "10.1.0.1");
    const again = await m.db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(again.passwordHash).toBe(after.passwordHash);
  }, 60_000);

  it("does not touch a legacy hash after a wrong password, and spends the dummy hash's time", async () => {
    const user = await legacyUser("legacy_bad");
    await expect(m.login(user.email, "not the password", "10.1.0.2")).rejects.toMatchObject({
      status: 401,
    });
    const after = await m.db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.passwordHash).toBe(user.passwordHash);

    const dummy = await m.pw.dummyHash();
    expect(scryptSalts).toEqual([saltOf(user.passwordHash as string), saltOf(dummy)]);
  }, 60_000);

  it("verifies an unknown email against the dummy hash, the same work as a wrong password", async () => {
    await expect(m.login(testEmail("nobody"), "whatever it is", "10.1.0.3")).rejects.toMatchObject({
      status: 401,
    });
    const dummy = await m.pw.dummyHash();
    expect(scryptSalts).toEqual([saltOf(dummy)]);
    expect(m.pw.needsRehash(dummy)).toBe(false);
  }, 60_000);
});
