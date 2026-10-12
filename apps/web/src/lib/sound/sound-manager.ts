/**
 * Every sound in Gistroom is made in code with the Web Audio API: short, soft tones, no sound files, no licences.
 * One manager owns one AudioContext and the rules: categories can be switched off, quiet hours are respected, sounds
 * never pile up, and a hidden tab stays silent except for an incoming call.
 */

export type SoundCategory = "calls" | "rooms" | "messages";

export type SoundId =
  | "ringtone"
  | "ringback"
  | "callConnected"
  | "callEnded"
  | "roomJoin"
  | "roomLeave"
  | "roomEnded"
  | "muted"
  | "reconnecting"
  | "reconnected"
  | "message";

export const SOUND_CATEGORY: Record<SoundId, SoundCategory> = {
  ringtone: "calls",
  ringback: "calls",
  callConnected: "calls",
  callEnded: "calls",
  roomJoin: "rooms",
  roomLeave: "rooms",
  roomEnded: "rooms",
  muted: "rooms",
  reconnecting: "calls",
  reconnected: "calls",
  message: "messages",
};

export interface SoundSettings {
  /** 0 to 1. */
  master: number;
  calls: boolean;
  rooms: boolean;
  messages: boolean;
}

export const DEFAULT_SOUNDS: SoundSettings = {
  master: 0.7,
  calls: true,
  rooms: true,
  messages: false,
};

/** Two sounds closer than this are one: the later one is dropped, so a burst never turns into noise. */
export const MIN_GAP_MS = 300;

interface Note {
  freq: number;
  /** Seconds after the start of the sound. */
  at: number;
  /** Seconds. */
  length: number;
  /** A second frequency that the note glides to. */
  to?: number;
  /** Loudness before the master volume, 0 to 1. */
  gain?: number;
}

/** The notes of every one-shot and of one round of every loop. */
export const SOUND_NOTES: Record<SoundId, readonly Note[]> = {
  ringtone: [
    { freq: 660, at: 0, length: 0.35 },
    { freq: 880, at: 0.45, length: 0.35 },
  ],
  ringback: [
    { freq: 440, at: 0, length: 1, gain: 0.5 },
    { freq: 480, at: 0, length: 1, gain: 0.5 },
  ],
  callConnected: [
    { freq: 523, at: 0, length: 0.12 },
    { freq: 659, at: 0.12, length: 0.12 },
    { freq: 784, at: 0.24, length: 0.2 },
  ],
  callEnded: [
    { freq: 523, at: 0, length: 0.14 },
    { freq: 392, at: 0.15, length: 0.22 },
  ],
  roomJoin: [{ freq: 600, to: 820, at: 0, length: 0.14, gain: 0.7 }],
  roomLeave: [{ freq: 820, to: 560, at: 0, length: 0.16, gain: 0.7 }],
  roomEnded: [
    { freq: 660, at: 0, length: 0.2 },
    { freq: 523, at: 0.22, length: 0.2 },
    { freq: 392, at: 0.44, length: 0.4 },
  ],
  muted: [
    { freq: 330, at: 0, length: 0.1 },
    { freq: 330, at: 0.16, length: 0.1 },
  ],
  reconnecting: [{ freq: 300, at: 0, length: 0.3, gain: 0.5 }],
  reconnected: [
    { freq: 784, at: 0, length: 0.12 },
    { freq: 988, at: 0.13, length: 0.22 },
  ],
  message: [{ freq: 880, at: 0, length: 0.1, gain: 0.6 }],
};

/** How often a loop starts its next round, in milliseconds. */
export const LOOP_EVERY_MS: Partial<Record<SoundId, number>> = { ringtone: 2000, ringback: 3000 };

export interface SoundDeps {
  createContext: () => AudioContext;
  now: () => number;
  /** True while the tab is hidden. */
  hidden: () => boolean;
  /** True in the person's quiet hours. */
  quiet: () => boolean;
  vibrate?: (pattern: number | number[]) => void;
  setInterval: (fn: () => void, ms: number) => unknown;
  clearInterval: (id: unknown) => void;
}

export class SoundManager {
  private ctx: AudioContext | null = null;
  private settings: SoundSettings = { ...DEFAULT_SOUNDS };
  private lastAt = -Infinity;
  private loops = new Map<SoundId, unknown>();

  constructor(private readonly deps: SoundDeps) {}

  configure(settings: SoundSettings): void {
    this.settings = { ...settings };
    // Switching a category off ends its loops at once.
    for (const id of [...this.loops.keys()]) {
      if (!this.settings[SOUND_CATEGORY[id]]) this.stopLoop(id);
    }
  }

  getSettings(): SoundSettings {
    return { ...this.settings };
  }

  /** Browsers keep audio locked until a tap or key press. Call this from the first one. */
  unlock(): void {
    try {
      this.ctx ??= this.deps.createContext();
      void this.ctx.resume?.();
    } catch {
      // No audio on this device. Everything else keeps working.
    }
  }

  private allowed(id: SoundId, opts: { force?: boolean } = {}): boolean {
    if (!this.settings[SOUND_CATEGORY[id]] && !opts.force) return false;
    if (this.settings.master <= 0 && !opts.force) return false;
    if (this.deps.quiet() && !opts.force) return false;
    // A hidden tab is silent, except an incoming call that has to be heard.
    if (this.deps.hidden() && id !== "ringtone" && !opts.force) return false;
    return true;
  }

  private notes(id: SoundId): void {
    this.unlock();
    const ctx = this.ctx;
    if (!ctx) return;
    const base = ctx.currentTime;
    for (const n of SOUND_NOTES[id]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = base + n.at;
      const peak = 0.18 * (n.gain ?? 1) * this.settings.master;
      osc.type = "sine";
      osc.frequency.setValueAtTime(n.freq, start);
      if (n.to) osc.frequency.linearRampToValueAtTime(n.to, start + n.length);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + n.length);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + n.length + 0.05);
    }
  }

  /** Plays a short sound once. `force` is for the sample buttons in Settings. */
  play(id: SoundId, opts: { force?: boolean } = {}): boolean {
    if (LOOP_EVERY_MS[id]) return this.startLoop(id, opts);
    if (!this.allowed(id, opts)) return false;
    const now = this.deps.now();
    if (!opts.force && now - this.lastAt < MIN_GAP_MS) return false;
    this.lastAt = now;
    this.notes(id);
    return true;
  }

  /** Starts a loop such as the ringtone. It runs until `stopLoop` or `stopAll`. */
  startLoop(id: SoundId, opts: { force?: boolean } = {}): boolean {
    const every = LOOP_EVERY_MS[id];
    if (!every || this.loops.has(id) || !this.allowed(id, opts)) return false;
    const round = () => {
      if (!this.allowed(id, opts)) return;
      this.notes(id);
      if (id === "ringtone") this.deps.vibrate?.([300, 150, 300]);
    };
    round();
    this.loops.set(id, this.deps.setInterval(round, every));
    return true;
  }

  stopLoop(id: SoundId): void {
    const handle = this.loops.get(id);
    if (handle === undefined) return;
    this.deps.clearInterval(handle);
    this.loops.delete(id);
    if (id === "ringtone") this.deps.vibrate?.(0);
  }

  isLooping(id: SoundId): boolean {
    return this.loops.has(id);
  }

  /** Every exit path of a call or room ends here, so no loop can outlive the thing it belonged to. */
  stopAll(): void {
    for (const id of [...this.loops.keys()]) this.stopLoop(id);
  }

  dispose(): void {
    this.stopAll();
    void this.ctx?.close?.();
    this.ctx = null;
  }
}
