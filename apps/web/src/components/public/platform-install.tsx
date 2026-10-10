"use client";

import { useEffect, useState } from "react";
import { Check, Download, Share } from "lucide-react";
import { installPage as copy } from "@/content/marketing";
import { registerServiceWorker, isStandalone } from "@/lib/push-client";
import { usePwa, type BeforeInstallPromptEvent } from "@/lib/pwa";
import { cn } from "@/lib/cn";

/**
 * The install button on each device card. Android and desktop fire the real browser install
 * prompt (the service worker is registered here so the prompt can actually appear). iOS cannot
 * install from a button, so its button explains the Share sheet steps instead.
 */
export function PlatformInstall({
  platform,
  dark = false,
}: {
  platform: "android" | "ios" | "desktop";
  dark?: boolean;
}) {
  const { prompt, installed, setPrompt, setInstalled } = usePwa();
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    if (isStandalone()) setInstalled();
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled();
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    // Install prompts only fire when a worker controls the page, so register it here too.
    void registerServiceWorker();
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [setPrompt, setInstalled]);

  if (installed) {
    return (
      <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-green-600 px-5 py-2 text-sm font-bold text-white">
        <Check aria-hidden className="size-4" />
        {copy.installed}
      </p>
    );
  }

  const isIosCard = platform === "ios";

  async function onInstall() {
    if (isIosCard) {
      setHint(copy.hintIos);
      return;
    }
    if (!prompt) {
      setHint(copy.hintManual);
      return;
    }
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === "dismissed") setHint(copy.hintManual);
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={onInstall}
        className={cn(
          "inline-flex min-h-12 items-center gap-2 rounded-full px-6 font-semibold transition-colors",
          dark
            ? "bg-yellow-400 text-ink-950 hover:bg-yellow-300"
            : "bg-green-600 text-white hover:bg-green-700",
        )}
      >
        {isIosCard ? (
          <Share aria-hidden className="size-4" />
        ) : (
          <Download aria-hidden className="size-4" />
        )}
        {isIosCard ? copy.iosAction : copy.action}
      </button>
      {hint ? (
        <p className={cn("mt-3 text-sm", dark ? "text-white/85" : "text-text-muted")}>{hint}</p>
      ) : null}
    </div>
  );
}
