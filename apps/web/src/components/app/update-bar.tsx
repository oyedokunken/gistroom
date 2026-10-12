"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { pwa } from "@/content/app";
import { useCallStore } from "@/lib/calls/store";
import { useDrafts } from "@/lib/chat/drafts";
import { applyUpdate, updateBlockers, useUpdate } from "@/lib/update-gate";

/**
 * A small bar at the top of the app when a new version is waiting. It never blocks anything, never takes focus
 * and never reloads by itself in the middle of a call, a room or a message.
 */
export function UpdateBar() {
  const pathname = usePathname();
  const waiting = useUpdate((s) => s.waiting);
  const dismissed = useUpdate((s) => s.dismissed);
  const dismiss = useUpdate((s) => s.dismiss);
  const ringing = useCallStore((s) => s.incoming !== null);
  const drafts = useDrafts((s) => s.drafts);
  const [held, setHeld] = useState(false);

  if (!waiting || dismissed) return null;
  const blockers = updateBlockers({ pathname, ringing, drafts });
  // Nothing appears during a call or inside a room. The bar shows up once they are over.
  if (blockers.includes("call") || blockers.includes("room")) return null;

  function refresh() {
    if (blockers.length > 0) {
      setHeld(true);
      return;
    }
    applyUpdate();
  }

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border bg-green-100 px-4 py-2 text-sm text-ink-950"
    >
      <RefreshCw aria-hidden className="size-4 shrink-0 text-green-700" />
      <span className="min-w-0 flex-1">{held ? pwa.updateHeld(blockers) : pwa.updateBar}</span>
      <button
        type="button"
        onClick={refresh}
        className="min-h-11 rounded-full px-3 font-semibold text-green-700 underline-offset-4 hover:underline"
      >
        {pwa.updateConfirm}
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label={pwa.updateDismiss}
        className="flex size-11 items-center justify-center rounded-full hover:bg-green-600/10"
      >
        <X aria-hidden className="size-4" />
      </button>
    </div>
  );
}
