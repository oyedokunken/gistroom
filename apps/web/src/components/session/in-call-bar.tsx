"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Maximize2, Mic, MicOff, PhoneOff } from "lucide-react";
import { session as copy } from "@/content/session";
import { formatDuration } from "@/lib/chat/voice";
import { live, useLive } from "@/lib/live/live-session";
import { useNow } from "@/lib/session/use-held";
import { cn } from "@/lib/cn";

/**
 * A small bar that follows you around while a call or room is on and you are somewhere else in the app: the timer, mute,
 * a way back, and hang up. The connection belongs to the tab, so leaving the call screen never ends the call.
 */
export function InCallBar() {
  const s = useLive();
  const pathname = usePathname();
  const active = s.kind !== null && s.status !== "idle" && s.startedAt !== null;
  const now = useNow(active);
  if (!active || !s.refId || !s.kind) return null;
  const home = s.kind === "call" ? `/app/call/${s.refId}` : `/app/rooms/${s.refId}`;
  // The call and room screens have their own controls.
  if (pathname === home) return null;
  const elapsed = formatDuration(now - (s.startedAt ?? now));
  return (
    <div
      role="region"
      aria-label={copy.call.inCall}
      className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-3 right-3 z-[64] mx-auto flex max-w-md items-center gap-2 rounded-full bg-green-700 p-1.5 pl-4 text-white shadow-lift md:bottom-6 md:left-auto md:right-6 md:mx-0"
    >
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">
        {copy.call.inCall}: {s.title}
        <span className="tabular ml-2 font-normal text-white/80">{elapsed}</span>
      </span>
      <button
        type="button"
        aria-label={s.micOn ? copy.controls.mute : copy.controls.unmute}
        aria-pressed={!s.micOn}
        onClick={() => void live().toggleMic()}
        className={cn(
          "flex size-11 items-center justify-center rounded-full",
          s.micOn ? "bg-white/15" : "bg-yellow-400 text-ink-950",
        )}
      >
        {s.micOn ? (
          <Mic aria-hidden className="size-5" />
        ) : (
          <MicOff aria-hidden className="size-5" />
        )}
      </button>
      <Link
        href={home}
        aria-label={copy.call.returnToCall}
        className="flex size-11 items-center justify-center rounded-full bg-white/15"
      >
        <Maximize2 aria-hidden className="size-5" />
      </Link>
      <button
        type="button"
        aria-label={copy.modal.hangUp}
        onClick={() => void live().hangUp()}
        className="flex size-11 items-center justify-center rounded-full bg-danger-600"
      >
        <PhoneOff aria-hidden className="size-5" />
      </button>
    </div>
  );
}
