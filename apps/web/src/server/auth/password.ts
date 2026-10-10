import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify<string, Buffer, number, ScryptOptions, Buffer>(scryptCallback);

/**
 * scrypt from Node itself: no native build, nothing to install on Windows or Vercel, and it is memory hard.
 * The parameters live in the stored string, so they can be raised later and old hashes still verify.
 */
const PARAMS = { N: 16384, r: 8, p: 1 } as const;
const KEY_LEN = 64;
const PREFIX = "scrypt";

function pack(n: number, r: number, p: number, salt: Buffer, hash: Buffer): string {
  return [PREFIX, n, r, p, salt.toString("base64url"), hash.toString("base64url")].join("$");
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password.normalize("NFKC"), salt, KEY_LEN, {
    ...PARAMS,
    maxmem: 64 * 1024 * 1024,
  });
  return pack(PARAMS.N, PARAMS.r, PARAMS.p, salt, hash);
}

/** Constant time compare. Returns false for any malformed stored value instead of throwing. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [prefix, n, r, p, saltB64, hashB64] = stored.split("$");
  if (prefix !== PREFIX || !n || !r || !p || !saltB64 || !hashB64) return false;
  const N = Number(n);
  const R = Number(r);
  const P = Number(p);
  if (![N, R, P].every((v) => Number.isInteger(v) && v > 0) || N > 1 << 20) return false;
  const expected = Buffer.from(hashB64, "base64url");
  try {
    const actual = await scrypt(
      password.normalize("NFKC"),
      Buffer.from(saltB64, "base64url"),
      expected.length,
      {
        N,
        r: R,
        p: P,
        maxmem: 256 * 1024 * 1024,
      },
    );
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/** True when the stored hash uses weaker settings than today's, so it can be upgraded after a good login. */
export function needsRehash(stored: string): boolean {
  const [prefix, n, r, p] = stored.split("$");
  return prefix !== PREFIX || Number(n) < PARAMS.N || Number(r) < PARAMS.r || Number(p) < PARAMS.p;
}

/**
 * A hash of nothing in particular, computed once. Login verifies against it when the email is unknown,
 * so a wrong email and a wrong password take about the same time (Section 6.4: never reveal accounts).
 */
let dummy: Promise<string> | undefined;
export function dummyHash(): Promise<string> {
  dummy ??= hashPassword(randomBytes(12).toString("hex"));
  return dummy;
}
