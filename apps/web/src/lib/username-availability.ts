"use client";

import { useEffect, useRef, useState } from "react";
import { usernameSchema } from "@gistroom/shared";
import { apiFetch } from "@/lib/api";

export type UsernameState =
  | { status: "idle" }
  | { status: "typing" }
  | { status: "checking" }
  | { status: "available" }
  | { status: "taken" }
  | { status: "invalid"; message: string }
  | { status: "error" };

export const DEBOUNCE_MS = 400;

export type UsernameCheck = (
  username: string,
  signal: AbortSignal,
) => Promise<{ available: boolean; reason: string | null }>;

/** What can be said without asking the server: nothing typed, the person's own name, or a name that breaks the rules. */
export function localState(raw: string, own?: string): UsernameState | null {
  const value = raw.trim().toLowerCase();
  if (!value || value === own) return { status: "idle" };
  const parsed = usernameSchema.safeParse(value);
  if (!parsed.success) return { status: "invalid", message: parsed.error.issues[0]?.message ?? "" };
  return null;
}

/** Asks the server and turns the answer, or the failure, into a state. */
export async function resolveUsername(
  value: string,
  check: UsernameCheck,
  signal: AbortSignal,
): Promise<UsernameState | "aborted"> {
  try {
    const res = await check(value, signal);
    if (res.available) return { status: "available" };
    return res.reason ? { status: "invalid", message: res.reason } : { status: "taken" };
  } catch (e) {
    if (signal.aborted || (e instanceof DOMException && e.name === "AbortError")) return "aborted";
    return { status: "error" };
  }
}

/** Hands out run numbers, so an answer that arrives late can tell it is no longer the latest. */
export function latestRun() {
  let current = 0;
  return { next: () => ++current, isLatest: (run: number) => run === current };
}

const fetchCheck: UsernameCheck = (username, signal) =>
  apiFetch(`/api/username/check?username=${encodeURIComponent(username)}`, { signal });

/**
 * Live username availability as a small state machine: idle, typing, checking, available, taken, invalid, error.
 * Typing resets the clock and aborts the request in flight, and a late answer never overwrites a newer one.
 * The server checks again on submit.
 */
export function useUsernameAvailability(
  raw: string,
  own?: string,
  check: UsernameCheck = fetchCheck,
): UsernameState {
  const [state, setState] = useState<UsernameState>({ status: "idle" });
  const runs = useRef(latestRun());
  // The checker is read when the timer fires, so a new function from the caller never restarts the wait.
  const checkRef = useRef(check);
  checkRef.current = check;

  useEffect(() => {
    const run = runs.current.next();
    const immediate = localState(raw, own);
    if (immediate) {
      setState(immediate);
      return;
    }
    setState({ status: "typing" });
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      if (!runs.current.isLatest(run)) return;
      setState({ status: "checking" });
      const next = await resolveUsername(
        raw.trim().toLowerCase(),
        checkRef.current,
        controller.signal,
      );
      if (next === "aborted" || !runs.current.isLatest(run)) return;
      setState(next);
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [raw, own]);

  return state;
}
