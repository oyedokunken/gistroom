"use client";

import { apiFetch } from "@/lib/api";

const sent = new Map<string, number>();

/** Tells the server which dialog a person saw, once a minute per code, so real world trouble can be found in the logs. */
export function reportSessionEvent(code: string, kind?: "call" | "room"): void {
  const now = Date.now();
  if (now - (sent.get(code) ?? 0) < 60_000) return;
  sent.set(code, now);
  void apiFetch("/api/session-events", { body: { code, kind } }).catch(() => undefined);
}
