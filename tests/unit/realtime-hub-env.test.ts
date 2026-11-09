import { describe, expect, it } from "vitest";
import { Hub } from "../../apps/realtime/src/hub";
import { loadEnv } from "../../apps/realtime/src/env";

describe("hub", () => {
  it("tracks a person's sockets, first and last, and focus", () => {
    const hub = new Hub();
    expect(hub.add("s1", { userId: "u1", sessionId: "a", focused: false })).toBe(true);
    expect(hub.add("s2", { userId: "u1", sessionId: "a", focused: false })).toBe(false);
    expect(hub.socketIds("u1").sort()).toEqual(["s1", "s2"]);
    expect(hub.socketIds("nobody")).toEqual([]);
    expect(hub.isOnline("u1")).toBe(true);
    expect(hub.hasFocused("u1")).toBe(false);
    hub.setFocused("s2", true);
    expect(hub.hasFocused("u1")).toBe(true);
    expect(hub.onlineCount()).toBe(1);
    expect(hub.remove("s1")).toEqual({ userId: "u1", last: false });
    expect(hub.remove("s2")).toEqual({ userId: "u1", last: true });
    expect(hub.remove("s2")).toBeNull();
    expect(hub.isOnline("u1")).toBe(false);
    expect(hub.onlineCount()).toBe(0);
  });
});

describe("realtime env", () => {
  const good = {
    DATABASE_URL: "postgresql://x",
    DATABASE_SCHEMA: "gistroom_test",
    REALTIME_PASS_SECRET: "p".repeat(32),
    INTERNAL_SERVICE_TOKEN: "t".repeat(32),
  };

  it("fills the defaults for what is optional", () => {
    const env = loadEnv(good as never);
    expect(env.PORT).toBe(4000);
    expect(env.WEB_APP_URL).toBe("http://localhost:3000");
    expect(env.VAPID_SUBJECT).toBe("mailto:security@gistroom.ng");
  });

  it("stops with a readable list when a secret is too short or the schema is wrong", () => {
    expect(() =>
      loadEnv({ ...good, REALTIME_PASS_SECRET: "short", DATABASE_SCHEMA: "elsewhere" } as never),
    ).toThrow(
      /REALTIME_PASS_SECRET[\s\S]*DATABASE_SCHEMA|DATABASE_SCHEMA[\s\S]*REALTIME_PASS_SECRET/,
    );
  });
});
