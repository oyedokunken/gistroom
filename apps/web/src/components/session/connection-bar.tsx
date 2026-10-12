"use client";

import { useEffect, useState } from "react";
import { CloudOff, Loader2, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/cn";
import { session } from "@/content/session";
import { useConnection } from "@/lib/session/connection";

/**
 * The bar under the header. It says "You're offline" while the line is down, "Back online" for three seconds when it
 * returns, and a quiet note when only the chat connection is slow. It sits above the tab bar on phones. It is an inline
 * bar and not a toast, and it never blocks anything.
 */
export function ConnectionBar() {
  const { state, serverError, realtimeNote } = useConnection();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  let text: string | null = null;
  let icon = <WifiOff aria-hidden className="size-4 shrink-0" />;
  let tone = "bg-yellow-100 text-ink-950";
  if (state === "OFFLINE") {
    text = session.offlineBar;
  } else if (state === "RECOVERED") {
    text = session.backOnline;
    icon = <Wifi aria-hidden className="size-4 shrink-0" />;
    tone = "bg-green-100 text-green-700";
  } else if (serverError) {
    text = session.serverDown;
    icon = <CloudOff aria-hidden className="size-4 shrink-0" />;
  } else if (realtimeNote === "connecting") {
    text = session.connectingChat;
    icon = (
      <Loader2 aria-hidden className="size-4 shrink-0 animate-spin motion-reduce:animate-none" />
    );
    tone = "bg-surface-2 text-text-muted";
  } else if (realtimeNote === "slow") {
    text = session.chatSlow;
    tone = "bg-surface-2 text-text-muted";
  }
  if (!text) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-connection-bar={state}
      className={cn(
        "z-40 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium",
        // On phones it floats above the tab bar. On wider screens it sits under the header.
        "fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] shadow-soft md:sticky md:inset-x-auto md:bottom-auto md:top-14 md:shadow-none",
        tone,
      )}
    >
      {icon}
      {text}
    </div>
  );
}
