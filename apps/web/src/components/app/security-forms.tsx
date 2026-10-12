"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { emailSchema, otpCodeSchema } from "@gistroom/shared";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { OtpInput } from "@/components/ui/otp-input";
import { PasswordInput } from "@/components/ui/password-input";
import { auth } from "@/content/auth";
import { settings } from "@/content/app";
import { ApiClientError, apiFetch } from "@/lib/api";

const startSchema = z.object({ newEmail: emailSchema, password: z.string().max(128) });
type StartValues = z.infer<typeof startSchema>;

/** Two steps: the new address and the password, then the code that was sent to the new address. */
export function ChangeEmailForm({ email, hasPassword }: { email: string; hasPassword: boolean }) {
  const router = useRouter();
  const { showError } = useFeedback();
  const copy = settings.security;
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const form = useForm<StartValues>({
    resolver: zodResolver(
      hasPassword
        ? startSchema.extend({ password: z.string().min(1, "Enter your password.") })
        : startSchema,
    ),
    defaultValues: { newEmail: "", password: "" },
  });
  const errors = form.formState.errors;

  async function start(values: StartValues) {
    try {
      await apiFetch("/api/me/email/start", {
        body: { newEmail: values.newEmail, password: values.password || undefined },
      });
      setSentTo(values.newEmail);
    } catch (e) {
      if (e instanceof ApiClientError && e.fields.newEmail)
        form.setError("newEmail", { message: e.fields.newEmail });
      else if (e instanceof ApiClientError && e.fields.password)
        form.setError("password", { message: e.fields.password });
      else if (e instanceof ApiClientError && (e.status === 429 || e.status === 400))
        form.setError("newEmail", { message: e.message });
      else if (e instanceof ApiClientError) showError(e.message);
      else throw e;
    }
  }

  async function confirm() {
    const parsed = otpCodeSchema.safeParse(code);
    if (!parsed.success) {
      setCodeError(parsed.error.issues[0]?.message ?? null);
      return;
    }
    setBusy(true);
    setCodeError(null);
    try {
      await apiFetch("/api/me/email/confirm", { body: { newEmail: sentTo, code: parsed.data } });
      setDone(true);
      setSentTo(null);
      form.reset();
      router.refresh();
    } catch (e) {
      if (e instanceof ApiClientError && (e.fields.code || e.status === 400 || e.status === 429)) {
        setCodeError(e.fields.code ?? e.message);
        setCode("");
      } else if (e instanceof ApiClientError) showError(e.message);
      else throw e;
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="email-h" className="flex flex-col gap-4">
      <h3 id="email-h" className="text-lg font-bold text-text">
        {copy.emailHeading}
      </h3>
      <p className="text-text-muted">{copy.emailIntro}</p>
      <p className="text-sm text-text-muted">
        {copy.emailCurrent}: <span className="font-semibold text-text">{email}</span>
      </p>
      {done ? (
        <p role="status" className="text-sm font-medium text-green-700">
          {copy.emailUpdated}
        </p>
      ) : null}
      {sentTo === null ? (
        <form noValidate onSubmit={form.handleSubmit(start)} className="flex flex-col gap-4">
          <Field label={copy.newEmail} error={errors.newEmail?.message}>
            {(props) => (
              <Input
                {...props}
                type="text"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                placeholder={copy.newEmailPlaceholder}
                {...form.register("newEmail")}
              />
            )}
          </Field>
          {hasPassword ? (
            <Field
              label={copy.passwordToChange}
              help={copy.passwordToChangeHelp}
              error={errors.password?.message}
            >
              {(props) => (
                <PasswordInput
                  {...props}
                  autoComplete="current-password"
                  {...form.register("password")}
                />
              )}
            </Field>
          ) : null}
          <Button type="submit" loading={form.formState.isSubmitting} className="w-fit">
            {form.formState.isSubmitting ? copy.sendingCode : copy.sendCode}
          </Button>
        </form>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-text-muted">{copy.codeSentTo(sentTo)}</p>
          <OtpInput
            value={code}
            onChange={(v) => {
              setCode(v);
              setCodeError(null);
            }}
            label={copy.codeLabel}
            digitLabel={auth.verify.digit}
            invalid={codeError !== null}
            describedBy={codeError ? "email-code-error" : undefined}
            disabled={busy}
          />
          {codeError ? (
            <p id="email-code-error" role="alert" className="text-sm font-medium text-danger-600">
              {codeError}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => void confirm()} loading={busy}>
              {busy ? copy.confirming : copy.confirmEmail}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setSentTo(null);
                setCode("");
                setCodeError(null);
              }}
            >
              {copy.useDifferent}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

/** For people who forgot the current password: a code goes to their email, and they choose a new one. */
export function ResetByEmail({ email }: { email: string }) {
  const router = useRouter();
  const copy = settings.security;
  return (
    <section aria-labelledby="reset-h" className="flex flex-col gap-3">
      <h3 id="reset-h" className="text-lg font-bold text-text">
        {copy.resetHeading}
      </h3>
      <p className="text-text-muted">{copy.resetBody}</p>
      <Button
        variant="secondary"
        className="w-fit"
        onClick={() => router.push(`/forgot?email=${encodeURIComponent(email)}&auto=1`)}
      >
        {copy.resetAction}
      </Button>
    </section>
  );
}
