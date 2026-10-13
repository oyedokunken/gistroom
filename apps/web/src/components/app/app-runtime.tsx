"use client";

import { PwaRuntime } from "@/components/app/pwa-runtime";
import { UpdateBar } from "@/components/app/update-bar";
import { IncomingCall } from "@/components/call/incoming-call";
import { ActivityChips } from "@/components/session/activity-chips";
import { ConnectionBar } from "@/components/session/connection-bar";
import { InCallBar } from "@/components/session/in-call-bar";
import { LiveBanners } from "@/components/session/live-banners";
import { LiveWatcher } from "@/components/session/live-watcher";
import { SessionModalHost } from "@/components/session/session-modal-host";
import { SoundGate } from "@/components/session/sound-gate";
import { useOutboxFlusher } from "@/lib/chat/hooks";
import { useConnection } from "@/lib/session/connection";
import { ConnectionMonitorHost } from "@/lib/session/connection-host";

/**
 * Background work that must run on every signed in screen: the connection monitor, the outbox flush, the offline
 * bar, the one dialog host for calls and rooms, and the activity chips.
 */
export function AppRuntime() {
  const { state } = useConnection();
  // Messages go out as soon as the line is back, without waiting for the "Back online" bar to finish.
  useOutboxFlusher(state !== "OFFLINE");
  return (
    <>
      <ConnectionMonitorHost />
      <SoundGate />
      <PwaRuntime />
      <UpdateBar />
      <IncomingCall />
      <ConnectionBar />
      <SessionModalHost />
      <LiveWatcher />
      <LiveBanners />
      <InCallBar />
      <ActivityChips />
    </>
  );
}
