"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { otpCodeSchema } from "@gistroom/shared";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { Button, buttonStyles } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { OtpInput } from "@/components/ui/otp-input";
import { PasswordInput } from "@/components/ui/password-input";
import { auth } from "@/content/auth";
import { settings } from "@/content/app";
import { ApiClientError, apiFetch } from "@/lib/api";
import { clearAuthedHint } from "@/lib/authed-hint";

/** Export a copy of your data, or delete the account after a code sent to your email. */
export function AccountPanel({ hasPassword }: { hasPassword: boolean }) {
  const router = useRouter();
  const { showError } = useFeedback();
  const copy = settings.account;
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [reauthOpen, setReauthOpen] = useState(false);
  const [reauthPassword, setReauthPassword] = useState("");
  const [reauthError, setReauthError] = useState<string | null>(null);

  function download() {
    window.location.assign("/api/me/export");
  }

  // A copy of everything you gave Gistroom needs a recent sign in. Older than 15 minutes, we ask for the password.
  async function startExport() {
    try {
      const r = await apiFetch<{ recent: boolean; hasPassword: boolean }>("/api/auth/reauth");
      if (r.recent || !r.hasPassword) return download();
      setReauthPassword("");
      setReauthError(null);
      setReauthOpen(true);
    } catch (e) {
      if (e instanceof ApiClientError) showError(e.message);
      else throw e;
    }
  }

  async function confirmReauth() {
    if (!reauthPassword) return setReauthError(auth.passwordLabel + " is needed.");
    try {
      await apiFetch("/api/auth/reauth", { body: { password: reauthPassword } });
      setReauthOpen(false);
      download();
    } catch (e) {
      if (e instanceof ApiClientError) setReauthError(e.fields.password ?? e.message);
      else throw e;
    }
  }

  function reset() {
    setSent(false);
    setCode("");
    setPassword("");
    setCodeError(null);
    setPasswordError(null);
    setBusy(false);
  }

  async function sendCode() {
    setBusy(true);
    try {
      await apiFetch("/api/me/delete/start", { method: "POST", body: {} });
      setSent(true);
    } catch (e) {
      if (e instanceof ApiClientError) showError(e.message);
      else throw e;
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    const parsed = otpCodeSchema.safeParse(code);
    if (!parsed.success) {
      setCodeError(parsed.error.issues[0]?.message ?? null);
      return;
    }
    if (hasPassword && !password) {
      setPasswordError(auth.passwordLabel + " is needed.");
      return;
    }
    setBusy(true);
    setCodeError(null);
    setPasswordError(null);
    try {
      await apiFetch("/api/me/delete/confirm", {
        body: { code: parsed.data, password: password || undefined },
      });
      clearAuthedHint();
      setOpen(false);
      router.replace("/login");
      router.refresh();
    } catch (e) {
      setBusy(false);
      if (e instanceof ApiClientError && e.fields.password) setPasswordError(e.fields.password);
      else if (
        e instanceof ApiClientError &&
        (e.fields.code || e.status === 400 || e.status === 429)
      ) {
        setCodeError(e.fields.code ?? e.message);
        setCode("");
      } else if (e instanceof ApiClientError) showError(e.message);
      else throw e;
    }
  }

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="export-h" className="flex flex-col gap-3">
        <h3 id="export-h" className="text-lg font-bold text-text">
          {copy.exportHeading}
        </h3>
        <p className="text-text-muted">{copy.exportBody}</p>
        <button
          type="button"
          onClick={() => void startExport()}
          className={buttonStyles("secondary", "w-fit gap-2")}
        >
          <Download aria-hidden className="size-4" />
          {copy.exportAction}
        </button>
        <Modal
          open={reauthOpen}
          onOpenChange={setReauthOpen}
          icon={Download}
          title={copy.reauthTitle}
          description={copy.reauthBody}
          footer={<Button onClick={() => void confirmReauth()}>{copy.reauthAction}</Button>}
        >
          <Field label={auth.passwordLabel} error={reauthError ?? undefined}>
            {(props) => (
              <PasswordInput
                {...props}
                autoComplete="current-password"
                value={reauthPassword}
                onChange={(e) => setReauthPassword(e.target.value)}
              />
            )}
          </Field>
        </Modal>
        <p className="text-sm text-text-muted">{copy.exportLimit}</p>
      </section>

      <section aria-labelledby="delete-h" className="flex flex-col gap-3">
        <h3 id="delete-h" className="text-lg font-bold text-danger-600">
          {copy.deleteHeading}
        </h3>
        <p className="text-text-muted">{copy.deleteBody}</p>
        <Button
          variant="ghost"
          className="w-fit gap-2 border border-danger-600 text-danger-600 hover:bg-danger-600/10"
          onClick={() => {
            reset();
            setOpen(true);
          }}
        >
          <Trash2 aria-hidden className="size-4" />
          {copy.deleteAction}
        </Button>
      </section>

      <Modal
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) reset();
        }}
        icon={Trash2}
        tone="error"
        title={copy.deleteTitle}
        description={sent ? undefined : copy.deleteStep}
        footer={
          sent ? (
            <>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                {copy.cancel}
              </Button>
              <Button
                variant="ghost"
                loading={busy}
                className="border border-danger-600 text-danger-600 hover:bg-danger-600/10"
                onClick={() => void confirmDelete()}
              >
                {busy ? copy.confirming : copy.confirm}
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                {copy.cancel}
              </Button>
              <Button loading={busy} onClick={() => void sendCode()}>
                {copy.sendCode}
              </Button>
            </>
          )
        }
      >
        {sent ? (
          <div className="flex flex-col gap-4">
            <OtpInput
              value={code}
              onChange={(v) => {
                setCode(v);
                setCodeError(null);
              }}
              label={copy.codeLabel}
              digitLabel={auth.verify.digit}
              invalid={codeError !== null}
              describedBy={codeError ? "delete-code-error" : undefined}
              disabled={busy}
            />
            {codeError ? (
              <p
                id="delete-code-error"
                role="alert"
                className="text-sm font-medium text-danger-600"
              >
                {codeError}
              </p>
            ) : null}
            {hasPassword ? (
              <Field label={copy.passwordLabel} error={passwordError ?? undefined}>
                {(props) => (
                  <PasswordInput
                    {...props}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setPasswordError(null);
                    }}
                  />
                )}
              </Field>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
