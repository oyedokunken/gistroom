"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { requestOtpSchema, type RequestOtpInput } from "@gistroom/shared";
import { GoogleMark } from "@/components/brand/google-mark";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { Button, buttonStyles } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { auth } from "@/content/auth";
import { ApiClientError, apiFetch } from "@/lib/api";

export interface LoginFormProps {
  mode: "login" | "signup";
  next: string;
  /** Reason from a failed redirect, for example a Google error. */
  error?: string;
}

export function LoginForm({ mode, next, error }: LoginFormProps) {
  const router = useRouter();
  const { showError } = useFeedback();
  const copy = auth[mode];
  const form = useForm<RequestOtpInput>({
    resolver: zodResolver(requestOtpSchema),
    defaultValues: { email: "" },
  });

  useEffect(() => {
    if (error && auth.errors[error]) showError(auth.errors[error]);
  }, [error, showError]);

  async function onSubmit(values: RequestOtpInput) {
    try {
      await apiFetch("/api/auth/otp/request", { body: values });
      const params = new URLSearchParams({ email: values.email, next });
      router.push(`/verify?${params.toString()}`);
    } catch (e) {
      if (e instanceof ApiClientError && (e.fields.email || e.status === 429 || e.status === 400)) {
        form.setError("email", { message: e.fields.email ?? e.message });
      } else if (e instanceof ApiClientError) {
        showError(e.message);
      } else {
        throw e;
      }
    }
  }

  const googleHref = `/api/auth/google?next=${encodeURIComponent(next)}`;
  const otherHref = `${mode === "login" ? "/signup" : "/login"}?next=${encodeURIComponent(next)}`;

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-[clamp(1.875rem,5vw,2.5rem)] font-bold leading-[1.1] tracking-tight text-text">
          {copy.heading}
        </h1>
        <p className="text-text-muted">{copy.subhead}</p>
      </div>

      <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Field label={auth.emailLabel} error={form.formState.errors.email?.message}>
          {(props) => (
            <Input
              {...props}
              type="text"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder={auth.emailPlaceholder}
              {...form.register("email")}
            />
          )}
        </Field>
        <Button type="submit" loading={form.formState.isSubmitting} className="min-h-12">
          {form.formState.isSubmitting ? auth.sendingCode : auth.sendCode}
        </Button>
      </form>

      <div className="flex items-center gap-3 text-sm text-text-muted" aria-hidden>
        <span className="h-px flex-1 bg-border" />
        {auth.or}
        <span className="h-px flex-1 bg-border" />
      </div>

      <a
        href={googleHref}
        className={buttonStyles("secondary", "min-h-12 gap-3 border border-border bg-surface")}
      >
        <GoogleMark />
        {auth.google}
      </a>

      <p className="text-sm text-text-muted">
        {mode === "login" ? auth.noAccount : auth.haveAccount}{" "}
        <Link
          href={otherHref}
          className="font-semibold text-green-700 underline-offset-4 hover:underline"
        >
          {mode === "login" ? auth.signUpLink : auth.signInLink}
        </Link>
      </p>
      <p className="text-xs text-text-muted">
        {auth.termsBefore}
        <Link href="/terms" className="underline underline-offset-4">
          {auth.termsLink}
        </Link>
        {auth.termsAnd}
        <Link href="/privacy" className="underline underline-offset-4">
          {auth.privacyLink}
        </Link>
        .
      </p>
    </>
  );
}
