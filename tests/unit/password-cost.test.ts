import { randomBytes, scryptSync } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Counts calls to timingSafeEqual while still running the real one.
const compare = vi.hoisted(() => ({ calls: 0 }));
vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return {
    ...actual,
    timingSafeEqual: (a: NodeJS.ArrayBufferView, b: NodeJS.ArrayBufferView) => {
      compare.calls += 1;
      return actual.timingSafeEqual(a, b);
    },
  };
});

import {
  PARAMS,
  hashPassword,
  needsRehash,
  verifyPassword,
} from "../../apps/web/src/server/auth/password";

/** A hash exactly as the earlier code wrote it: N = 2^14, r = 8, p = 1. */
function legacyHash(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password.normalize("NFKC"), salt, 64, { N: 16_384, r: 8, p: 1 });
  return ["scrypt", 16_384, 8, 1, salt.toString("base64url"), hash.toString("base64url")].join("$");
}

describe("scrypt cost", () => {
  it("uses the OWASP N = 2^17, r = 8, p = 1 setting", () => {
    expect(PARAMS).toEqual({ N: 131_072, r: 8, p: 1 });
  });

  it("writes the parameters into every new hash", async () => {
    const stored = await hashPassword("a long enough passphrase");
    const [prefix, n, r, p, salt, hash] = stored.split("$");
    expect(prefix).toBe("scrypt");
    expect([Number(n), Number(r), Number(p)]).toEqual([131_072, 8, 1]);
    expect(Buffer.from(salt ?? "", "base64url")).toHaveLength(16);
    expect(Buffer.from(hash ?? "", "base64url")).toHaveLength(64);
    expect(needsRehash(stored)).toBe(false);
  }, 30_000);

  it("still verifies a hash made with the old settings and flags it for an upgrade", async () => {
    const stored = legacyHash("an older passphrase");
    expect(await verifyPassword("an older passphrase", stored)).toBe(true);
    expect(await verifyPassword("an older passphrasE", stored)).toBe(false);
    expect(needsRehash(stored)).toBe(true);
  }, 30_000);

  it("flags each way a hash can be weaker than today's", () => {
    const salt = "AAAA";
    expect(needsRehash(`scrypt$131072$8$1$${salt}$${salt}`)).toBe(false);
    expect(needsRehash(`scrypt$65536$8$1$${salt}$${salt}`)).toBe(true);
    expect(needsRehash(`scrypt$131072$4$1$${salt}$${salt}`)).toBe(true);
    expect(needsRehash(`scrypt$131072$8$0$${salt}$${salt}`)).toBe(true);
    expect(needsRehash("bcrypt$12$x")).toBe(true);
  });

  it("refuses a stored cost above today's instead of allocating for it", async () => {
    const salt = randomBytes(16).toString("base64url");
    expect(await verifyPassword("x", `scrypt$1048576$8$1$${salt}$AAAA`)).toBe(false);
  });
});

describe("comparison", () => {
  beforeEach(() => {
    compare.calls = 0;
  });

  it("goes through timingSafeEqual for a good and a bad password", async () => {
    const stored = legacyHash("constant time please");
    expect(await verifyPassword("constant time please", stored)).toBe(true);
    expect(await verifyPassword("constant time pleasf", stored)).toBe(false);
    expect(compare.calls).toBe(2);
  }, 30_000);

  it("never compares when the stored value is malformed", async () => {
    expect(await verifyPassword("x", "scrypt$16384$8$1")).toBe(false);
    expect(compare.calls).toBe(0);
  });
});
