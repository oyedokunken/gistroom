import { sounds } from "@/lib/sound/sounds";

/** Starts the incoming ring. The sound manager owns the tones, the vibration and the quiet hours rule. */
export function startRingtone(): void {
  sounds().startLoop("ringtone");
}

export function stopRingtone(): void {
  sounds().stopLoop("ringtone");
}
