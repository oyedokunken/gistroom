"use client";

import { create } from "zustand";
import type { Participant, Room } from "livekit-client";
import { isReactionEmoji } from "@gistroom/shared";
import { setLiveKitStatus } from "@/lib/session/connection";
import { unsupportedReason } from "@/lib/session/browser";

/**
 * The one live connection of this browser tab, for a 1:1 call or a room. It lives outside every screen, so moving
 * to chats or settings never drops it, and leaving it always runs the same cleanup: every track stopped (the camera
 * light goes off), the room disconnected, timers, listeners and the wake lock released.
 */

export type LiveKind = "call" | "room";
export type QualityLabel = "excellent" | "good" | "poor" | "lost" | "unknown";
export type LiveStatus =
  "idle" | "connecting" | "connected" | "reconnecting" | "disconnected" | "failed";
/** Why a device did not work: permission said no, no such device, or another app has it. */
export type DeviceIssue = "denied" | "missing" | "busy" | null;
export type DisconnectReason = "client" | "duplicate" | "removed" | "ended" | "other" | null;

export interface LiveState {
  kind: LiveKind | null;
  refId: string | null;
  title: string;
  status: LiveStatus;
  micOn: boolean;
  camOn: boolean;
  remoteCam: boolean;
  micIssue: DeviceIssue;
  camIssue: DeviceIssue;
  /** The browser would not play other people's audio until the person taps. */
  audioBlocked: boolean;
  /** The mic stopped while the tab was in the background on a phone. */
  micPausedInBackground: boolean;
  /** This browser cannot run calls, for example the one built into another app. */
  unsupported: boolean;
  disconnectReason: DisconnectReason;
  /** When the connection first came up, in milliseconds since 1970. */
  startedAt: number | null;
  /** Everyone in the room, you first. LiveKit participants, used to attach video. */
  participants: Participant[];
  speaking: ReadonlySet<string>;
  quality: Record<string, QualityLabel>;
  localQuality: QualityLabel;
  /** My connection has been poor for 10 seconds. */
  poorFor10s: boolean;
  /** The other person (1:1) has been lost for 5 seconds. */
  peerLostSince: number | null;
  /** The LiveKit identity of the host of this room, so a dropped host can be noticed. */
  hostIdentity: string | null;
  /** The device I speak through changed, for the "Switched to" note. */
  deviceNote: string | null;
  /** Bumps on every change so tiles re-attach tracks. */
  version: number;
}

const idle: LiveState = {
  kind: null,
  refId: null,
  title: "",
  status: "idle",
  micOn: false,
  camOn: false,
  remoteCam: false,
  micIssue: null,
  camIssue: null,
  audioBlocked: false,
  micPausedInBackground: false,
  unsupported: false,
  disconnectReason: null,
  startedAt: null,
  participants: [],
  speaking: new Set(),
  quality: {},
  localQuality: "unknown",
  poorFor10s: false,
  peerLostSince: null,
  hostIdentity: null,
  deviceNote: null,
  version: 0,
};

export const useLive = create<LiveState>(() => ({ ...idle }));

export type LiveEvent =
  | { type: "participant-joined"; identity: string; name: string; at: number }
  | { type: "participant-left"; identity: string; name: string; at: number }
  | { type: "reaction"; identity: string | null; emoji: string }
  | { type: "reconnecting" }
  | { type: "reconnected" }
  | { type: "connected" }
  | { type: "disconnected"; reason: DisconnectReason }
  | { type: "left" };

