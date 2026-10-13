"use client";

import { useEffect, useState } from "react";
import { Signal, Waves, WifiOff } from "lucide-react";
import { session as copy } from "@/content/session";
import { live, useLive } from "@/lib/live/live-session";
import { NETWORK_WEAK_AS_MODAL } from "@/lib/session/config";
import { useConnection } from "@/lib/session/connection";

/**
 * Banners for what may fix itself: switching networks, a weak line, a new headset. They sit at the top of the screen
 * while a call or room is on, never block anything and go away on their own. The weak line offers audio only.
 */
export function LiveBanners() {
  const s = useLive();
  const conn = useConnection();
  const [switching, setSwitching] = useState(false);
  const active = s.kind !== null && s.status !== "idle";

  // "Switching networks" shows for a few seconds after the network type changed. A reconnect that drags on becomes a dialog.
  useEffect(() => {
    if (!active || conn.switchedAt === null) return;
    setSwitching(true);
    const id = window.setTimeout(() => setSwitching(false), 5000);
    return () => window.clearTimeout(id);
  }, [active, conn.switchedAt]);

  // The "Switched to" note for a headset clears after a few seconds.
  useEffect(() => {
    if (!s.deviceNote) return;
    const id = window.setTimeout(() => live().clearDeviceNote(), 4000);
    return () => window.clearTimeout(id);
  }, [s.deviceNote]);

  if (!active) return null;
  const rows: { id: string; icon: React.ReactNode; text: string; action?: React.ReactNode }[] = [];
  if (switching) {
    rows.push({
      id: "switch",
      icon: <Waves aria-hidden className="size-4 shrink-0" />,
      text: copy.net.switchingNetworks,
    });
  }
  if (s.poorFor10s && !NETWORK_WEAK_AS_MODAL) {
    rows.push({
      id: "weak",
      icon: <WifiOff aria-hidden className="size-4 shrink-0" />,
      text: s.kind === "call" ? copy.net.weak : copy.net.weakRoom,
      action:
        s.camOn || s.kind === "call" ? (
          <button
            type="button"
            onClick={() => void live().setCamera(false)}
            className="min-h-11 shrink-0 rounded-full bg-ink-950 px-4 text-sm font-semibold text-white"
          >
            {copy.net.switchAudio}
          </button>
        ) : null,
    });
  }
  if (s.deviceNote) {
    rows.push({
      id: "device",
      icon: <Signal aria-hidden className="size-4 shrink-0" />,
      text: copy.devices.switchedTo(s.deviceNote),
    });
  }
  if (rows.length === 0) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-3 top-3 z-[75] mx-auto flex max-w-xl flex-col gap-2"
    >
      {rows.map((r) => (
        <div
          key={r.id}
          className="pointer-events-auto flex items-center gap-3 rounded-card bg-yellow-400 px-4 py-2 text-sm font-semibold text-ink-950 shadow-lift"
        >
          {r.icon}
          <span className="min-w-0 flex-1">{r.text}</span>
          {r.action}
        </div>
      ))}
    </div>
  );
}
