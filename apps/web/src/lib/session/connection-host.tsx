"use client";

import { useEffect } from "react";
import { useRealtimeStore } from "@/lib/realtime/store";
import { NET } from "./config";
import { emitNetState, setLiveKitStatus, useConnectionStore } from "./connection";
import { rawState, start, step, type NetSample } from "./connection-machine";

interface NetworkInformation extends EventTarget {
  effectiveType?: string;
  type?: string;
}
const networkInfo = (): NetworkInformation | undefined =>
  (navigator as Navigator & { connection?: NetworkInformation }).connection;

/**
 * Watches the connection and keeps `useConnection()` fresh. `navigator.onLine` is only one input: a health check runs
 * every 10 seconds while the app is visible and every 30 seconds hidden, so a captive portal or a Wi-Fi with no data
 * is noticed. A change has to hold for 3 seconds before anything reacts.
 */
export function ConnectionMonitorHost() {
  useEffect(() => {
    const store = useConnectionStore;
    let machine = start(Date.now());
    store
      .getState()
      .patch({ state: machine.state, since: machine.since, lastOnlineAt: machine.lastOnlineAt });
    const rtts: number[] = [];
    const sample: NetSample = {
      deviceOnline: navigator.onLine,
      apiReachable: null,
      serverError: false,
      recentRtts: rtts,
      effectiveType: networkInfo()?.effectiveType ?? null,
    };
    let probing = false;
    let probeTimer: number | undefined;
    let quietSince: number | null = null;

    async function probe() {
      if (probing) return;
      probing = true;
      const began = performance.now();
      const abort = new AbortController();
      const timeout = window.setTimeout(() => abort.abort(), NET.probeTimeoutMs);
      try {
        const res = await fetch("/api/health", {
          method: "HEAD",
          cache: "no-store",
          signal: abort.signal,
        });
        const rtt = Math.round(performance.now() - began);
        rtts.push(rtt);
        if (rtts.length > 6) rtts.shift();
        sample.apiReachable = true;
        sample.serverError = res.status >= 500;
        store.getState().patch({ rttMs: rtt, serverError: sample.serverError });
      } catch {
        // No answer at all. A timeout counts as a very slow round trip.
        rtts.push(NET.probeTimeoutMs);
        if (rtts.length > 6) rtts.shift();
        sample.apiReachable = false;
        sample.serverError = false;
        store.getState().patch({ rttMs: null, serverError: false });
      } finally {
        window.clearTimeout(timeout);
        probing = false;
      }
    }

    function schedule() {
      window.clearTimeout(probeTimer);
      const wait =
        document.visibilityState === "visible" ? NET.heartbeatVisibleMs : NET.heartbeatHiddenMs;
      probeTimer = window.setTimeout(() => {
        void probe().finally(schedule);
      }, wait);
    }

    const tick = window.setInterval(() => {
      const now = Date.now();
      const info = store.getState();
      sample.livekitPoor = info.livekitPoor;
      sample.livekitReconnecting = info.livekit === "reconnecting";
      sample.effectiveType = networkInfo()?.effectiveType ?? null;
      const previous = machine.state;
      machine = step(machine, rawState(sample), now);
      if (machine.state !== previous) {
        store.getState().patch({
          state: machine.state,
          since: machine.since,
          lastOnlineAt: machine.lastOnlineAt,
        });
        emitNetState(machine.state, previous);
      } else if (machine.lastOnlineAt !== info.lastOnlineAt && machine.state !== "OFFLINE") {
        store.getState().patch({ lastOnlineAt: machine.lastOnlineAt });
      }

      // The realtime service can be asleep. That is a quiet note, never a dialog, and chat works over plain requests.
      const rt = useRealtimeStore.getState().connection;
      store.getState().patch({ realtime: rt });
      if (rt !== "online" && sample.apiReachable && sample.deviceOnline) {
        quietSince ??= now;
        const note = now - quietSince > NET.realtimeQuietMs ? "slow" : "connecting";
        if (store.getState().realtimeNote !== note) store.getState().patch({ realtimeNote: note });
      } else if (quietSince !== null || store.getState().realtimeNote !== null) {
        quietSince = null;
        store.getState().patch({ realtimeNote: null });
      }
    }, 500);

    const onOnline = () => {
      sample.deviceOnline = true;
      void probe();
    };
    const onOffline = () => {
      sample.deviceOnline = false;
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void probe();
      schedule();
    };
    const info = networkInfo();
    const onSwitch = () => store.getState().patch({ switchedAt: Date.now() });
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisible);
    info?.addEventListener("change", onSwitch);
    void probe();
    schedule();

    return () => {
      window.clearInterval(tick);
      window.clearTimeout(probeTimer);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisible);
      info?.removeEventListener("change", onSwitch);
      setLiveKitStatus("idle");
    };
  }, []);

  return null;
}