type Listener = (event: LiveEvent) => void;
const listeners = new Set<Listener>();
export function onLiveEvent(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
const emit = (event: LiveEvent) => {
  for (const l of listeners) l(event);
};

export interface JoinOptions {
  kind: LiveKind;
  /** The call id or the room slug. Joining the same one twice does nothing. */
  refId: string;
  title: string;
  url: string;
  token: string;
  startWithVideo?: boolean;
  lowData?: boolean;
  startMuted?: boolean;
  /** The microphone and camera chosen on the check screen. */
  micId?: string | null;
  camId?: string | null;
  /** Ends the call or leaves the room on the server. Used by the in-call bar. */
  hangUp?: () => Promise<void>;
  /** Sends a quiet "still here" to the server, so a crashed tab is noticed. */
  heartbeat?: () => void;
  /** Tells the server this tab is going away, with sendBeacon. */
  beacon?: () => void;
}

export const REACTION_TOPIC = "reaction";
const HEARTBEAT_MS = 8000;
const POOR_MS = 10_000;
const PEER_LOST_MS = 5000;

/** What LiveKit gives us. Passed in so tests can supply a fake. */
export type LiveKitModule = typeof import("livekit-client");

export interface LiveDeps {
  loadLiveKit: () => Promise<LiveKitModule>;
  now: () => number;
  setInterval: (fn: () => void, ms: number) => unknown;
  clearInterval: (id: unknown) => void;
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (id: unknown) => void;
}

const realDeps: LiveDeps = {
  loadLiveKit: () => import("livekit-client"),
  now: () => Date.now(),
  setInterval: (fn, ms) => window.setInterval(fn, ms),
  clearInterval: (id) => window.clearInterval(id as number),
  setTimeout: (fn, ms) => window.setTimeout(fn, ms),
  clearTimeout: (id) => window.clearTimeout(id as number),
};

const qualityOf = (lk: LiveKitModule, q: unknown): QualityLabel => {
  if (q === lk.ConnectionQuality.Excellent) return "excellent";
  if (q === lk.ConnectionQuality.Good) return "good";
  if (q === lk.ConnectionQuality.Poor) return "poor";
  if (q === lk.ConnectionQuality.Lost) return "lost";
  return "unknown";
};

function issueOf(e: unknown): DeviceIssue {
  const name = (e as { name?: string } | null)?.name ?? "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError")
    return "denied";
  if (
    name === "NotFoundError" ||
    name === "OverconstrainedError" ||
    name === "DevicesNotFoundError"
  )
    return "missing";
  if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError")
    return "busy";
  return "missing";
}

export class LiveSession {
  private room: Room | null = null;
  private lk: LiveKitModule | null = null;
  private opts: JoinOptions | null = null;
  private generation = 0;
  private audioHost: HTMLDivElement | null = null;
  private remoteVideoEl: HTMLVideoElement | null = null;
  private localVideoEl: HTMLVideoElement | null = null;
  private heartbeatTimer: unknown = null;
  private poorTimer: unknown = null;
  private peerTimer: unknown = null;
  private wantMic = false;
  private wakeLock: { release: () => Promise<void> } | null = null;
  private joinedAt = new Map<string, number>();
  private detachers: (() => void)[] = [];
  private titleTimer: unknown = null;
  private baseTitle = "";

  constructor(private readonly deps: LiveDeps = realDeps) {}

  /** The LiveKit room, for code that needs the real object (tiles attach their video to it). */
  get current(): Room | null {
    return this.room;
  }

  get active(): boolean {
    return this.opts !== null;
  }

  isFor(refId: string): boolean {
    return this.opts?.refId === refId;
  }

  joinedTime(identity: string): number | null {
    return this.joinedAt.get(identity) ?? null;
  }

