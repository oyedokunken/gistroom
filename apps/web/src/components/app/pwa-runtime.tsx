"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallStore } from "@/lib/calls/store";
import { useDrafts } from "@/lib/chat/drafts";
import { applyUpdate, isApplying, updateBlockers, useUpdate } from "@/lib/update-gate";
import { registerServiceWorker } from "@/lib/push-client";
import { usePwa, type BeforeInstallPromptEvent } from "@/lib/pwa";

/**
 * Registers the service worker on the first signed in load, captures the install prompt and keeps track of a new
 * version. A new version never interrupts anything: a small bar offers it, and it is applied by itself on the next
 * page change when there is no call, no open room and no unsent text. See UpdateBar and lib/update-gate.
 */
export function PwaRuntime() {
  const queryClient = useQueryClient();
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
