import { NET } from "./config";

export type NetState = "ONLINE" | "WEAK" | "OFFLINE" | "RECONNECTING" | "RECOVERED";

/** What one look at the network found. */
export interface NetSample {
  /** `navigator.onLine`. It lies on captive portals and Wi-Fi with no data, so it is never enough on its own. */
  deviceOnline: boolean;
  /** Did our own health check answer? null means we have not asked yet. */
  apiReachable: boolean | null;
  /** The health check answered with an error status, so the device is online and the server is not. */
  serverError: boolean;
  /** Round trips of the last probes, newest last. */
  recentRtts: readonly number[];
  /** Network Information API effective type, when the browser has one. */
  effectiveType?: string | null;
  /** LiveKit says the connection is poor. */
  livekitPoor?: boolean;
  /** LiveKit is in the middle of reconnecting a call or room. */
  livekitReconnecting?: boolean;
}

/** The state this sample suggests, before any debounce. */
export function rawState(s: NetSample): Exclude<NetState, "RECOVERED"> {
  if (!s.deviceOnline) return "OFFLINE";
  // Online by the browser's word but our own server did not answer at all: a captive portal or a dead line.
  if (s.apiReachable === false && !s.serverError) return "OFFLINE";
  if (s.livekitReconnecting) return "RECONNECTING";
  const last = s.recentRtts.slice(-NET.slowStreak);
  const slow = last.length >= NET.slowStreak && last.every((r) => r > NET.slowRttMs);
  const verySlow = s.effectiveType === "slow-2g" || s.effectiveType === "2g";
  if (slow || verySlow || s.livekitPoor) return "WEAK";
  return "ONLINE";
}

export interface Machine {
  /** The state screens react to. */
  state: NetState;
  /** When `state` last changed. */
  since: number;
  /** A different raw state that is waiting to prove it holds. */
  pending: Exclude<NetState, "RECOVERED"> | null;
  pendingSince: number;
  /** The last time the state was ONLINE or WEAK, which both mean we could reach the server. */
  lastOnlineAt: number | null;
}

export function start(now: number): Machine {
  return { state: "ONLINE", since: now, pending: null, pendingSince: now, lastOnlineAt: now };
}

const isBad = (s: NetState) => s === "OFFLINE" || s === "RECONNECTING";

/**
 * Moves the machine one step. A change to a worse state must hold for `showAfterMs`. A change back to a better one
 * must hold for `clearAfterMs`. Coming back from OFFLINE shows RECOVERED for `recoveredMs`, then ONLINE.
 */
export function step(m: Machine, raw: Exclude<NetState, "RECOVERED">, now: number): Machine {
  let next: Machine = { ...m };

  // Recovered is a short celebration. It ends by itself.
  if (next.state === "RECOVERED" && now - next.since >= NET.recoveredMs) {
    next = { ...next, state: "ONLINE", since: now };
  }
  const current = next.state === "RECOVERED" ? "ONLINE" : next.state;

  if (raw === current) {
    next.pending = null;
  } else {
    if (next.pending !== raw) {
      next.pending = raw;
      next.pendingSince = now;
    }
    const worse =
      raw === "OFFLINE" || raw === "RECONNECTING" || (raw === "WEAK" && current === "ONLINE");
    const wait = worse ? NET.showAfterMs : NET.clearAfterMs;
    if (now - next.pendingSince >= wait) {
      const cameBack = isBad(current) && (raw === "ONLINE" || raw === "WEAK");
      next = {
        ...next,
        state: cameBack ? "RECOVERED" : raw,
        since: now,
        pending: null,
        pendingSince: now,
      };
    }
  }
  if (next.state === "ONLINE" || next.state === "WEAK" || next.state === "RECOVERED") {
    next.lastOnlineAt = now;
  }
  return next;
}

/**
 * Holds a condition steady before anyone reacts to it. `active` has to stay true for `showAfterMs` to turn on,
 * and false for `clearAfterMs` to turn off. Pure, so it can be tested with fake times.
 */
export interface Hold {
  on: boolean;
  /** When `active` last flipped away from `on`. Null while they agree. */
  flippedAt: number | null;
}

export const holdStart: Hold = { on: false, flippedAt: null };

export function holdStep(
  h: Hold,
  active: boolean,
  now: number,
  showAfterMs: number = NET.showAfterMs,
  clearAfterMs: number = NET.clearAfterMs,
): Hold {
  if (active === h.on) return h.flippedAt === null ? h : { on: h.on, flippedAt: null };
  const flippedAt = h.flippedAt ?? now;
  const wait = active ? showAfterMs : clearAfterMs;
  return now - flippedAt >= wait ? { on: active, flippedAt: null } : { on: h.on, flippedAt };
}
