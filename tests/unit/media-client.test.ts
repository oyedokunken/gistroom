import { describe, expect, it } from "vitest";
import { fitWithin } from "../../apps/web/src/lib/chat/image";
import {
  baseMime,
  extensionForMime,
  formatDuration,
  pickVoiceMime,
  toWaveform,
} from "../../apps/web/src/lib/chat/voice";

describe("voice helpers", () => {
  it("prefers opus in webm, then falls back to mp4 for Safari", () => {
    expect(pickVoiceMime(() => true)).toBe("audio/webm;codecs=opus");
    expect(pickVoiceMime((m) => m === "audio/mp4")).toBe("audio/mp4");
    expect(pickVoiceMime(() => false)).toBeNull();
  });
  it("sends the plain type without codec parameters", () => {
    expect(baseMime("audio/webm;codecs=opus")).toBe("audio/webm");
    expect(extensionForMime("audio/mp4")).toBe("m4a");
    expect(extensionForMime("audio/webm;codecs=opus")).toBe("webm");
  });
  it("shrinks samples to 64 bars with the loudest at 100", () => {
    const bars = toWaveform(Array.from({ length: 500 }, (_, i) => (i % 50) / 50));
    expect(bars).toHaveLength(64);
    expect(Math.max(...bars)).toBe(100);
    expect(toWaveform([])).toEqual(Array.from({ length: 64 }, () => 0));
  });
  it("formats durations as minutes and seconds", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(65_000)).toBe("1:05");
  });
});

describe("fitWithin", () => {
  it("keeps small images and scales big ones by the longest edge", () => {
    expect(fitWithin(800, 600, 2048)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(4096, 2048, 2048)).toEqual({ width: 2048, height: 1024 });
    expect(fitWithin(1000, 4000, 2000)).toEqual({ width: 500, height: 2000 });
  });
});
