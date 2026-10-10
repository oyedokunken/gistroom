"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { Button } from "@/components/ui/button";
import { OtpInput } from "@/components/ui/otp-input";
import { auth } from "@/content/auth";
import { ApiClientError, apiFetch } from "@/lib/api";

const RESEND_SECONDS = 60;

export function VerifyForm({ email, next }: { email: string; next: string }) {
  const router = useRouter();
  const { showError, showSuccess } = useFeedback();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(RESEND_SECONDS);
  const copy = auth.verify;

  useEffect(() => {
    if (wait <= 0) return;
    const id = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(id);
  }, [wait]);

  async function submit(value: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ needsOnboarding: boolean }>("/api/auth/otp/verify", {
        body: { email, code: value },
      });
      const target = res.needsOnboarding ? `/onboarding?next=${encodeURIComponent(next)}` : next;
      router.replace(target);
      router.refresh();
    } catch (e) {
      if (e instanceof ApiClientError && (e.status === 400 || e.status === 429)) {
        setError(e.fields.code ?? e.message);
        setCode("");
      } else if (e instanceof ApiClientError) {
        showError(e.message);
      } else {
        throw e;
      }
      setBusy(false);
    }
  }

  async function resend() {
    try {
      await apiFetch("/api/auth/otp/request", { body: { email } });
      setWait(RESEND_SECONDS);
      setError(null);
      setCode("");
      showSuccess(copy.resent);
    } catch (e) {
      if (e instanceof ApiClientError) showError(e.message);
      else throw e;
    }
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-[clamp(1.875rem,5vw,2.5rem)] font-bold leading-[1.1] tracking-tight text-text">
          {copy.heading}
        </h1>
        <p className="text-text-muted">{copy.sentTo(email)}</p>
      </div>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit(code);
        }}
        className="flex flex-col gap-4"
      >
        <OtpInput
          value={code}
          onChange={(v) => {
            setCode(v);
            if (error) setError(null);
          }}
          onComplete={(v) => void submit(v)}
          label={copy.codeLabel}
          digitLabel={copy.digit}
          invalid={Boolean(error)}
          describedBy={error ? "otp-error" : undefined}
          disabled={busy}
          focusOnMount
        />
        {error ? (
          <p id="otp-error" role="alert" className="text-sm font-medium text-danger-600">
            {error}
          </p>
        ) : null}
        <Button type="submit" loading={busy} className="min-h-12">
          {busy ? copy.submitting : copy.submit}
        </Button>
      </form>

      <div className="flex flex-col gap-1 text-sm text-text-muted">
        {wait > 0 ? (
          <p aria-live="polite">{copy.resendIn(wait)}</p>
        ) : (
          <button
            type="button"
            onClick={() => void resend()}
            className="min-h-11 w-fit font-semibold text-green-700 underline-offset-4 hover:underline"
          >
            {copy.resend}
          </button>
        )}
        <Link
          href={`/login?next=${encodeURIComponent(next)}`}
          className="inline-flex min-h-11 w-fit items-center font-semibold text-green-700 underline-offset-4 hover:underline"
        >
          {copy.wrongEmail}
        </Link>
      </div>
    </>
  );
}
