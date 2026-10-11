"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { newPasswordSchema, resetStartSchema, otpCodeSchema } from "@gistroom/shared";
import { z } from "zod";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { OtpInput } from "@/components/ui/otp-input";
import { PasswordInput } from "@/components/ui/password-input";
import { auth } from "@/content/auth";
import { ApiClientError, apiFetch } from "@/lib/api";

const newPasswordForm = z.object({ code: otpCodeSchema, password: newPasswordSchema });
type NewPasswordValues = z.infer<typeof newPasswordForm>;

/** Forgot password: email, then the one time code together with a new password. This is the only place a code is used after sign up. */
export function ForgotForm({ initialEmail }: { initialEmail: string }) {
  const router = useRouter();
  const { showError } = useFeedback();
  const copy = auth.forgotPage;
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [wait, setWait] = useState(0);

  const emailForm = useForm<{ email: string }>({
    resolver: zodResolver(resetStartSchema),
    defaultValues: { email: initialEmail },
  });
  const form = useForm<NewPasswordValues>({
    resolver: zodResolver(newPasswordForm),
    defaultValues: { code: "", password: "" },
  });

  useEffect(() => {
    if (wait <= 0) return;
    const id = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(id);
  }, [wait]);

  async function send(email: string) {
    try {
      await apiFetch("/api/auth/reset/start", { body: { email } });
      setSentTo(email);
      setWait(60);
    } catch (e) {
      if (e instanceof ApiClientError && (e.status === 429 || e.fields.email))
        emailForm.setError("email", { message: e.fields.email ?? e.message });
      else if (e instanceof ApiClientError) showError(e.message);
      else throw e;
    }
  }

  async function save(values: NewPasswordValues) {
    if (!sentTo) return;
    try {
      const res = await apiFetch<{ needsOnboarding: boolean }>("/api/auth/reset/verify", {
        body: { email: sentTo, ...values },
      });
      router.replace(res.needsOnboarding ? "/onboarding" : "/app/chats?back=1");
      router.refresh();
    } catch (e) {
      if (e instanceof ApiClientError && e.fields.code)
        form.setError("code", { message: e.fields.code });
      else if (e instanceof ApiClientError && e.fields.password)
        form.setError("password", { message: e.fields.password });
      else if (e instanceof ApiClientError) showError(e.message);
      else throw e;
    }
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-[clamp(1.875rem,5vw,2.5rem)] font-bold leading-[1.1] tracking-tight text-text">
          {sentTo ? copy.codeHeading : copy.title}
        </h1>
        <p className="text-text-muted">{sentTo ? copy.sentTo(sentTo) : copy.subhead}</p>
      </div>

      {sentTo === null ? (
        <form
          noValidate
          onSubmit={emailForm.handleSubmit((v) => send(v.email))}
          className="flex flex-col gap-4"
        >
          <Field label={auth.emailLabel} error={emailForm.formState.errors.email?.message}>
            {(props) => (
              <Input
                {...props}
                type="text"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                placeholder={auth.emailPlaceholder}
                {...emailForm.register("email")}
              />
            )}
          </Field>
          <Button type="submit" loading={emailForm.formState.isSubmitting} className="min-h-12">
            {emailForm.formState.isSubmitting ? copy.sending : copy.send}
          </Button>
        </form>
      ) : (
        <form noValidate onSubmit={form.handleSubmit(save)} className="flex flex-col gap-4">
          <Field label={auth.verify.codeLabel} error={form.formState.errors.code?.message}>
            {() => (
              <OtpInput
                value={form.watch("code")}
                onChange={(v) =>
                  form.setValue("code", v, { shouldValidate: form.formState.isSubmitted })
                }
                label={auth.verify.codeLabel}
                digitLabel={auth.verify.digit}
                invalid={Boolean(form.formState.errors.code)}
                focusOnMount
              />
            )}
          </Field>
          <Field
            label={auth.newPasswordLabel}
            help={auth.passwordHelp}
            error={form.formState.errors.password?.message}
          >
            {(props) => (
              <PasswordInput
                {...props}
                autoComplete="new-password"
                {...form.register("password")}
              />
            )}
          </Field>
          <Button type="submit" loading={form.formState.isSubmitting} className="min-h-12">
            {form.formState.isSubmitting ? copy.submitting : copy.submit}
          </Button>
          {wait > 0 ? (
            <p aria-live="polite" className="text-sm text-text-muted">
              {auth.verify.resendIn(wait)}
            </p>
          ) : (
            <button
              type="button"
              onClick={() => void send(sentTo)}
              className="min-h-11 w-fit text-sm font-semibold text-green-700 underline-offset-4 hover:underline"
            >
              {copy.resend}
            </button>
          )}
        </form>
      )}

      <Link
        href="/login"
        className="inline-flex min-h-11 w-fit items-center text-sm font-semibold text-green-700 underline-offset-4 hover:underline"
      >
        {copy.back}
      </Link>
    </>
  );
}