  /** Joins once per call or room. A second call for the same one is ignored, so screens can call it freely. */
  async join(opts: JoinOptions): Promise<void> {
    // The same call or room is already live. A new token for it (the page fetched one again) changes nothing.
    const status = useLive.getState().status;
    if (this.opts?.refId === opts.refId && status !== "failed" && status !== "disconnected") return;
    if (this.opts) this.leave();
    const generation = ++this.generation;
    this.opts = opts;
    this.wantMic = !opts.startMuted;
    useLive.setState({
      ...idle,
      kind: opts.kind,
      refId: opts.refId,
      title: opts.title,
      status: "connecting",
      speaking: new Set(),
      quality: {},
    });
    setLiveKitStatus("connecting");

    // Some browsers cannot join at all. Say so up front instead of failing halfway.
    if (typeof navigator !== "undefined" && typeof window !== "undefined") {
      const why = unsupportedReason(
        navigator.userAgent,
        Boolean(navigator.mediaDevices?.getUserMedia),
        "RTCPeerConnection" in window,
      );
      if (why) {
        useLive.setState({ status: "failed", unsupported: true });
        setLiveKitStatus("disconnected");
        return;
      }
    }

    const lk = await this.deps.loadLiveKit();
    if (generation !== this.generation) return;
    this.lk = lk;
    const room = new lk.Room({
      adaptiveStream: true,
      dynacast: true,
      audioCaptureDefaults: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      videoCaptureDefaults: {
        resolution: opts.lowData
          ? lk.VideoPresets.h360.resolution
          : opts.kind === "call"
            ? lk.VideoPresets.h720.resolution
            : lk.VideoPresets.h540.resolution,
      },
      publishDefaults: { simulcast: true },
    });
    this.room = room;
    this.mountAudioHost();
    this.wire(room, lk, generation);

    try {
      await room.connect(opts.url, opts.token);
      if (generation !== this.generation) return;
      const startedAt = this.deps.now();
      useLive.setState({ status: "connected", startedAt });
      setLiveKitStatus("connected");
      emit({ type: "connected" });
      this.startHeartbeat();
      this.startTitle();
      this.holdScreenAwake();
      this.installUnload();
      try {
        if (opts.micId) await room.switchActiveDevice("audioinput", opts.micId).catch(() => false);
        if (opts.camId) await room.switchActiveDevice("videoinput", opts.camId).catch(() => false);
        if (this.wantMic) await room.localParticipant.setMicrophoneEnabled(true);
      } catch (e) {
        this.wantMic = false;
        useLive.setState({ micIssue: issueOf(e) });
      }
      if (opts.startWithVideo) {
        try {
          await room.localParticipant.setCameraEnabled(true);
        } catch (e) {
          useLive.setState({ camIssue: issueOf(e) });
        }
      }
      this.sync();
    } catch {
      if (generation !== this.generation) return;
      useLive.setState({ status: "failed" });
      setLiveKitStatus("disconnected");
    }
  }

  private mountAudioHost() {
    if (typeof document === "undefined") return;
    this.audioHost = document.createElement("div");
    this.audioHost.setAttribute("aria-hidden", "true");
    this.audioHost.dataset.liveAudio = "true";
    this.audioHost.style.display = "none";
    document.body.appendChild(this.audioHost);
  }

