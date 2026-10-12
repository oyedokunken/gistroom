"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallStore } from "@/lib/calls/store";
import { useDrafts } from "@/lib/chat/drafts";
import { applyUpdate, isApplying, updateBlockers, useUpdate } from "@/lib/update-gate";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { alertHealth } from "@/content/app";
import { apiFetch } from "@/lib/api";
import { allowAlertsSteps, registerServiceWorker, syncPushOnLoad } from "@/lib/push-client";
import type { PushDeviceDto } from "@/app/api/push/devices/route";
import { usePwa, type BeforeInstallPromptEvent } from "@/lib/pwa";

/**
 * Registers the service worker on the first signed in load, captures the install prompt and keeps track of a new
 * version. A new version never interrupts anything: a small bar offers it, and it is applied by itself on the next
 * page change when there is no call, no open room and no unsent text. See UpdateBar and lib/update-gate.
 */
export function PwaRuntime() {
  const queryClient = useQueryClient();
  const { showInfo } = useFeedback();
  const pathname = usePathname();
  const waiting = useUpdate((s) => s.waiting);
  const ringing = useCallStore((s) => s.incoming !== null);
  const drafts = useDrafts((s) => s.drafts);
  const lastPath = useRef(pathname);

  // Apply a waiting version quietly when the person moves to another page and nothing is in progress.
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    if (waiting && updateBlockers({ pathname, ringing, drafts }).length === 0) applyUpdate();
  }, [pathname, waiting, ringing, drafts]);

  // Keep alerts healthy: once per load, make sure this browser's subscription exists and the server has it,
  // tell the person if the browser blocked alerts, and if three alerts in a row did not arrive on a device.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const outcome = await syncPushOnLoad(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
      if (cancelled) return;
      const told = (key: string) => {
        try {
          return window.sessionStorage.getItem(key) === "1";
        } catch {
          return false;
        }
      };
      const remember = (key: string) => {
        try {
          window.sessionStorage.setItem(key, "1");
        } catch {
          // Without storage the notice can show again on the next load.
        }
      };
      if (outcome === "denied") {
        const known = await apiFetch<{ devices: PushDeviceDto[] }>("/api/push/devices").catch(
          () => null,
        );
        // Only people who had alerts on here are told, not everyone who never turned them on.
        if (known?.devices.some((d) => d.current) && !told("gr_denied_told")) {
          remember("gr_denied_told");
          showInfo(
            `${alertHealth.deniedBody}\n\n${allowAlertsSteps(navigator.userAgent)
              .map((s, i) => `${i + 1}. ${s}`)
              .join("\n")}`,
            alertHealth.deniedTitle,
          );
        }
        return;
      }
      if (outcome === "synced") {
        const list = await apiFetch<{ devices: PushDeviceDto[] }>("/api/push/devices").catch(
          () => null,
        );
        const bad = list?.devices.filter((d) => d.notice) ?? [];
        if (bad.length > 0 && !told("gr_unhealthy_told")) {
          remember("gr_unhealthy_told");
          showInfo(
            `${alertHealth.unhealthyBody} ${bad.map((d) => d.label).join(", ")}.`,
            alertHealth.unhealthyTitle,
          );
          void apiFetch("/api/push/devices", { body: {} }).catch(() => undefined);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showInfo]);

  useEffect(() => {
    usePwa.getState().loadDismissed();
    if (window.matchMedia("(display-mode: standalone)").matches) usePwa.getState().setInstalled();

    const onPrompt = (e: Event) => {
      e.preventDefault();
      usePwa.getState().setPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => usePwa.getState().setInstalled();
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    // A dev server rebuilds constantly, so the worker only runs in production builds.
    if (process.env.NODE_ENV !== "production") {
      return () => {
        window.removeEventListener("beforeinstallprompt", onPrompt);
        window.removeEventListener("appinstalled", onInstalled);
      };
    }

    let reloading = false;
    const onController = () => {
      // Only reload for a swap this app asked for. The first install also takes control, and that must not reload.
      if (reloading || !isApplying()) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker?.addEventListener("controllerchange", onController);

    const onMessage = (event: MessageEvent) => {
      // A push arrived while the app was open: refresh the lists that depend on it.
      if ((event.data as { type?: string } | null)?.type === "PUSH") {
        void queryClient.invalidateQueries({ queryKey: ["notifications"] });
        void queryClient.invalidateQueries({ queryKey: ["unread"] });
      }
    };
    navigator.serviceWorker?.addEventListener("message", onMessage);

    let cancelled = false;
    const offer = (worker: ServiceWorker) => useUpdate.getState().setWaiting(worker);

    void registerServiceWorker().then((reg) => {
      if (!reg || cancelled) return;
      if (reg.waiting && navigator.serviceWorker.controller) void offer(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const incoming = reg.installing;
        incoming?.addEventListener("statechange", () => {
          if (incoming.state === "installed" && navigator.serviceWorker.controller)
            void offer(incoming);
        });
      });
    });

    return () => {
      cancelled = true;
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      navigator.serviceWorker?.removeEventListener("controllerchange", onController);
      navigator.serviceWorker?.removeEventListener("message", onMessage);
    };
  }, [queryClient]);

  return null;
}
