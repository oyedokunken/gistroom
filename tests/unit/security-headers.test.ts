import { describe, expect, it } from "vitest";
import { buildCsp, staticSecurityHeaders } from "../../apps/web/src/lib/security-headers";

const base = { nonce: "abc123", isDev: false, realtimeUrl: "https://rt.example.com" };

describe("buildCsp", () => {
  it("uses the nonce and strict-dynamic for scripts, with no unsafe-eval in production", () => {
    const csp = buildCsp(base);
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("upgrade-insecure-requests");
  });
  it("allows unsafe-eval only in development", () => {
    const csp = buildCsp({ ...base, isDev: true });
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });
  it("allows the realtime and LiveKit origins over https and wss", () => {
    const csp = buildCsp({ ...base, livekitUrl: "wss://lk.example.com" });
    expect(csp).toContain("https://rt.example.com");
    expect(csp).toContain("wss://rt.example.com");
    expect(csp).toContain("wss://lk.example.com");
  });
  it("locks down framing, objects and the base URI", () => {
    const csp = buildCsp(base);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
  });
});

describe("static headers", () => {
  it("keeps mic and camera available for calls", () => {
    expect(staticSecurityHeaders["Permissions-Policy"]).toContain("microphone=(self)");
    expect(staticSecurityHeaders["Permissions-Policy"]).toContain("camera=(self)");
  });
});