  private wire(room: Room, lk: LiveKitModule, generation: number) {
    const alive = () => generation === this.generation;
    const on = (ev: string, fn: (...args: never[]) => void) => {
      room.on(ev as never, fn as never);
      this.detachers.push(() => room.off(ev as never, fn as never));
    };

    on(lk.RoomEvent.TrackSubscribed, ((track: {
      kind: string;
      attach: (el?: HTMLMediaElement) => HTMLMediaElement;
    }) => {
      if (!alive()) return;
      if (track.kind === lk.Track.Kind.Audio) this.audioHost?.appendChild(track.attach());
      else if (track.kind === lk.Track.Kind.Video && this.remoteVideoEl)
        track.attach(this.remoteVideoEl);
      this.sync();
    }) as never);
    on(lk.RoomEvent.TrackUnsubscribed, ((track: { detach: () => HTMLMediaElement[] }) => {
      track.detach().forEach((el) => el.remove());
      if (alive()) this.sync();
    }) as never);

    const changed = () => {
      if (alive()) this.sync();
    };
    for (const ev of [
      lk.RoomEvent.TrackMuted,
      lk.RoomEvent.TrackUnmuted,
      lk.RoomEvent.TrackPublished,
      lk.RoomEvent.TrackUnpublished,
      lk.RoomEvent.LocalTrackUnpublished,
    ]) {
      on(ev, changed);
    }
    on(lk.RoomEvent.LocalTrackPublished, ((pub: {
      source: string;
      track?: { mediaStreamTrack?: MediaStreamTrack; attach: (el: HTMLMediaElement) => void };
    }) => {
      if (!alive()) return;
      if (pub.source === lk.Track.Source.Camera && pub.track && this.localVideoEl)
        pub.track.attach(this.localVideoEl);
      // A device that is pulled out or whose permission is taken away ends its track by itself.
      const media = pub.track?.mediaStreamTrack;
      if (media) {
        const ended = () => {
          if (!alive()) return;
          const isCam = pub.source === lk.Track.Source.Camera;
          useLive.setState(
            isCam ? { camIssue: "missing", camOn: false } : { micIssue: "missing", micOn: false },
          );
          this.sync();
        };
        media.addEventListener("ended", ended);
        this.detachers.push(() => media.removeEventListener("ended", ended));
      }
      this.sync();
    }) as never);

    on(lk.RoomEvent.ParticipantConnected, ((p: Participant) => {
      if (!alive()) return;
      const at = this.deps.now();
      this.joinedAt.set(p.identity, at);
      emit({ type: "participant-joined", identity: p.identity, name: p.name || p.identity, at });
      this.sync();
    }) as never);
    on(lk.RoomEvent.ParticipantDisconnected, ((p: Participant) => {
      if (!alive()) return;
      emit({
        type: "participant-left",
        identity: p.identity,
        name: p.name || p.identity,
        at: this.deps.now(),
      });
      this.joinedAt.delete(p.identity);
      this.sync();
    }) as never);

    on(lk.RoomEvent.ActiveSpeakersChanged, ((list: Participant[]) => {
      if (alive()) useLive.setState({ speaking: new Set(list.map((p) => p.identity)) });
    }) as never);

    on(lk.RoomEvent.ConnectionQualityChanged, ((q: unknown, p: Participant) => {
      if (!alive()) return;
      const label = qualityOf(lk, q);
      useLive.setState((s) => ({
        quality: { ...s.quality, [p.identity]: label },
        localQuality: p.isLocal ? label : s.localQuality,
      }));
      if (p.isLocal) this.trackPoor(label === "poor" || label === "lost");
      else if (useLive.getState().kind === "call") this.trackPeerLost(label === "lost");
      this.updateLivekitHint();
    }) as never);

    on(lk.RoomEvent.Reconnecting, (() => {
      if (!alive()) return;
      useLive.setState({ status: "reconnecting" });
      setLiveKitStatus("reconnecting");
      emit({ type: "reconnecting" });
    }) as never);
    on(lk.RoomEvent.SignalReconnecting, (() => {
      if (!alive()) return;
      useLive.setState({ status: "reconnecting" });
      setLiveKitStatus("reconnecting");
    }) as never);
    on(lk.RoomEvent.Reconnected, (() => {
      if (!alive()) return;
      useLive.setState({ status: "connected" });
      setLiveKitStatus("connected");
      emit({ type: "reconnected" });
      this.sync();
    }) as never);

    on(lk.RoomEvent.Disconnected, ((reason: unknown) => {
      if (!alive()) return;
      const mapped: DisconnectReason =
        reason === lk.DisconnectReason.DUPLICATE_IDENTITY
          ? "duplicate"
          : reason === lk.DisconnectReason.CLIENT_INITIATED
            ? "client"
            : reason === lk.DisconnectReason.PARTICIPANT_REMOVED
              ? "removed"
              : reason === lk.DisconnectReason.ROOM_DELETED
                ? "ended"
                : "other";
      useLive.setState({ status: "disconnected", disconnectReason: mapped });
      setLiveKitStatus("disconnected");
      emit({ type: "disconnected", reason: mapped });
    }) as never);

    on(lk.RoomEvent.AudioPlaybackStatusChanged, (() => {
      if (!alive()) return;
      useLive.setState({ audioBlocked: !room.canPlaybackAudio });
    }) as never);

    on(lk.RoomEvent.MediaDevicesError, ((e: unknown) => {
      if (!alive()) return;
      const issue = issueOf(e);
      // The kind is not always given. A camera error while the camera was being asked for is a camera issue.
      const camera = /video|camera/i.test(String((e as { message?: string })?.message ?? ""));
      useLive.setState(camera ? { camIssue: issue } : { micIssue: issue });
    }) as never);

    on(lk.RoomEvent.ActiveDeviceChanged, ((kind: string, id: string) => {
      if (!alive() || kind !== "audioinput") return;
      void navigator.mediaDevices
        ?.enumerateDevices()
        .then((list) => {
          const name = list.find((d) => d.deviceId === id)?.label;
          if (name) useLive.setState({ deviceNote: name });
        })
        .catch(() => undefined);
    }) as never);

    on(lk.RoomEvent.DataReceived, ((
      payload: Uint8Array,
      from: Participant | undefined,
      _kind: unknown,
      topic?: string,
    ) => {
      if (!alive() || topic !== REACTION_TOPIC) return;
      const emoji = new TextDecoder().decode(payload);
      if (isReactionEmoji(emoji))
        emit({ type: "reaction", identity: from?.identity ?? null, emoji });
    }) as never);

    if (typeof document !== "undefined") {
      const visible = () => {
        if (document.visibilityState !== "visible" || !alive()) return;
        const lp = room.localParticipant;
        // A phone paused the microphone while the tab was hidden and the person never asked for that.
        if (this.wantMic && !lp.isMicrophoneEnabled && useLive.getState().status === "connected") {
          useLive.setState({ micPausedInBackground: true });
        }
        void this.relockScreen();
      };
      document.addEventListener("visibilitychange", visible);
      this.detachers.push(() => document.removeEventListener("visibilitychange", visible));
    }
  }

