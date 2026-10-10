"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Phone, PhoneOff, Video } from "lucide-react";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { Avatar } from "@/components/ui/avatar";
import { callCopy as copy } from "@/content/calls";
import { ApiClientError } from "@/lib/api";
import { callAction } from "@/lib/calls/api";
import { startRingtone, stopRingtone } from "@/lib/calls/ringtone";
import { useCallStore } from "@/lib/calls/store";

/**
 * The ring. Shows on every signed in screen while someone is calling, announces itself to screen readers,
 * and goes away when the call is answered anywhere, declined, cancelled or runs out (Section 9.4).
 */
export function IncomingCall() {
  const call = useCallStore((s) => s.incoming);
  const setIncoming = useCallStore((s) => s.setIncoming);
  const pathname = usePathname();
  const router = useRouter();
  const { showError } = useFeedback();
  const [busy, setBusy] = useState(false);

  const onCallScreen = call ? pathname.startsWith(`/app/call/${call.id}`) : false;
  const visible = Boolean(call) && !onCallScreen;

  // Ring while it is showing. Stop the moment it is not.
  useEffect(() => {
    if (!visible) return;
    startRingtone();
    return () => stopRingtone();
  }, [visible]);

  // Past the ring time, ask the server to finish it and drop the overlay.
  useEffect(() => {
    if (!call) return;
    const wait = Math.max(0, new Date(call.ringExpiresAt).getTime() - Date.now());
    const id = window.setTimeout(() => {
      void callAction(call.id, "timeout").catch(() => undefined);
      setIncoming(null);
    }, wait + 400);
    return () => window.clearTimeout(id);
  }, [call, setIncoming]);

  if (!call || !visible) return null;

  async function answer() {
    if (!call) return;
    setBusy(true);
    try {
      await callAction(call.id, "accept");
      setIncoming(null);
      router.push(`/app/call/${call.id}`);
    } catch (e) {
      showError(e instanceof ApiClientError ? e.message : copy.loadError);
      setIncoming(null);
    } finally {
      setBusy(false);
    }
  }

  async function decline() {
    if (!call) return;
    setBusy(true);
    try {
      await callAction(call.id, "decline");
    } catch {
      // Already over. Nothing to show.
    } finally {
      setIncoming(null);
      setBusy(false);
    }
  }

  const video = call.media === "VIDEO";
  return (
    <div
      role="alertdialog"
      aria-modal="false"
      aria-live="assertive"
      aria-label={copy.incomingTitle(call.peer.name)}
      className="fixed inset-x-3 top-3 z-[70] mx-auto flex max-w-md items-center gap-4 rounded-hero bg-ink-950 p-4 text-white shadow-lift md:top-6"
    >
      <span className="relative shrink-0">
        <Avatar name={call.peer.name} src={call.peer.avatarUrl} size={56} />
        <span
          aria-hidden
          className="absolute -inset-1 rounded-full border-4 border-yellow-400 motion-safe:animate-pulse"
        />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-lg font-bold">{call.peer.name}</p>
        <p className="flex items-center gap-1.5 text-sm text-white/80">
          {video ? (
            <Video aria-hidden className="size-4" />
          ) : (
            <Phone aria-hidden className="size-4" />
          )}
          {video ? copy.video : copy.audio}
        </p>
      </div>
      <button
        type="button"
        onClick={() => void decline()}
        disabled={busy}
        aria-label={`${copy.decline}: ${call.peer.name}`}
        className="flex size-14 shrink-0 items-center justify-center rounded-full bg-danger-600 text-white disabled:opacity-60"
      >
        <PhoneOff aria-hidden className="size-6" />
      </button>
      <button
        type="button"
        onClick={() => void answer()}
        disabled={busy}
        aria-label={`${copy.answer}: ${call.peer.name}`}
        className="flex size-14 shrink-0 items-center justify-center rounded-full bg-green-600 text-white disabled:opacity-60"
      >
        {video ? (
          <Video aria-hidden className="size-6" />
        ) : (
          <Phone aria-hidden className="size-6" />
        )}
      </button>
    </div>
  );
}
