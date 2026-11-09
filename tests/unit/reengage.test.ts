import { describe, expect, it } from "vitest";
import {
  LIMITS,
  channelsFor,
  decideReengage,
  defaultPrefs,
  defaultSwitches,
  isInactive,
  notificationCopy,
  notificationHref,
  reengageEmailGate,
  reengageKey,
  windowStartOf,
  type ActivityFacts,
} from "@gistroom/shared";
import { templates } from "../../apps/web/src/server/mail/templates";

const DAY = 86_400_000;
const now = new Date("2026-11-20T09:00:00.000Z");
const ago = (days: number) => new Date(now.getTime() - days * DAY);
const facts = (over: Partial<ActivityFacts> = {}): ActivityFacts => ({
  lastActiveAt: ago(10),
  lastSessionAt: ago(10),
  createdAt: ago(100),
  ...over,
});
const none = { sentAt: [], windows: [] };

describe("inactivity window", () => {
  it("is inactive only after more than seven days on both signals", () => {
    expect(isInactive(facts({ lastActiveAt: ago(7), lastSessionAt: ago(7) }), now)).toBe(false);
    expect(isInactive(facts({ lastActiveAt: ago(8), lastSessionAt: ago(8) }), now)).toBe(true);
  });
  it("a recent session keeps someone active even with no action", () => {
    expect(isInactive(facts({ lastActiveAt: null, lastSessionAt: ago(1) }), now)).toBe(false);
  });
  it("a recent action keeps someone active even with an old session", () => {
    expect(isInactive(facts({ lastActiveAt: ago(2), lastSessionAt: ago(40) }), now)).toBe(false);
  });
  it("someone with only an old session counts as inactive", () => {
    expect(isInactive(facts({ lastActiveAt: null, lastSessionAt: ago(30) }), now)).toBe(true);
  });
  it("a brand new account is not inactive", () => {
    expect(isInactive({ lastActiveAt: null, lastSessionAt: null, createdAt: ago(2) }, now)).toBe(
      false,
    );
  });
});

describe("spells and cooldowns", () => {
  it("keys a spell by the day of the last signal", () => {
    const a = windowStartOf(facts({ lastActiveAt: ago(10), lastSessionAt: ago(12) }));
    const b = windowStartOf(facts({ lastActiveAt: ago(9), lastSessionAt: ago(12) }));
    expect(a.getTime()).not.toBe(b.getTime());
    expect(a.getUTCHours()).toBe(0);
  });
  it("sends to a newly inactive person", () => {
    expect(decideReengage(facts(), none, now)).toEqual({ send: true });
  });
  it("does not repeat inside the same spell", () => {
    const f = facts();
    expect(decideReengage(f, { sentAt: [], windows: [windowStartOf(f)] }, now)).toEqual({
      send: false,
      reason: "SAME_WINDOW",
    });
  });
  it("holds back inside the cooldown and allows after it", () => {
    const f = facts({ lastActiveAt: ago(9), lastSessionAt: ago(9) });
    const inside = ago(LIMITS.REENGAGE_COOLDOWN_DAYS - 1);
    const outside = ago(LIMITS.REENGAGE_COOLDOWN_DAYS + 1);
    expect(decideReengage(f, { sentAt: [inside], windows: [] }, now)).toEqual({
      send: false,
      reason: "COOLDOWN",
    });
    expect(decideReengage(f, { sentAt: [outside], windows: [] }, now)).toEqual({ send: true });
  });
  it("stops at the yearly cap", () => {
    const sent = [ago(40), ago(80), ago(120)];
    expect(decideReengage(facts(), { sentAt: sent, windows: [] }, now)).toEqual({
      send: false,
      reason: "YEARLY_CAP",
    });
    expect(
      decideReengage(facts(), { sentAt: [ago(40), ago(80), ago(400)], windows: [] }, now),
    ).toEqual({ send: true });
  });
  it("a person who came back and went quiet again is a new spell", () => {
    const first = facts({ lastActiveAt: ago(60), lastSessionAt: ago(60) });
    const second = facts({ lastActiveAt: ago(9), lastSessionAt: ago(9) });
    expect(windowStartOf(first).getTime()).not.toBe(windowStartOf(second).getTime());
    expect(
      decideReengage(second, { sentAt: [ago(50)], windows: [windowStartOf(first)] }, now),
    ).toEqual({ send: true });
  });
  it("builds a stable dedupe key per person and spell", () => {
    const w = windowStartOf(facts());
    expect(reengageKey("u1", w)).toBe(reengageKey("u1", w));
    expect(reengageKey("u1", w)).not.toBe(reengageKey("u2", w));
  });
});

describe("preferences and quiet hours", () => {
  it("is on by default", () => {
    expect(defaultSwitches("REENGAGE")).toEqual({ inApp: true, push: false, email: true });
    expect(reengageEmailGate({ prefs: defaultPrefs, timeZone: "Africa/Lagos", now })).toBe("SEND");
  });
  it("is final when the person switched email off", () => {
    const prefs = {
      ...defaultPrefs,
      switches: { REENGAGE: { inApp: true, push: false, email: false } },
    };
    expect(reengageEmailGate({ prefs, timeZone: "Africa/Lagos", now })).toBe("OFF");
  });
  it("is held during quiet hours", () => {
    // 09:00 UTC is 10:00 in Lagos.
    const prefs = { ...defaultPrefs, quietStart: "09:00", quietEnd: "12:00" };
    expect(reengageEmailGate({ prefs, timeZone: "Africa/Lagos", now })).toBe("QUIET");
  });
  it("never pushes", () => {
    const prefs = {
      ...defaultPrefs,
      switches: { REENGAGE: { inApp: true, push: true, email: true } },
    };
    expect(channelsFor({ type: "REENGAGE", prefs, timeZone: "Africa/Lagos", now }).push).toBe(
      false,
    );
  });
});

describe("the notice itself", () => {
  it("opens the discover page and invents nothing", () => {
    expect(notificationHref("REENGAGE", {})).toBe("/app/discover");
    const copy = notificationCopy("REENGAGE", { count: 99, fromName: "Someone" }, "n1");
    expect(copy.body).not.toMatch(/\d/);
    expect(copy.body).not.toContain("Someone");
  });
  it("the email greets by first name, links to discover and carries the preferences link", () => {
    const t = templates["come-back"];
    const out = t.render(
      { to: "Tunde Bello", path: "/app/discover" },
      { appUrl: "https://x.test" },
    );
    expect(out.subject).toContain("Tunde");
    expect(out.text).toContain("https://x.test/app/discover");
    expect(out.text).toContain("/app/settings/notifications");
    expect(out.html).toContain("/app/settings/notifications");
  });
});