  private updateLivekitHint() {
    const s = useLive.getState();
    setLiveKitStatus(
      s.status === "connected"
        ? "connected"
        : s.status === "reconnecting"
          ? "reconnecting"
          : "disconnected",
      s.poorFor10s,
    );
  }

  /** On a poor line the video coming in drops to its smallest size, and goes back when the line recovers. */
  private setIncomingQuality(low: boolean) {
    const lk = this.lk;
    const room = this.room;
    if (!lk || !room) return;
    for (const p of room.remoteParticipants.values()) {
      for (const pub of p.videoTrackPublications.values()) {
        pub.setVideoQuality(low ? lk.VideoQuality.LOW : lk.VideoQuality.HIGH);
      }
    }
  }

  private trackPoor(poor: boolean) {
    if (!poor) {
      if (this.poorTimer !== null) this.deps.clearTimeout(this.poorTimer);
      this.poorTimer = null;
      if (useLive.getState().poorFor10s) {
        useLive.setState({ poorFor10s: false });
        this.setIncomingQuality(false);
        this.updateLivekitHint();
      }
      return;
    }
    if (this.poorTimer !== null) return;
    this.poorTimer = this.deps.setTimeout(() => {
      this.poorTimer = null;
      useLive.setState({ poorFor10s: true });
      this.setIncomingQuality(true);
      this.updateLivekitHint();
    }, POOR_MS);
  }

  private trackPeerLost(lost: boolean) {
    if (!lost) {
      if (this.peerTimer !== null) this.deps.clearTimeout(this.peerTimer);
      this.peerTimer = null;
      if (useLive.getState().peerLostSince !== null) useLive.setState({ peerLostSince: null });
      return;
    }
    if (this.peerTimer !== null) return;
    this.peerTimer = this.deps.setTimeout(() => {
      this.peerTimer = null;
      useLive.setState({ peerLostSince: this.deps.now() });
    }, PEER_LOST_MS);
  }

  /** Reads LiveKit's own picture of the room into the store. */
  sync(): void {
    const room = this.room;
    if (!room) return;
    const lp = room.localParticipant;
    const remote = [...room.remoteParticipants.values()];
    for (const p of remote)
      if (!this.joinedAt.has(p.identity)) this.joinedAt.set(p.identity, this.deps.now());
    useLive.setState((s) => ({
      participants: [lp, ...remote],
      micOn: lp.isMicrophoneEnabled,
      camOn: lp.isCameraEnabled,
      remoteCam: remote.some((p) => p.isCameraEnabled),
      version: s.version + 1,
    }));
  }

  // ----- Controls -----

