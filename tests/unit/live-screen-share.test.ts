import { beforeEach, describe, expect, it, vi } from "vitest";
import { PRESENT_QUALITY_FULL, PRESENT_QUALITY_REDUCED } from "../../packages/shared/src";
import {
  LiveSession,
  onLiveEvent,
  useLive,
  type LiveDeps,
  type LiveEvent,
  type LiveKitModule,
} from "../../apps/web/src/lib/live/live-session";
import { useConnectionStore } from "../../apps/web/src/lib/session/connection";

/** A stand in for LiveKit with a screen share source, so publishing, ending and cleanup can be counted. */
const stats = {
  stopped: 0,
  rooms: [] as FakeRoom[],
  created: [] as unknown[],
  failWith: null as Error | null,
};

class FakeTrack {
  kind = "video";
  source = "screen_share";
  ended: (() => void) | null = null;
  readonly mediaStreamTrack = {
    addEventListener: (_n: string, fn: () => void) => {
      this.ended = fn;
    },
    removeEventListener: vi.fn(() => {
      this.ended = null;
    }),
  };
  stop() {
    stats.stopped += 1;
  }
}

class FakeRoom {
  listeners = new Map<string, Set<(...a: unknown[]) => void>>();
  remoteParticipants = new Map<string, unknown>();
  canPlaybackAudio = true;
  disconnect = vi.fn();
  published = new Map<string, { source: string; track: FakeTrack }>();
  lastPublishOptions: Record<string, unknown> | null = null;
  localParticipant = {
    identity: "user_me",
    name: "Me",
    isLocal: true,
    isMicrophoneEnabled: false,
    isCameraEnabled: false,
    trackPublications: new Map<string, { track: FakeTrack }>(),
    setMicrophoneEnabled: async () => undefined,
    setCameraEnabled: vi.fn(async () => undefined),
    publishData: vi.fn(async () => undefined),
    getTrackPublication: (source: string) => this.published.get(source),
    publishTrack: async (track: FakeTrack, options: Record<string, unknown>) => {
      this.lastPublishOptions = options;
      const pub = { source: String(options.source), track };
      this.published.set(pub.source, pub);
      this.localParticipant.trackPublications.set(pub.source, pub);
      this.emit("event:LocalTrackPublished", pub);
      return pub;
    },
    unpublishTrack: async (track: FakeTrack) => {
      const pub = this.published.get("screen_share");
      this.published.delete("screen_share");
      this.localParticipant.trackPublications.delete("screen_share");
      track.stop();
      if (pub) this.emit("event:LocalTrackUnpublished", pub);
      return pub;
    },
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
    Source: { Camera: "camera", Microphone: "microphone", ScreenShare: "screen_share" },
  },
  ConnectionQuality: { Excellent: "e", Good: "g", Poor: "p", Lost: "l", Unknown: "u" },
  DisconnectReason: { DUPLICATE_IDENTITY: "d", CLIENT_INITIATED: "c", PARTICIPANT_REMOVED: "r" },
  VideoPresets: { h360: { resolution: {} }, h540: { resolution: {} }, h720: { resolution: {} } },
  VideoQuality: { LOW: 0, HIGH: 2 },
  createLocalScreenTracks: async (options: unknown) => {
    stats.created.push(options);
    if (stats.failWith) throw stats.failWith;
    return [new FakeTrack()];
  },
} as unknown as LiveKitModule;

function make() {
  const deps: LiveDeps = {
    loadLiveKit: async () => fakeLk,
    now: () => 1_000_000,
    setInterval: () => 1,
    clearInterval: () => undefined,
    setTimeout: () => 1,
    clearTimeout: () => undefined,
  };
  return new LiveSession(deps);
}

const join = (session: LiveSession) =>
  session.join({
    kind: "room",
    refId: "slug",
    title: "Room",
    url: "wss://x",
    token: "t",
    startMuted: true,
    heartbeat: vi.fn(),
  });

const room = () => stats.rooms[0] as FakeRoom;

