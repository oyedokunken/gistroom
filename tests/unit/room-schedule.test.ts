import { describe, expect, it } from "vitest";
import {
  LIMITS,
  channelsFor,
  defaultPrefs,
  notificationCopy,
  notificationHref,
  prefKey,
} from "@gistroom/shared";
import { buildIcs } from "../../apps/web/src/server/mail/ics";

describe("calendar file", () => {
  const ics = buildIcs({
    uid: "abc123",
    title: "Match day, with friends; part 2",
    description: "Hosted by Ada Okafor on Gistroom.",
    startsAt: new Date("2026-10-17T18:30:00.000Z"),
    url: "http://localhost:3000/app/rooms/abc123",
    now: new Date("2026-10-13T10:00:00.000Z"),
  });

  it("is a calendar with one event, CRLF line ends and UTC times", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART:20261017T183000Z");
    expect(ics).toContain("DTEND:20261017T193000Z");
    expect(ics).toContain("UID:abc123@gistroom.ng");
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  });

  it("escapes commas and semicolons in the title and folds long lines", () => {
    expect(ics).toContain("SUMMARY:Match day\\, with friends\\; part 2");
    const long = buildIcs({
      uid: "x",
      title: "t".repeat(200),
      startsAt: new Date(),
      url: "http://localhost:3000/app/rooms/x",
    });
    for (const line of long.split("\r\n")) expect(line.length).toBeLessThanOrEqual(75);
  });
});

describe("room schedule notices", () => {
  const payload = { roomId: "r1", roomSlug: "abc", roomTitle: "Match talk" };

  it("words the reminder, the live notice and the host nudge as asked", () => {
    expect(notificationCopy("ROOM_STARTING", payload, "n1").title).toBe(
      "Match talk starts in 15 minutes",
    );
    expect(notificationCopy("ROOM_LIVE_NOW", payload, "n1").title).toBe("Match talk is live now");
    expect(notificationCopy("ROOM_DUE_HOST", payload, "n1").title).toBe(
      "Your room is due to start now.",
    );
    const cancelled = notificationCopy("ROOM_CANCELLED", payload, "n1");
    expect(cancelled.title).toBe("Match talk didn't start");
    expect(cancelled.body).toBe("We'll let you know if it's rescheduled.");
  });

  it("aggregates the host's registrations into one line", () => {
    const body = (names: string[], count: number) =>
      notificationCopy("ROOM_REGISTRATIONS", { ...payload, names, count }, "n1").body;
    expect(body(["Ada"], 1)).toBe("Ada registered.");
    expect(body(["Ada", "Bola"], 2)).toBe("Ada and 1 other registered.");
    expect(body(["Ada", "Bola"], 5)).toBe("Ada and 4 others registered.");
  });

  it("opens the room from every one of them", () => {
    for (const type of [
      "ROOM_STARTING",
      "ROOM_LIVE_NOW",
      "ROOM_DUE_HOST",
      "ROOM_RESCHEDULED",
      "ROOM_CANCELLED",
      "ROOM_REGISTRATIONS",
    ] as const) {
      expect(notificationHref(type, payload)).toBe("/app/rooms/abc");
    }
  });

  it("shares the reminder switch, and keeps the host's count in the app", () => {
    expect(prefKey("ROOM_CANCELLED")).toBe("ROOM_STARTING");
    expect(prefKey("ROOM_LIVE_NOW")).toBe("ROOM_LIVE_NOW");
    const off = {
      ...defaultPrefs,
      switches: { ROOM_STARTING: { inApp: true, push: false, email: false } },
    };
    const at = new Date("2026-10-13T12:00:00Z");
    expect(
      channelsFor({ type: "ROOM_RESCHEDULED", prefs: off, timeZone: "Africa/Lagos", now: at }),
    ).toEqual({ inApp: true, push: false, email: false });
    expect(
      channelsFor({
        type: "ROOM_REGISTRATIONS",
        prefs: defaultPrefs,
        timeZone: "Africa/Lagos",
        now: at,
      }),
    ).toEqual({ inApp: true, push: false, email: false });
  });

  it("silences push but not the list in quiet hours", () => {
    const prefs = { ...defaultPrefs, quietStart: "22:00", quietEnd: "07:00" };
    const night = new Date("2026-10-13T22:30:00Z");
    const out = channelsFor({ type: "ROOM_STARTING", prefs, timeZone: "UTC", now: night });
    expect(out.inApp).toBe(true);
    expect(out.push).toBe(false);
  });

  it("keeps the schedule limits in order", () => {
    expect(LIMITS.ROOM_REMINDER_LATE_MIN).toBeLessThan(LIMITS.ROOM_REMINDER_LEAD_MIN);
    expect(LIMITS.ROOM_SCHEDULE_GRACE_MIN).toBe(30);
  });
});
