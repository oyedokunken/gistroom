import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { signLiveKitToken } from "../../apps/web/src/server/livekit";

const decode = (part: string) => JSON.parse(Buffer.from(part, "base64url").toString("utf8"));

describe("signLiveKitToken", () => {
  const base = {
    apiKey: "devkey",
    apiSecret: "a-long-secret-for-tests-only-0123456789",
    identity: "user_1",
    name: "Ada",
    room: "call_abc",
    ttlSec: 600,
    now: new Date("2026-10-10T10:00:00Z"),
  };

  it("carries the room grant and a short life", () => {
    const [h, p] = signLiveKitToken(base).split(".");
    expect(decode(h!)).toEqual({ alg: "HS256", typ: "JWT" });
    const claims = decode(p!);
    expect(claims.iss).toBe("devkey");
    expect(claims.sub).toBe("user_1");
    expect(claims.video).toMatchObject({ room: "call_abc", roomJoin: true, canSubscribe: true });
    expect(claims.exp - claims.nbf).toBe(605);
  });

  it("is signed with the secret and only the secret", () => {
    const token = signLiveKitToken(base);
    const [h, p, s] = token.split(".");
    const expected = createHmac("sha256", base.apiSecret).update(`${h}.${p}`).digest("base64url");
    expect(s).toBe(expected);
    expect(token).not.toContain(base.apiSecret);
    const other = signLiveKitToken({ ...base, apiSecret: "another-secret-for-tests-0123456789ab" });
    expect(other.split(".")[2]).not.toBe(s);
  });
});
