import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SOUNDS,
  LOOP_EVERY_MS,
  MIN_GAP_MS,
  SOUND_CATEGORY,
  SOUND_NOTES,
  SoundManager,
  type SoundId,
} from "../../apps/web/src/lib/sound/sound-manager";

/** A stand in for AudioContext that counts what would have been played. */
function fakeContext() {
  const started: number[] = [];
  const ctx = {
    currentTime: 0,
    destination: {},
    resume: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
    createOscillator: () => ({
      type: "sine",
      frequency: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
      connect: vi.fn((n: unknown) => n),
      start: (t: number) => started.push(t),
      stop: vi.fn(),
    }),
    createGain: () => ({
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
    }),
  };
  return { ctx: ctx as unknown as AudioContext, started };
}

function setup(over: { hidden?: boolean; quiet?: boolean } = {}) {
  const { ctx, started } = fakeContext();
  let clock = 1000;
  const intervals = new Map<number, () => void>();
  let nextId = 1;
  const vibrate = vi.fn();
  const state = { hidden: over.hidden ?? false, quiet: over.quiet ?? false };
  const manager = new SoundManager({
    createContext: () => ctx,
    now: () => clock,
    hidden: () => state.hidden,
    quiet: () => state.quiet,
    vibrate,
    setInterval: (fn) => {
      const id = nextId++;
      intervals.set(id, fn);
      return id;
    },
    clearInterval: (id) => void intervals.delete(id as number),
  });
  return {
    manager,
    started,
    vibrate,
    state,
    intervals,
    advance: (ms: number) => (clock += ms),
    tickLoops: () => intervals.forEach((fn) => fn()),
  };
}

describe("sound manager", () => {
  let t: ReturnType<typeof setup>;
  beforeEach(() => {
    t = setup();
  });

  it("plays a sound as its notes", () => {
    expect(t.manager.play("callConnected")).toBe(true);
    expect(t.started).toHaveLength(SOUND_NOTES.callConnected.length);
  });

  it("stays silent for a category that is switched off", () => {
    t.manager.configure({ ...DEFAULT_SOUNDS, messages: false });
    expect(t.manager.play("message")).toBe(false);
    expect(t.started).toHaveLength(0);
    t.manager.configure({ ...DEFAULT_SOUNDS, messages: true });
    expect(t.manager.play("message")).toBe(true);
  });

  it("has messages off by default and calls and rooms on", () => {
    expect(DEFAULT_SOUNDS).toMatchObject({ calls: true, rooms: true, messages: false });
    expect(t.manager.play("message")).toBe(false);
    expect(t.manager.play("roomJoin")).toBe(true);
  });

  it("is silent at zero volume and in quiet hours", () => {
    t.manager.configure({ ...DEFAULT_SOUNDS, master: 0 });
    expect(t.manager.play("callEnded")).toBe(false);
    t.manager.configure(DEFAULT_SOUNDS);
    t.state.quiet = true;
    expect(t.manager.play("callEnded")).toBe(false);
    expect(t.manager.startLoop("ringtone")).toBe(false);
  });

  it("never lets two sounds overlap: a burst inside 300 ms is one sound", () => {
    expect(t.manager.play("roomJoin")).toBe(true);
    t.advance(MIN_GAP_MS - 50);
    expect(t.manager.play("roomJoin")).toBe(false);
    t.advance(100);
    expect(t.manager.play("roomJoin")).toBe(true);
  });

  it("stays quiet in a hidden tab except for an incoming call ring", () => {
    t.state.hidden = true;
    expect(t.manager.play("roomLeave")).toBe(false);
    expect(t.manager.play("callConnected")).toBe(false);
    expect(t.manager.startLoop("ringtone")).toBe(true);
    expect(t.manager.isLooping("ringtone")).toBe(true);
  });

  it("vibrates with the ringtone and stops everything when the loop stops", () => {
    t.manager.startLoop("ringtone");
    expect(t.vibrate).toHaveBeenCalledWith([300, 150, 300]);
    t.manager.stopLoop("ringtone");
    expect(t.manager.isLooping("ringtone")).toBe(false);
    expect(t.vibrate).toHaveBeenLastCalledWith(0);
    expect(t.intervals.size).toBe(0);
  });

  it("does not start the same loop twice", () => {
    expect(t.manager.startLoop("ringback")).toBe(true);
    expect(t.manager.startLoop("ringback")).toBe(false);
    expect(t.intervals.size).toBe(1);
  });

  it("keeps a loop going round after round until it is stopped", () => {
    t.manager.startLoop("ringtone");
    const first = t.started.length;
    t.tickLoops();
    expect(t.started.length).toBe(first * 2);
  });

  it("stops every loop on any exit path", () => {
    t.manager.startLoop("ringtone");
    t.manager.startLoop("ringback");
    t.manager.stopAll();
    expect(t.manager.isLooping("ringtone")).toBe(false);
    expect(t.manager.isLooping("ringback")).toBe(false);
    expect(t.intervals.size).toBe(0);
  });

  it("ends a loop at once when its category is switched off", () => {
    t.manager.startLoop("ringtone");
    t.manager.configure({ ...DEFAULT_SOUNDS, calls: false });
    expect(t.manager.isLooping("ringtone")).toBe(false);
  });

  it("lets the sample buttons play even when a category is off", () => {
    t.manager.configure({ ...DEFAULT_SOUNDS, messages: false });
    expect(t.manager.play("message", { force: true })).toBe(true);
  });

  it("gives every sound a category and notes, and a loop interval only to the loops", () => {
    for (const id of Object.keys(SOUND_NOTES) as SoundId[]) {
      expect(SOUND_CATEGORY[id]).toBeTruthy();
      expect(SOUND_NOTES[id].length).toBeGreaterThan(0);
    }
    expect(Object.keys(LOOP_EVERY_MS).sort()).toEqual(["ringback", "ringtone"]);
  });

  it("keeps every one shot sound short", () => {
    for (const id of Object.keys(SOUND_NOTES) as SoundId[]) {
      if (LOOP_EVERY_MS[id]) continue;
      const end = Math.max(...SOUND_NOTES[id].map((n) => n.at + n.length));
      expect(end, id).toBeLessThanOrEqual(1.5);
    }
  });
});
