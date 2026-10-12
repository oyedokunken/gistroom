/**
 * Tuning for connection states and session modals. One place, so the owner can change the feel without hunting.
 */

/** Weak signal is a banner by default. A dialog every few seconds would interrupt the conversation. */
export const NETWORK_WEAK_AS_MODAL = false;

export const NET = {
  /** A change has to hold this long before any screen reacts, so a one second blip never shows a modal. */
  showAfterMs: 3000,
  /** Recovery has to hold this long before a modal closes, so a flapping line does not flicker. */
  clearAfterMs: 2000,
  /** How long "Back online" stays up once the connection returns. */
  recoveredMs: 3000,
  heartbeatVisibleMs: 10_000,
  heartbeatHiddenMs: 30_000,
  probeTimeoutMs: 4000,
  /** Round trips above this, three in a row, count as a weak connection. */
  slowRttMs: 1500,
  slowStreak: 3,
  /** The realtime service may be asleep. Say "Connecting" for this long, then "Taking longer than usual". */
  realtimeQuietMs: 20_000,
  /** Offline for this long inside a call or room turns "You're offline" into "You were disconnected". */
  offlineToDisconnectedMs: 60_000,
  /** Poor quality has to last this long before the weak connection banner shows. */
  poorQualityMs: 10_000,
  /** The other person's quality stays Lost this long before we say we are waiting for them. */
  peerLostMs: 5000,
  /** After this long the call ends for good. */
  peerGoneMs: 60_000,
} as const;
