"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Lock, MailWarning } from "lucide-react";
import { otpCodeSchema } from "@gistroom/shared";
import { Button } from "@/components/ui/button";
import { OtpInput } from "@/components/ui/otp-input";
import { auth } from "@/content/auth";
import { emailVerify as copy } from "@/content/badges";
import { ApiClientError, apiFetch } from "@/lib/api";

/**
 * Shows whether the account's email is verified. If it is not, the person can ask for a code to that address and confirm
 * it here. The address cannot be edited: it is how they sign in and recover the account, so the card says so plainly.
 */
export function EmailVerifyCard({ verified, email }: { verified: boolean; email: string }) {
  const router = useRouter();
  const [isVerified, setVerified] = useState(verified);
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const id = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(id);
  }, [wait]);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ resendAfterSec: number }>("/api/me/email/verify/start", {
        body: {},
      });
      setSent(true);
      setWait(res.resendAfterSec);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : copy.failed);
    } finally {
      setBusy(false);
    }
  }

  async function confirm(value: string) {
    const parsed = otpCodeSchema.safeParse(value);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? copy.failed);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/me/email/verify/confirm", { body: { code: parsed.data } });
      setVerified(true);
      setSent(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : copy.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby="email-verify-h"
      className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4"
    >
      <h3 id="email-verify-h" className="text-base font-semibold text-text">
        {copy.heading}
      </h3>
      <p className="break-all text-text">{email}</p>
      {isVerified ? (
        <div role="status" className="flex items-start gap-2 text-green-700">
          <BadgeCheck aria-hidden className="mt-0.5 size-5 shrink-0" />
          <span>
            <span className="block font-semibold">{copy.verifiedTitle}</span>
            <span className="block text-sm text-text-muted">{copy.verifiedBody}</span>
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-2">
            <MailWarning aria-hidden className="mt-0.5 size-5 shrink-0 text-text-muted" />
            <span>
              <span className="block font-semibold text-text">{copy.unverifiedTitle}</span>
              <span className="block text-sm text-text-muted">{copy.unverifiedBody}</span>
            </span>
          </div>
          {sent ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-text-muted">{copy.sentTo(email)}</p>
              <OtpInput
                value={code}
                onChange={(v) => {
                  setCode(v);
                  setError(null);
                }}
                onComplete={(v) => void confirm(v)}
                label={copy.codeLabel}
                digitLabel={auth.verify.digit}
                invalid={error !== null}
                describedBy={error ? "email-verify-error" : undefined}
                disabled={busy}
              />
              {error ? (
                <p
                  id="email-verify-error"
                  role="alert"
                  className="text-sm font-medium text-danger-600"
                >
                  {error}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-3">
                <Button loading={busy} onClick={() => void confirm(code)}>
                  {busy ? copy.confirming : copy.confirm}
                </Button>
                <Button variant="ghost" disabled={busy || wait > 0} onClick={() => void send()}>
                  {copy.resend}
                </Button>
                {wait > 0 ? (
                  <span role="status" className="tabular text-sm text-text-muted">
                    {copy.resendIn(wait)}
                  </span>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-start gap-2">
              <Button loading={busy} onClick={() => void send()}>
                {busy ? copy.sending : copy.send}
              </Button>
              {error ? (
                <p role="alert" className="text-sm font-medium text-danger-600">
                  {error}
                </p>
              ) : null}
            </div>
          )}
        </div>
      )}
      <p className="flex items-start gap-2 border-t border-border pt-3 text-sm text-text-muted">
        <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>
          <span className="block font-semibold text-text">{copy.immutableTitle}</span>
          {copy.immutableBody}
        </span>
      </p>
    </section>
  );
}
