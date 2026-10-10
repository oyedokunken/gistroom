/** Two soft beeps every two seconds, made with the Web Audio API so there is no sound file to download. */
let ctx: AudioContext | null = null;
let timer: number | undefined;

function beep(frequency: number, at: number, length: number, audio: AudioContext) {
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = "sine";
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.18, at + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.connect(gain).connect(audio.destination);
  osc.start(at);
  osc.stop(at + length + 0.05);
}

function ringOnce() {
  if (!ctx) return;
  const t = ctx.currentTime;
  beep(660, t, 0.35, ctx);
  beep(880, t + 0.45, 0.35, ctx);
  if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
}

/** Starts ringing. Browsers may keep audio silent until the person has touched the page, which is fine. */
export function startRingtone(): void {
  if (timer !== undefined) return;
  try {
    ctx ??= new AudioContext();
    void ctx.resume().catch(() => undefined);
    ringOnce();
    timer = window.setInterval(ringOnce, 2000);
  } catch {
    // No audio available. The ring still shows on screen.
  }
}

export function stopRingtone(): void {
  if (timer !== undefined) window.clearInterval(timer);
  timer = undefined;
  if (navigator.vibrate) navigator.vibrate(0);
}
