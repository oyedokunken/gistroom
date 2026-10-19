import { describe, expect, it } from "vitest";
import { hashE2ePassword } from "../helpers/e2e-password";
import { needsRehash, verifyPassword } from "../../apps/web/src/server/auth/password";

describe("the browser test password hash", () => {
  it("is accepted by the real verifier and needs no upgrade", async () => {
    const stored = await hashE2ePassword("e2e-long-passphrase-123");
    expect(await verifyPassword("e2e-long-passphrase-123", stored)).toBe(true);
    expect(await verifyPassword("another passphrase", stored)).toBe(false);
    expect(needsRehash(stored)).toBe(false);
  });
});
