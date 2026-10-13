import { describe, expect, it, vi } from "vitest";
import {
  roomRingBlock,
  roomRingId,
  ringRemainingMs,
  stackRings,
  type PublicUser,
  type RingDto,
  type RingRoomDto,
} from "@gistroom/shared";
import { describeVanished } from "../../apps/web/src/lib/rings/store";
import { SoundManager } from "../../apps/web/src/lib/sound/sound-manager";

const person: PublicUser = {
  id: "u1",
  name: "Ada Okafor",
  username: "ada",
  avatarUrl: null,
  bio: null,
  online: null,
} as unknown as PublicUser;

const ring = (id: string, over: Partial<RingDto> = {}): RingDto => ({
  id,
  kind: "CALL",
  from: person,
  media: "AUDIO",
  startedAt: "2026-10-14T10:00:00.000Z",
  expiresAt: "2026-10-14T10:00:45.000Z",
  callId: id,
  ...over,
});

describe("ring countdown", () => {
  it("counts down on the server's clock, whatever the device clock says", () => {
    // The device is a minute fast. The server says it is 10:00:10, the ring ends at 10:00:45.
    const deviceNow = new Date("2026-10-14T10:01:10.000Z").getTime();
    const left = ringRemainingMs({
      expiresAt: "2026-10-14T10:00:45.000Z",
      serverNow: "2026-10-14T10:00:10.000Z",
      receivedAt: deviceNow,
      now: deviceNow + 5_000,
    });
    expect(left).toBe(30_000);
  });

  it("never goes below zero", () => {
    expect(
      ringRemainingMs({
        expiresAt: "2026-10-14T10:00:45.000Z",
        serverNow: "2026-10-14T10:00:44.000Z",
        receivedAt: 0,
        now: 60_000,
      }),
    ).toBe(0);
  });
});

describe("stacking", () => {
  it("shows the newest three first and counts the rest", () => {
    const list = [1, 2, 3, 4, 5].map((n) =>
      ring(`c${n}`, { startedAt: `2026-10-14T10:00:0${n}.000Z` }),
    );
    const { shown, more } = stackRings(list, 3);
    expect(shown.map((r) => r.id)).toEqual(["c5", "c4", "c3"]);
    expect(more).toBe(2);
  });

  it("shows everything when there are few", () => {
    expect(stackRings([ring("a")], 3)).toEqual({ shown: [ring("a")], more: 0 });
  });
});

describe("room ring card state", () => {
  const room = (over: Partial<RingRoomDto> = {}): RingRoomDto => ({
    slug: "abc",
    title: "Match talk",
    topicName: "Football",
    language: "ENGLISH",
    visibility: "PUBLIC",
    status: "LIVE",
    locked: false,
    hostName: "Tunde",
    media: "AUDIO",
    joined: 5,
    max: 32,
    avatars: [],
    ...over,
  });

  it("can be joined while the room is live, open and has space", () => {
    expect(roomRingBlock(room())).toBeNull();
  });

  it("says why it cannot be joined, the worst reason first", () => {
    expect(roomRingBlock(room({ status: "ENDED", locked: true }))).toBe("ENDED");
    expect(roomRingBlock(room({ locked: true }))).toBe("LOCKED");
    expect(roomRingBlock(room({ joined: 32 }))).toBe("FULL");
  });

  it("has a stable id from the room and the moment it rang", () => {
    expect(roomRingId("abc", 1234)).toBe("room:abc:1234");
    expect(roomRingId("abc", new Date(1234))).toBe("room:abc:1234");
  });
});

describe("what a ring leaving the list says", () => {
  const before = [ring("c1"), ring("c2"), ring("c3"), ring("c4")];
  const recent = [
    { id: "c1", kind: "CALL" as const, outcome: "CANCELLED" as const, from: person },
    { id: "c2", kind: "CALL" as const, outcome: "ANSWERED_ELSEWHERE" as const, from: person },
    { id: "c3", kind: "CALL" as const, outcome: "DECLINED_ELSEWHERE" as const, from: person },
    { id: "c4", kind: "CALL" as const, outcome: "EXPIRED" as const, from: person },
  ];

  it("says Missed call for three seconds when the caller hung up first, and the others once", () => {
    const out = describeVanished(before, [], recent, new Set());
    expect(out.closing).toEqual([{ id: "c1", text: "Missed call from Ada Okafor", person }]);
    expect(out.chips).toEqual(["Answered on another device", "Declined on another device"]);
  });

  it("says nothing about a ring answered or declined on this tab", () => {
    const out = describeVanished(before, [], recent, new Set(["c1", "c2", "c3", "c4"]));
    expect(out).toEqual({ closing: [], chips: [] });
  });

  it("says nothing about rings that are still there", () => {
    expect(describeVanished(before, before, recent, new Set())).toEqual({
      closing: [],
      chips: [],
    });
  });
});

describe("the ringtone stops on every way out", () => {
  function make() {
    const intervals = new Map<number, () => void>();
    let next = 1;
    const vibrate = vi.fn();
    const ctx = {
      state: "suspended" as AudioContextState,
      currentTime: 0,
      destination: {},
      resume: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
      createOscillator: () => ({
        type: "sine",
        frequency: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
        connect: vi.fn((n: unknown) => n),
        start: vi.fn(),
        stop: vi.fn(),
      }),
      createGain: () => ({
        gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
      }),
    };
    const manager = new SoundManager({
      createContext: () => ctx as unknown as AudioContext,
      now: () => 0,
      hidden: () => false,
      quiet: () => false,
      vibrate,
      setInterval: (fn) => {
        const id = next++;
        intervals.set(id, fn);
        return id;
      },
      clearInterval: (id) => void intervals.delete(id as number),
    });
    return { manager, intervals, vibrate, ctx };
  }

  it("stops when answered, declined or run out (stopLoop)", () => {
    const { manager, intervals, vibrate } = make();
    manager.startLoop("ringtone");
    expect(manager.isLooping("ringtone")).toBe(true);
    manager.stopLoop("ringtone");
    expect(manager.isLooping("ringtone")).toBe(false);
    expect(intervals.size).toBe(0);
    expect(vibrate).toHaveBeenLastCalledWith(0);
  });

  it("stops when the page is left (stopAll)", () => {
    const { manager, intervals, vibrate } = make();
    manager.startLoop("ringtone");
    manager.stopAll();
    expect(manager.isLooping("ringtone")).toBe(false);
    expect(intervals.size).toBe(0);
    expect(vibrate).toHaveBeenLastCalledWith(0);
  });

  it("stops when sounds are switched off while it rings", () => {
    const { manager, intervals } = make();
    manager.startLoop("ringtone");
    manager.configure({ master: 1, calls: false, rooms: true, messages: true });
    expect(manager.isLooping("ringtone")).toBe(false);
    expect(intervals.size).toBe(0);
  });

  it("reports when the browser is holding audio back, and clears it after a tap", () => {
    const { manager, ctx } = make();
    manager.startLoop("ringtone");
    expect(manager.isBlocked()).toBe(true);
    ctx.state = "running";
    manager.unlock();
    expect(manager.isBlocked()).toBe(false);
  });
});
