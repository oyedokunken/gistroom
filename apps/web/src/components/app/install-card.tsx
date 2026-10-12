"use client";

import { useEffect, useState } from "react";
import { CircleCheck, Download, Share, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { pwa } from "@/content/app";
import { isIos, isStandalone } from "@/lib/push-client";
import { usePwa } from "@/lib/pwa";

/**
 * Our own install card (Section 11): the browser prompt on Android and desktop, illustrated steps on iPhone.
 * Dismissing it hides it for 14 days. `always` is for the Settings page, which shows the state instead of hiding.
 */
export function InstallCard({ always = false }: { always?: boolean }) {
  const { prompt, installed, dismissed, dismiss } = usePwa();
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setIos(isIos(navigator.userAgent) && !isStandalone());
  }, []);

  if (installed) {
    return always ? (
      <section
        aria-label={pwa.statusInstalled}
        className="flex items-start gap-3 rounded-card border border-green-600 bg-green-100 p-4 text-ink-950"
      >
        <CircleCheck aria-hidden className="mt-0.5 size-6 shrink-0 text-green-700" />
        <div>
          <h2 className="text-lg font-bold">{pwa.statusInstalled}</h2>
          <p className="mt-1 text-ink-700">{pwa.installedNote}</p>
        </div>
      </section>
    ) : null;
  }
  if (!always && dismissed) return null;
  if (!prompt && !ios) {
    return always ? (
      <section
        aria-label={pwa.statusNotInstalled}
        className="flex items-start gap-3 rounded-card border border-border bg-surface-2 p-4"
      >
        <Smartphone aria-hidden className="mt-0.5 size-6 shrink-0 text-text-muted" />
        <div>
          <h2 className="text-lg font-bold text-text">{pwa.statusNotInstalled}</h2>
          <p className="mt-1 text-text-muted">{pwa.installBody}</p>
          <p className="mt-2 text-sm text-text-muted">{pwa.installManual}</p>
        </div>
      </section>
    ) : null;
  }

  return (
    <section
      aria-label={pwa.installTitle}
      className="relative rounded-card border border-border bg-green-100 p-4 text-ink-950"
    >
      {!always ? (
        <IconButton
          label={pwa.installDismiss}
          onClick={dismiss}
          className="absolute right-1 top-1 text-ink-950 hover:bg-white/60"
        >
          <X aria-hidden className="size-4" />
        </IconButton>
      ) : null}
      <h2 className="pr-10 text-lg font-bold">{ios ? pwa.iosTitle : pwa.installTitle}</h2>
      <p className="mt-1 text-ink-700">{ios ? pwa.iosBody : pwa.installBody}</p>
      {ios ? (
        <ol className="mt-3 flex list-decimal flex-col gap-1 pl-5 text-ink-700">
          {pwa.iosSteps.map((s) => (
            <li key={s} className="flex items-center gap-2">
              {s}
              {s === pwa.iosSteps[0] ? <Share aria-hidden className="size-4" /> : null}
            </li>
          ))}
        </ol>
      ) : (
        <Button
          className="mt-3"
          icon={<Download aria-hidden className="size-4" />}
          onClick={async () => {
            if (!prompt) return;
            await prompt.prompt();
            const choice = await prompt.userChoice;
            if (choice.outcome === "dismissed") dismiss();
          }}
        >
          {pwa.installAction}
        </Button>
      )}
    </section>
  );
}