describe("screen sharing in the live session", () => {
  let events: LiveEvent[] = [];
  beforeEach(() => {
    stats.stopped = 0;
    stats.rooms.length = 0;
    stats.created.length = 0;
    stats.failWith = null;
    events = [];
    useLive.setState({ kind: null, refId: null, status: "idle" });
    useConnectionStore.getState().patch({ livekit: "idle", livekitPoor: false });
    onLiveEvent((e) => events.push(e));
  });

  it("captures video only at the chosen quality, publishes one screen track and keeps camera and mic alone", async () => {
    const s = make();
    await join(s);
    expect(await s.captureScreen(PRESENT_QUALITY_FULL)).toBe("ok");
    expect(stats.created[0]).toMatchObject({ audio: false });
    expect(await s.publishScreen()).toBe(true);

    expect(room().lastPublishOptions).toMatchObject({
      source: "screen_share",
      simulcast: false,
      name: "screen",
    });
    // The source name, window title and tab title are never part of what is published.
    expect(JSON.stringify(room().lastPublishOptions)).not.toMatch(/title|window|tab/i);
    expect(useLive.getState().localSharing).toBe(true);
    expect(useLive.getState().screenSharer).toBe("user_me");
    expect(room().localParticipant.setCameraEnabled).not.toHaveBeenCalled();
    expect(useLive.getState().micOn).toBe(false);
    s.leave();
  });

  it("captures reduced quality for data saver", async () => {
    const s = make();
    await join(s);
    await s.captureScreen(PRESENT_QUALITY_REDUCED);
    expect(stats.created[0]).toMatchObject({
      resolution: {
        height: PRESENT_QUALITY_REDUCED.height,
        frameRate: PRESENT_QUALITY_REDUCED.frameRate,
      },
    });
    s.leave();
  });

  it("ends and tells everyone when the browser's own stop button is pressed", async () => {
    const s = make();
    await join(s);
    await s.captureScreen(PRESENT_QUALITY_FULL);
    await s.publishScreen();
    const track = room().published.get("screen_share")?.track as FakeTrack;
    track.ended?.();
    await vi.waitFor(() => expect(useLive.getState().localSharing).toBe(false));
    expect(events).toContainEqual({ type: "screen-ended", cause: "browser" });
    expect(stats.stopped).toBeGreaterThan(0);
    s.leave();
  });

  it("reads a server side revoke as a handoff or a moderator stop, not as the person's own stop", async () => {
    const s = make();
    await join(s);
    await s.captureScreen(PRESENT_QUALITY_FULL);
    await s.publishScreen();
    // LiveKit drops the track because the server took the permission away.
    const pub = room().published.get("screen_share");
    room().published.delete("screen_share");
    room().emit("event:LocalTrackUnpublished", pub);
    expect(events).toContainEqual({ type: "screen-ended", cause: "revoked" });
    expect(useLive.getState().localSharing).toBe(false);
    s.leave();
  });

  it("does not report its own stop as a revoke", async () => {
    const s = make();
    await join(s);
    await s.captureScreen(PRESENT_QUALITY_FULL);
    await s.publishScreen();
    await s.stopScreen();
    expect(events.find((e) => e.type === "screen-ended")).toBeUndefined();
    expect(useLive.getState().localSharing).toBe(false);
    expect(useLive.getState().screenSharer).toBeNull();
    s.leave();
  });

  it("stops the shared screen with the one cleanup when the call or room is left", async () => {
    const s = make();
    await join(s);
    await s.captureScreen(PRESENT_QUALITY_FULL);
    await s.publishScreen();
    const before = stats.stopped;
    s.leave();
    expect(stats.stopped).toBeGreaterThan(before);
    expect(useLive.getState().localSharing).toBe(false);
    expect(useLive.getState().screenSharer).toBeNull();
  });

  it("discards a capture that was never published, so the browser indicator clears", async () => {
    const s = make();
    await join(s);
    await s.captureScreen(PRESENT_QUALITY_FULL);
    s.discardScreen();
    expect(stats.stopped).toBe(1);
    expect(await s.publishScreen()).toBe(false);
    s.leave();
  });

  it("replaces an earlier unpublished capture instead of leaking it", async () => {
    const s = make();
    await join(s);
    await s.captureScreen(PRESENT_QUALITY_FULL);
    await s.captureScreen(PRESENT_QUALITY_FULL);
    expect(stats.stopped).toBe(1);
    s.leave();
  });

  it("maps a blocked picker and an unsupported browser, and never touches the camera", async () => {
    const s = make();
    await join(s);
    stats.failWith = Object.assign(new Error("Permission denied"), { name: "NotAllowedError" });
    expect(await s.captureScreen(PRESENT_QUALITY_FULL)).toBe("denied");
    stats.failWith = Object.assign(new Error("nope"), { name: "NotSupportedError" });
    expect(await s.captureScreen(PRESENT_QUALITY_FULL)).toBe("unsupported");
    stats.failWith = Object.assign(new Error("Cancelled by user"), { name: "Error" });
    expect(await s.captureScreen(PRESENT_QUALITY_FULL)).toBe("cancelled");
    stats.failWith = new Error("boom");
    expect(await s.captureScreen(PRESENT_QUALITY_FULL)).toBe("failed");
    expect(await s.publishScreen()).toBe(false);
    expect(room().localParticipant.setCameraEnabled).not.toHaveBeenCalled();
    expect(useLive.getState().localSharing).toBe(false);
    s.leave();
  });

  it("never draws someone else's screen on the camera picture of a call", async () => {
    const s = make();
    await join(s);
    const attach = vi.fn();
    room().emit("event:TrackSubscribed", { kind: "video", source: "screen_share", attach });
    expect(attach).not.toHaveBeenCalled();
    s.leave();
  });
});
