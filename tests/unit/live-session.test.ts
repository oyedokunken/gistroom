import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LiveSession,
  onLiveEvent,
  useLive,
  type LiveDeps,
  type LiveEvent,
  type LiveKitModule,
} from "../../apps/web/src/lib/live/live-session";
import { useConnectionStore } from "../../apps/web/src/lib/session/connection";

/** A stand in for LiveKit that counts every listener and every track, so leaks show up as numbers. */
const stats = { tracksMade: 0, tracksStopped: 0, rooms: [] as FakeRoom[] };

class FakeTrack {
  readonly mediaStreamTrack = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
  constructor() {
    stats.tracksMade += 1;
  }
  stop() {
    stats.tracksStopped += 1;
  }
}

class FakeRoom {
  listeners = new Map<string, Set<(...a: unknown[]) => void>>();
  remoteParticipants = new Map<string, unknown>();
  canPlaybackAudio = true;
  disconnect = vi.fn();
  localParticipant = {
    identity: "user_me",
    name: "Me",
    isLocal: true,
    isMicrophoneEnabled: false,
    isCameraEnabled: false,
    trackPublications: new Map<string, { track: FakeTrack }>(),
    setMicrophoneEnabled: async (on: boolean) => {
      this.localParticipant.isMicrophoneEnabled = on;
      if (on) this.localParticipant.trackPublications.set("mic", { track: new FakeTrack() });
    },
    setCameraEnabled: async (on: boolean) => {
      this.localParticipant.isCameraEnabled = on;
      if (on) this.localParticipant.trackPublications.set("cam", { track: new FakeTrack() });
    },
    publishData: vi.fn(async () => undefined),
  };
  constructor() {
    stats.rooms.push(this);
  }
  on(event: string, fn: (...a: unknown[]) => void) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)?.add(fn);
    return this;
  }
  off(event: string, fn: (...a: unknown[]) => void) {
    this.listeners.get(event)?.delete(fn);
    return this;
  }
  removeAllListeners() {
    this.listeners.clear();
  }
  emit(event: string, ...args: unknown[]) {
    for (const fn of this.listeners.get(event) ?? []) fn(...args);
  }
  get listenerCount() {
    let n = 0;
    for (const set of this.listeners.values()) n += set.size;
    return n;
  }
  async connect() {}
  async startAudio() {}
  getActiveDevice() {
    return undefined;
  }
  async switchActiveDevice() {
    return true;
  }
}

const fakeLk = {
  Room: FakeRoom,
  RoomEvent: new Proxy({}, { get: (_t, name) => `event:${String(name)}` }),
  Track: {
    Kind: { Audio: "audio", Video: "video" },
    Source: { Camera: "camera", Microphone: "microphone" },
  },
  ConnectionQuality: {
    Excellent: "excellent",
    Good: "good",
    Poor: "poor",
    Lost: "lost",
    Unknown: "unknown",
  },
  DisconnectReason: {
    DUPLICATE_IDENTITY: "dup",
    CLIENT_INITIATED: "client",
    PARTICIPANT_REMOVED: "removed",
    ROOM_DELETED: "deleted",
  },
  VideoPresets: { h360: { resolution: {} }, h540: { resolution: {} }, h720: { resolution: {} } },
  VideoQuality: { LOW: 0, HIGH: 2 },
} as unknown as LiveKitModule;

function make() {
  let now = 1_000_000;
  const intervals = new Map<number, () => void>();
  const timeouts = new Map<number, () => void>();
  let id = 1;
  const deps: LiveDeps = {
    loadLiveKit: async () => fakeLk,
    now: () => now,
    setInterval: (fn) => {
      intervals.set(id, fn);
      return id++;
    },
    clearInterval: (h) => void intervals.delete(h as number),
    setTimeout: (fn) => {
      timeouts.set(id, fn);
      return id++;
    },
    clearTimeout: (h) => void timeouts.delete(h as number),
  };
  return {
    session: new LiveSession(deps),
    intervals,
    timeouts,
    advance: (ms: number) => (now += ms),
    runTimeouts: () => {
      const all = [...timeouts.values()];
      timeouts.clear();
      all.forEach((fn) => fn());
    },
  };
}

const opts = (over: Partial<Parameters<LiveSession["join"]>[0]> = {}) => ({
  kind: "call" as const,
  refId: "call-1",
  title: "Ada",
  url: "wss://x",
  token: "t",
  heartbeat: vi.fn(),
  ...over,
});

