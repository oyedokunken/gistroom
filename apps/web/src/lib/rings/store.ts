"use client";

import { create } from "zustand";
import {
  ringRemainingMs,
  type ActiveRingsDto,
  type PublicUser,
  type RecentRingDto,
  type RingDto,
} from "@gistroom/shared";
import { rings as copy } from "@/content/rings";
import { apiFetch } from "@/lib/api";
import { pushChip } from "@/lib/session/chips";

/** A card that stays a few seconds after the ring ended, to say so. */
export interface ClosingRing {
  id: string;
  text: string;
  person: PublicUser;
  until: number;
}

const MISSED_MS = 3_000;

interface RingStore {
  rings: RingDto[];
  /** The server clock at the last answer and this device's clock at the same moment, for the countdown. */
  serverNow: string;
  receivedAt: number;
  quiet: boolean;
  closing: ClosingRing[];
  /** Rings the person answered or declined on this tab, so their disappearing is not announced as news. */
  acted: Set<string>;
  apply: (data: ActiveRingsDto, now?: number) => void;
  markActed: (id: string) => void;
  drop: (id: string) => void;
  dropClosing: (id: string) => void;
}

/**
 * What changed between two looks at the list, as a pure function: which rings vanished, and what to say about each. A ring
 * answered on this tab says nothing. A call the other person cancelled says "Missed call" for three seconds. One answered
 * or declined on another device says so once. Rings that ran out or whose room ended just go.
 */
export function describeVanished(
  before: readonly RingDto[],
  after: readonly RingDto[],
  recent: readonly RecentRingDto[],
  acted: ReadonlySet<string>,
): { closing: { id: string; text: string; person: PublicUser }[]; chips: string[] } {
  const still = new Set(after.map((r) => r.id));
  const closing: { id: string; text: string; person: PublicUser }[] = [];
  const chips: string[] = [];
  for (const gone of before) {
    if (still.has(gone.id) || acted.has(gone.id)) continue;
    const why = recent.find((r) => r.id === gone.id)?.outcome;
    if (why === "CANCELLED" && gone.kind === "CALL") {
      closing.push({ id: gone.id, text: copy.missed(gone.from.name), person: gone.from });
    } else if (why === "ANSWERED_ELSEWHERE") chips.push(copy.chipAnswered);
    else if (why === "DECLINED_ELSEWHERE") chips.push(copy.chipDeclined);
  }
  return { closing, chips };
}

export const useRings = create<RingStore>((set, get) => ({
  rings: [],
  serverNow: new Date(0).toISOString(),
  receivedAt: 0,
  quiet: false,
  closing: [],
  acted: new Set(),
  apply: (data, now = Date.now()) => {
    const state = get();
    const { closing, chips } = describeVanished(state.rings, data.rings, data.recent, state.acted);
    for (const text of chips) pushChip({ text, kind: "call" });
    // A call that rang out is finished by the server as missed. The list dropping it is the first we may hear, so
    // ask for that here too. It is harmless to ask twice.
    const asOf = new Date(data.serverNow).getTime();
    for (const gone of state.rings) {
      const still = data.rings.some((r) => r.id === gone.id);
      if (!still && gone.callId && new Date(gone.expiresAt).getTime() <= asOf + 1_000) {
        void apiFetch(`/api/calls/${gone.callId}/timeout`, { body: {} }).catch(() => undefined);
      }
    }
    const keep = new Set(data.rings.map((r) => r.id));
    set({
      rings: data.rings,
      serverNow: data.serverNow,
      receivedAt: now,
      quiet: data.quiet,
      closing: [
        ...state.closing.filter((c) => c.until > now),
        ...closing.map((c) => ({ ...c, until: now + MISSED_MS })),
      ],
      acted: new Set([...state.acted].filter((id) => keep.has(id))),
    });
  },
  markActed: (id) =>
    set((s) => ({
      acted: new Set([...s.acted, id]),
      rings: s.rings.filter((r) => r.id !== id),
    })),
  drop: (id) => set((s) => ({ rings: s.rings.filter((r) => r.id !== id) })),
  dropClosing: (id) => set((s) => ({ closing: s.closing.filter((c) => c.id !== id) })),
}));

/** Time left on a ring, on the server's clock. */
export function remainingMs(ring: RingDto, now: number): number {
  const s = useRings.getState();
  return ringRemainingMs({
    expiresAt: ring.expiresAt,
    serverNow: s.serverNow,
    receivedAt: s.receivedAt,
    now,
  });
}

let inflight: Promise<void> | null = null;

/** Asks the server what is ringing. Many callers at once share one request. */
export function refreshRings(): Promise<void> {
  inflight ??= apiFetch<ActiveRingsDto>("/api/rings/active")
    .then((data) => useRings.getState().apply(data))
    .catch(() => undefined)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
