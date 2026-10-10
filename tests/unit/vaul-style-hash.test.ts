import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EXTERNAL_STYLE_HASHES } from "../../apps/web/src/lib/security-headers";

/**
 * vaul injects a style tag at load and cannot take a nonce, so the CSP allows its exact hash.
 * When vaul changes its CSS this test fails: copy the printed hash into EXTERNAL_STYLE_HASHES.
 */
describe("vaul injected style", () => {
  it("is covered by the CSP hash allow list", () => {
    const source = readFileSync("node_modules/vaul/dist/index.mjs", "utf8");
    const match = /__insertCSS\(("(?:[^"\\]|\\.)*")\)/.exec(source);
    expect(match).not.toBeNull();
    const css = JSON.parse(match?.[1] ?? '""') as string;
    const hash = `sha256-${createHash("sha256").update(css).digest("base64")}`;
    expect(EXTERNAL_STYLE_HASHES, `add '${hash}'`).toContain(hash);
  });
});
