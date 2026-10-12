"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { consent as copy } from "@/content/consent";
import { apiFetch } from "@/lib/api";
import { CONSENT_COOKIE, parseConsent, type Consent } from "@/lib/consent";

function readCookie(): Consent | null {
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${CONSENT_COOKIE}=`));
  return parseConsent(match?.slice(CONSENT_COOKIE.length + 1));
}

export const OPEN_CONSENT_EVENT = "gr:open-consent";

/** Small cookie banner. Stores the choice through /api/consent. Sits above the mobile dock and clear of the footer. */
export function ConsentBanner() {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [choice, setChoice] = useState<Consent>({ functional: true, analytics: false });
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    const existing = readCookie();
    if (existing) {
      setChoice(existing);
    } else {
      // A signed in person who chose on another device is not asked again. Everyone else is.
      void apiFetch<{ consent: Consent | null }>("/api/consent")
        .then((res) => {
          if (!live) return;
          if (res.consent) setChoice(res.consent);
          else setOpen(true);
        })
        .catch(() => {
          if (live) setOpen(true);
        });
    }
    const reopen = () => {
      setCustom(true);
      setOpen(true);
    };
    window.addEventListener(OPEN_CONSENT_EVENT, reopen);
    return () => {
      live = false;
      window.removeEventListener(OPEN_CONSENT_EVENT, reopen);
    };
  }, []);

  async function save(next: Consent) {
    setFailed(false);
    try {
      await apiFetch("/api/consent", { body: next });
      setChoice(next);
      setOpen(false);
      setCustom(false);
    } catch {
      setFailed(true);
    }
  }

  if (!open) return null;

  return (
    <section
      aria-label={copy.title}
      className="fixed inset-x-3 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-lg rounded-card border border-border bg-surface p-4 shadow-lift md:inset-x-auto md:bottom-4 md:left-4 md:mx-0"
    >
      <Image
        src="/images/icons/mascot-gist.png"
        alt=""
        width={36}
        height={36}
        className="mb-2 size-9"
      />
      <h2 className="text-base font-bold text-text">{copy.title}</h2>
      <p className="mt-1 text-sm text-text-muted">
        {copy.body}{" "}
        <Link
          href="/cookies"
          className="font-semibold text-green-700 underline-offset-4 hover:underline"
        >
          {copy.learnMore}
        </Link>
      </p>
      {custom ? (
        <div className="mt-2 divide-y divide-border">
          <Switch
            label={copy.essential}
            help={copy.essentialHelp}
            checked
            onChange={() => undefined}
          />
          <Switch
            label={copy.functional}
            help={copy.functionalHelp}
            checked={choice.functional}
            onChange={(v) => setChoice({ ...choice, functional: v })}
          />
          <Switch
            label={copy.analytics}
            help={copy.analyticsHelp}
            checked={choice.analytics}
            onChange={(v) => setChoice({ ...choice, analytics: v })}
          />
        </div>
      ) : null}
      {failed ? (
        <p role="alert" className="mt-2 text-sm font-medium text-danger-600">
          {copy.saveFailed}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {custom ? (
          <Button onClick={() => void save(choice)}>{copy.save}</Button>
        ) : (
          <>
            <Button onClick={() => void save({ functional: true, analytics: true })}>
              {copy.acceptAll}
            </Button>
            <Button
              variant="secondary"
              onClick={() => void save({ functional: true, analytics: false })}
            >
              {copy.essentialOnly}
            </Button>
            <Button
              variant="ghost"
              className="border border-border"
              onClick={() => setCustom(true)}
            >
              {copy.customise}
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
