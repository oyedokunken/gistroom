"use client";

import { PwaRuntime } from "@/components/app/pwa-runtime";
import { IncomingCall } from "@/components/call/incoming-call";
import { ConnectionBanner } from "@/components/ui/connection-banner";
import { useOutboxFlusher } from "@/lib/chat/hooks";
import { useRealtimeStore } from "@/lib/realtime/store";
import { useOnline } from "@/lib/use-online";

/** Background work that must run on every signed in screen: the outbox flush and the connection banner. */
export function AppRuntime() {
  const online = useOnline();
  const connection = useRealtimeStore((s) => s.connection);
  useOutboxFlusher(online);
  const state = !online ? "offline" : connection === "reconnecting" ? "reconnecting" : "online";
  return (
    <>
      <PwaRuntime />
      <IncomingCall />
      <ConnectionBanner state={state} />
    </>
  );
}
