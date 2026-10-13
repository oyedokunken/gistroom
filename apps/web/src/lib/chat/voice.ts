import { WAVEFORM_BARS } from "@gistroom/shared";

/** Voice note formats in the order we prefer them: opus in webm first, mp4 for Safari (Section 9.3). */
export const VOICE_MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
] as const;

/** The first format this browser can record, or null when it cannot record at all. */
export function pickVoiceMime(
  isSupported: (mime: string) => boolean = (m) =>
    typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m),
): string | null {
  return VOICE_MIME_CANDIDATES.find((m) => isSupported(m)) ?? null;
}

/** "audio/webm;codecs=opus" becomes "audio/webm", which is what the server accepts. */
export const baseMime = (mime: string): string => mime.split(";")[0]?.trim() ?? mime;

export function extensionForMime(mime: string): string {
  const base = baseMime(mime);
  if (base === "audio/mp4") return "m4a";
  if (base === "audio/ogg") return "ogg";
  if (base === "audio/mpeg") return "mp3";
  return "webm";
}

/** Shrink a list of loudness samples (0 to 1) to a fixed number of bars from 0 to 100. */
export function toWaveform(samples: readonly number[], bars = WAVEFORM_BARS): number[] {
  if (samples.length === 0) return Array.from({ length: bars }, () => 0);
  const out: number[] = [];
  for (let i = 0; i < bars; i++) {
    const from = Math.floor((i * samples.length) / bars);
    const to = Math.max(from + 1, Math.floor(((i + 1) * samples.length) / bars));
    let peak = 0;
    for (let j = from; j < Math.min(to, samples.length); j++)
      peak = Math.max(peak, samples[j] ?? 0);
    out.push(peak);
  }
  const max = Math.max(...out, 0.0001);
  return out.map((v) => Math.round((v / max) * 100));
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  // Under an hour it is m:ss. From an hour on it is h:mm:ss.
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}
