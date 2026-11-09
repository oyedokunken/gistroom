/**
 * Every state of the voice note player, as token classes. Mine sits on a green bubble, theirs on a neutral one.
 * tests/unit/voice-contrast.test.ts checks each text pair against WCAG AA in light and dark.
 */
export interface VoiceStyle {
  play: string;
  speed: string;
  waveRest: string;
  wavePlayed: string;
  time: string;
}

const base = "transition-colors focus-visible:outline-2 focus-visible:outline-offset-2";

export function voiceStyle(mine: boolean): VoiceStyle {
  return mine
    ? {
        play: `${base} bg-white text-green-700 hover:bg-green-100 hover:text-green-700 focus-visible:bg-green-100 focus-visible:outline-white disabled:opacity-60`,
        speed: `${base} bg-green-700 text-white hover:bg-ink-950 hover:text-white focus-visible:bg-ink-950 focus-visible:outline-white disabled:opacity-60`,
        waveRest: "bg-white/75",
        wavePlayed: "bg-yellow-400",
        time: "text-white",
      }
    : {
        play: `${base} bg-green-600 text-white hover:bg-green-700 hover:text-white focus-visible:bg-green-700 focus-visible:outline-green-700 disabled:opacity-60`,
        speed: `${base} bg-surface text-text hover:bg-green-100 hover:text-ink-950 focus-visible:bg-green-100 focus-visible:text-ink-950 focus-visible:outline-green-700 disabled:opacity-60 dark:hover:bg-surface-2 dark:hover:text-text`,
        waveRest: "bg-text-muted",
        wavePlayed: "bg-green-600",
        time: "text-text-muted",
      };
}
