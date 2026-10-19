import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";

/**
 * Hashes a password the way apps/web/src/server/auth/password.ts does, using only Node, so Playwright can load it on
 * any supported Node version (it cannot load the web app's own module on Node 20). tests/unit/e2e-password.test.ts
 * checks that the real verifyPassword accepts this hash and does not ask for an upgrade, so the two cannot drift.
 */
const run = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

export async function hashE2ePassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await run(password.normalize("NFKC"), salt, 64, {
    N: 131_072,
    r: 8,
    p: 1,
    maxmem: 256 * 1024 * 1024,
  });
  return ["scrypt", 131_072, 8, 1, salt.toString("base64url"), hash.toString("base64url")].join(
    "$",
  );
}