describe("live session", () => {
  beforeEach(() => {
    stats.tracksMade = 0;
    stats.tracksStopped = 0;
    stats.rooms.length = 0;
    useLive.setState({ kind: null, refId: null, status: "idle" });
    useConnectionStore.getState().patch({ livekit: "idle", livekitPoor: false });
  });

  it("connects, starts the microphone and the heartbeat", async () => {
    const t = make();
    const o = opts();
    await t.session.join(o);
    expect(useLive.getState().status).toBe("connected");
    expect(useLive.getState().micOn).toBe(true);
    expect(o.heartbeat).toHaveBeenCalled();
    expect(t.intervals.size).toBeGreaterThan(0);
    t.session.leave();
  });

  it("ignores a second join for the same call, even with a new token", async () => {
    const t = make();
    await t.session.join(opts());
    await t.session.join(opts({ token: "other" }));
    expect(stats.rooms).toHaveLength(1);
    t.session.leave();
  });

  it("joins a different call by leaving the first", async () => {
    const t = make();
    await t.session.join(opts());
    await t.session.join(opts({ refId: "call-2" }));
    expect(stats.rooms).toHaveLength(2);
    expect(stats.rooms[0]?.disconnect).toHaveBeenCalled();
    t.session.leave();
  });

  it("stops every track, disconnects, and drops every listener and timer on leave", async () => {
    const t = make();
    await t.session.join(opts({ startWithVideo: true }));
    const room = stats.rooms[0];
    expect(stats.tracksMade).toBe(2);
    t.session.leave();
    expect(stats.tracksStopped).toBe(stats.tracksMade);
    expect(room?.disconnect).toHaveBeenCalledWith(true);
    expect(room?.listenerCount).toBe(0);
    expect(t.intervals.size).toBe(0);
    expect(t.timeouts.size).toBe(0);
    expect(useLive.getState().status).toBe("idle");
    expect(t.session.active).toBe(false);
  });

  it("leaves nothing behind after twenty joins and leaves", async () => {
    const t = make();
    for (let i = 0; i < 20; i += 1) {
      await t.session.join(opts({ refId: `call-${i}`, startWithVideo: true }));
      t.session.leave();
    }
    expect(stats.tracksStopped).toBe(stats.tracksMade);
    expect(stats.rooms.every((r) => r.listenerCount === 0)).toBe(true);
    expect(t.intervals.size).toBe(0);
    expect(t.timeouts.size).toBe(0);
  });

  it("can be left twice without harm", async () => {
    const t = make();
    await t.session.join(opts());
    t.session.leave();
    expect(() => t.session.leave()).not.toThrow();
  });

  it("tells listeners when someone joins and leaves, and when the session ends", async () => {
    const t = make();
    const seen: LiveEvent["type"][] = [];
    const off = onLiveEvent((e) => seen.push(e.type));
    await t.session.join(opts({ kind: "room", refId: "slug" }));
    stats.rooms[0]?.emit("event:ParticipantConnected", { identity: "user_a", name: "Ada" });
    stats.rooms[0]?.emit("event:ParticipantDisconnected", { identity: "user_a", name: "Ada" });
    t.session.leave();
    off();
    expect(seen).toEqual(["connected", "participant-joined", "participant-left", "left"]);
  });

  it("shows reconnecting, then connected again", async () => {
    const t = make();
    await t.session.join(opts());
    stats.rooms[0]?.emit("event:Reconnecting");
    expect(useLive.getState().status).toBe("reconnecting");
    expect(useConnectionStore.getState().livekit).toBe("reconnecting");
    stats.rooms[0]?.emit("event:Reconnected");
    expect(useLive.getState().status).toBe("connected");
    t.session.leave();
  });

  it("marks a joined from another device and an unexpected drop differently", async () => {
    const t = make();
    await t.session.join(opts());
    stats.rooms[0]?.emit("event:Disconnected", "dup");
    expect(useLive.getState().disconnectReason).toBe("duplicate");
    t.session.leave();
    await t.session.join(opts({ refId: "call-2" }));
    stats.rooms[1]?.emit("event:Disconnected", "something else");
    expect(useLive.getState().disconnectReason).toBe("other");
    t.session.leave();
  });

  it("notices a poor line only after ten seconds, and clears it when it recovers", async () => {
    const t = make();
    await t.session.join(opts());
    const room = stats.rooms[0];
    room?.emit("event:ConnectionQualityChanged", "poor", room.localParticipant);
    expect(useLive.getState().poorFor10s).toBe(false);
    t.runTimeouts();
    expect(useLive.getState().poorFor10s).toBe(true);
    room?.emit("event:ConnectionQualityChanged", "good", room.localParticipant);
    expect(useLive.getState().poorFor10s).toBe(false);
    t.session.leave();
  });

  it("flags a lost peer in a call after five seconds, and not in a room", async () => {
    const t = make();
    await t.session.join(opts());
    const peer = { identity: "user_b", isLocal: false };
    stats.rooms[0]?.emit("event:ConnectionQualityChanged", "lost", peer);
    t.runTimeouts();
    expect(useLive.getState().peerLostSince).not.toBeNull();
    stats.rooms[0]?.emit("event:ConnectionQualityChanged", "good", peer);
    expect(useLive.getState().peerLostSince).toBeNull();
    t.session.leave();
    await t.session.join(opts({ kind: "room", refId: "slug" }));
    stats.rooms[1]?.emit("event:ConnectionQualityChanged", "lost", peer);
    t.runTimeouts();
    expect(useLive.getState().peerLostSince).toBeNull();
    t.session.leave();
  });

  it("flags a blocked microphone when permission is refused", async () => {
    const t = make();
    const orig = FakeRoom.prototype.connect;
    FakeRoom.prototype.connect = async function (this: FakeRoom) {
      this.localParticipant.setMicrophoneEnabled = async () => {
        throw Object.assign(new Error("no"), { name: "NotAllowedError" });
      };
    };
    await t.session.join(opts());
    expect(useLive.getState().micIssue).toBe("denied");
    t.session.leave();
    FakeRoom.prototype.connect = orig;
  });

  it("starts without the microphone when asked, and sends reactions over the call", async () => {
    const t = make();
    await t.session.join(opts({ startMuted: true }));
    expect(useLive.getState().micOn).toBe(false);
    await t.session.sendReaction("\u{1F44F}");
    expect(stats.rooms[0]?.localParticipant.publishData).toHaveBeenCalled();
    t.session.leave();
  });
});