  async toggleMic(): Promise<void> {
    const lp = this.room?.localParticipant;
    if (!lp) return;
    const next = !lp.isMicrophoneEnabled;
    try {
      await lp.setMicrophoneEnabled(next);
      this.wantMic = next;
      useLive.setState({ micIssue: null, micPausedInBackground: false });
    } catch (e) {
      useLive.setState({ micIssue: issueOf(e) });
    }
    this.sync();
  }

  async setCamera(on: boolean): Promise<"ok" | "blocked"> {
    const lp = this.room?.localParticipant;
    if (!lp) return "blocked";
    try {
      await lp.setCameraEnabled(on);
      useLive.setState({ camIssue: null });
      this.sync();
      return "ok";
    } catch (e) {
      useLive.setState({ camIssue: issueOf(e) });
      this.sync();
      return "blocked";
    }
  }

  async flipCamera(): Promise<void> {
    const room = this.room;
    const lk = this.lk;
    if (!room || !lk) return;
    const cams = await lk.Room.getLocalDevices("videoinput");
    if (cams.length < 2) return;
    const current = room.getActiveDevice("videoinput");
    const next = cams.find((c) => c.deviceId !== current) ?? cams[0];
    if (next) await room.switchActiveDevice("videoinput", next.deviceId);
  }

  /** The microphones, cameras or speakers this device has, for the picker. Empty when there is no connection. */
  async devices(kind: MediaDeviceKind): Promise<{ id: string; label: string }[]> {
    const lk = this.lk;
    if (!lk) return [];
    try {
      const list = await lk.Room.getLocalDevices(kind);
      return list.map((d, i) => ({ id: d.deviceId, label: d.label || `Device ${i + 1}` }));
    } catch {
      return [];
    }
  }

  activeDevice(kind: MediaDeviceKind): string | undefined {
    return this.room?.getActiveDevice(kind);
  }

  async switchDevice(kind: MediaDeviceKind, id: string): Promise<void> {
    await this.room?.switchActiveDevice(kind, id).catch(() => false);
  }

  /** Joins again with the details of the last try, after "Can't connect right now". */
  async retry(): Promise<void> {
    const opts = this.opts;
    if (!opts) return;
    const status = useLive.getState().status;
    if (status !== "failed" && status !== "disconnected") return;
    this.leave();
    await this.join(opts);
  }

  /** Turns the microphone back on after the phone paused it in the background. */
  async resumeMic(): Promise<void> {
    const lp = this.room?.localParticipant;
    if (!lp) return;
    try {
      await lp.setMicrophoneEnabled(true);
      this.wantMic = true;
      useLive.setState({ micPausedInBackground: false, micIssue: null });
    } catch (e) {
      useLive.setState({ micIssue: issueOf(e) });
    }
    this.sync();
  }

  clearDeviceNote(): void {
    useLive.setState({ deviceNote: null });
  }

  dismissMicPause(): void {
    useLive.setState({ micPausedInBackground: false });
  }

  /** Lets the browser play remote audio after it blocked autoplay. Must be called from a tap. */
  async enableAudio(): Promise<void> {
    await this.room?.startAudio();
    useLive.setState({ audioBlocked: !(this.room?.canPlaybackAudio ?? true) });
  }

  async sendReaction(emoji: string): Promise<void> {
    await this.room?.localParticipant
      .publishData(new TextEncoder().encode(emoji), { reliable: false, topic: REACTION_TOPIC })
      .catch(() => undefined);
  }

  attachVideo(kind: "remote" | "local", el: HTMLVideoElement | null): void {
    if (kind === "remote") this.remoteVideoEl = el;
    else this.localVideoEl = el;
    const room = this.room;
    const lk = this.lk;
    if (!el || !room || !lk) return;
    if (kind === "local") {
      room.localParticipant.getTrackPublication(lk.Track.Source.Camera)?.track?.attach(el);
    } else {
      for (const p of room.remoteParticipants.values()) {
        p.getTrackPublication(lk.Track.Source.Camera)?.track?.attach(el);
      }
    }
  }

