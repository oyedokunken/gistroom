"use client";

import { useConnection } from "./connection";

/** True while the line is down. Actions that need the network turn off and say why, never fail silently. */
export function useOffline(): boolean {
  return useConnection().state === "OFFLINE";
}
