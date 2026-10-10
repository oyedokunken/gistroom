"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { Button } from "@/components/ui/button";
import { notices } from "@/content/app";
import { apiFetch } from "@/lib/api";
import {
  currentSubscription,
  pushSupport,
  subscribeToPush,
  unsubscribeFromPush,
  type PushSupport,
} from "@/lib/push-client";

/**
 * Turn Web Push on or off for this device. The primer modal comes first, then the browser prompt,
 * and only after a tap, never on first visit (Section 10.4).
 */
export function PushCard() {
  const { confirm, showError, showInfo } = useFeedback();
  const [support, setSupport] = useState<PushSupport | "loading">("loading");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const copy = notices.push;

  const refresh = useCallback(async () => {
    const s = pushSupport();
    setSupport(s);
    if (s === "granted") setSubscribed(Boolean(await currentSubscription().catch(() => null)));
    else setSubscribed(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function enable() {
    const ok = await confirm({
      title: copy.primerTitle,
      message: copy.primerBody,
      confirmLabel: copy.primerConfirm,
      cancelLabel: copy.primerCancel,
    });
    if (!ok) return;
    setBusy(true);
    const result = await subscribeToPush(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
    setBusy(false);
    if (result === "denied") showError(copy.blocked);
    else if (result === "unsupported") showError(copy.unsupported);
    else if (result === "no-key" || result === "failed") showError(copy.unavailable);
    await refresh();
  }

  async function disable() {
    setBusy(true);
    await unsubscribeFromPush();
    setBusy(false);
    await refresh();
  }

  async function test() {
    try {
      await apiFetch("/api/notifications/test", { body: {} });
      showInfo(copy.testSent);
    } catch {
      showError(copy.unavailable);
    }
  }

  if (support === "loading") return null;

  return (
    <section
      aria-label={copy.heading}
      className="flex flex-col gap-2 rounded-card border border-border p-4"
    >
      <h2 className="flex items-center gap-2 text-lg font-bold text-text">
        <BellRing aria-hidden className="size-5 text-green-600" />
        {copy.heading}
      </h2>
      {support === "unsupported" ? <p className="text-text-muted">{copy.unsupported}</p> : null}
      {support === "ios-needs-install" ? (
        <p className="text-text-muted">{copy.iosNeedsInstall}</p>
      ) : null}
      {support === "blocked" ? <p className="text-text-muted">{copy.blocked}</p> : null}
      {support === "default" || (support === "granted" && !subscribed) ? (
        <>
          <p className="text-text-muted">{copy.body}</p>
          <Button className="w-fit" loading={busy} onClick={() => void enable()}>
            {copy.enable}
          </Button>
        </>
      ) : null}
      {support === "granted" && subscribed ? (
        <>
          <p className="text-text-muted">{copy.enabled}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void test()}>
              {copy.test}
            </Button>
            <Button
              variant="ghost"
              className="border border-border"
              loading={busy}
              onClick={() => void disable()}
            >
              {copy.disable}
            </Button>
          </div>
        </>
      ) : null}
    </section>
  );
}
