"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { pwa } from "@/content/app";
import { registerServiceWorker } from "@/lib/push-client";
import { usePwa, type BeforeInstallPromptEvent } from "@/lib/pwa";

/**
 * Registers the service worker on the first signed in load, captures the install prompt and
 * asks before swapping in a new version. Never a toast: updates use a modal (R4, Section 11).
 */
export function PwaRuntime() {
  const queryClient = useQueryClient();
  const { confirm } = useFeedback();

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
      if (reloading) return;
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
    async function offer(worker: ServiceWorker) {
      const ok = await confirm({
        title: pwa.updateTitle,
        message: pwa.updateBody,
        confirmLabel: pwa.updateConfirm,
        cancelLabel: pwa.updateLater,
      });
      if (ok && !cancelled) worker.postMessage({ type: "SKIP_WAITING" });
    }

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
  }, [confirm, queryClient]);

  return null;
}