  /** Tells the server this tab is still here. A tab that stops saying so for 20 seconds counts as gone. */
  private startHeartbeat() {
    this.stopHeartbeat();
    const beat = () => this.opts?.heartbeat?.();
    beat();
    this.heartbeatTimer = this.deps.setInterval(beat, HEARTBEAT_MS);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer !== null) this.deps.clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  /** "In call 05:12 | Gistroom" in the tab, so you can see it from another tab. */
  private startTitle() {
    if (typeof document === "undefined") return;
    this.stopTitle();
    const prefix = /^In (call|room) [\d:]+ \| /;
    const tick = () => {
      const s = useLive.getState();
      if (!s.startedAt || !s.kind) return;
      if (!document.title.match(prefix)) this.baseTitle = document.title;
      const secs = Math.max(0, Math.floor((this.deps.now() - s.startedAt) / 1000));
      const h = Math.floor(secs / 3600);
      const m = String(Math.floor((secs % 3600) / 60)).padStart(2, "0");
      const sec = String(secs % 60).padStart(2, "0");
      const time = h > 0 ? `${h}:${m}:${sec}` : `${m}:${sec}`;
      document.title = `In ${s.kind} ${time} | Gistroom`;
    };
    tick();
    this.titleTimer = this.deps.setInterval(tick, 1000);
  }

  private stopTitle() {
    if (this.titleTimer !== null) this.deps.clearInterval(this.titleTimer);
    this.titleTimer = null;
    if (typeof document !== "undefined" && this.baseTitle) document.title = this.baseTitle;
    this.baseTitle = "";
  }

  private async holdScreenAwake() {
    try {
      const nav = navigator as Navigator & {
        wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> };
      };
      this.wakeLock = (await nav.wakeLock?.request("screen")) ?? null;
    } catch {
      this.wakeLock = null;
    }
  }

  private async relockScreen() {
    if (!this.wakeLock) await this.holdScreenAwake();
  }

  private unloadGuard = (e: BeforeUnloadEvent) => {
    e.preventDefault();
    e.returnValue = "";
  };
  private pageHide = () => this.opts?.beacon?.();

  private installUnload() {
    if (typeof window === "undefined") return;
    window.addEventListener("beforeunload", this.unloadGuard);
    window.addEventListener("pagehide", this.pageHide);
  }

  private removeUnload() {
    if (typeof window === "undefined") return;
    window.removeEventListener("beforeunload", this.unloadGuard);
    window.removeEventListener("pagehide", this.pageHide);
  }

  /** Ends the live connection and releases everything it held. Safe to call twice. */
  leave(): void {
    const room = this.room;
    const had = this.opts !== null;
    this.generation += 1;
    this.stopHeartbeat();
    this.stopTitle();
    if (this.poorTimer !== null) this.deps.clearTimeout(this.poorTimer);
    if (this.peerTimer !== null) this.deps.clearTimeout(this.peerTimer);
    this.poorTimer = null;
    this.peerTimer = null;
    this.removeUnload();
    for (const detach of this.detachers.splice(0)) detach();
    if (room) {
      // Every local track is stopped, so the camera light goes off and the microphone is released.
      for (const pub of room.localParticipant.trackPublications.values()) {
        pub.track?.stop();
      }
      room.removeAllListeners();
      void room.disconnect(true);
    }
    this.audioHost?.remove();
    this.audioHost = null;
    for (const el of [this.remoteVideoEl, this.localVideoEl]) {
      if (el) el.srcObject = null;
    }
    void this.wakeLock?.release().catch(() => undefined);
    this.wakeLock = null;
    this.room = null;
    this.opts = null;
    this.wantMic = false;
    this.joinedAt.clear();
    useLive.setState({ ...idle, speaking: new Set(), quality: {} });
    setLiveKitStatus("idle");
    if (had) emit({ type: "left" });
  }

  /** Hangs up on the server and then closes the connection. Used by the in-call bar. */
  async hangUp(): Promise<void> {
    const opts = this.opts;
    try {
      await opts?.hangUp?.();
    } finally {
      this.leave();
    }
  }
}

let singleton: LiveSession | null = null;

/** The tab's one live session. */
export function live(): LiveSession {
  singleton ??= new LiveSession();
  return singleton;
}
