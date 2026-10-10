"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  emailSchema,
  loginSchema,
  requestOtpSchema,
  type LoginInput,
  type RequestOtpInput,
} from "@gistroom/shared";
import { GoogleMark } from "@/components/brand/google-mark";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { Button, buttonStyles } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { auth } from "@/content/auth";
import { ApiClientError, apiFetch } from "@/lib/api";
import { googleAuthEnabled } from "@/lib/google-flag";

export interface AuthFormProps {
  next: string;
  /** Reason from a failed redirect, for example a Google error. */
  error?: string;
}

function Heading({ title, subhead }: { title: string; subhead: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-[clamp(1.875rem,5vw,2.5rem)] font-bold leading-[1.1] tracking-tight text-text">
        {title}
      </h1>
      <p className="text-text-muted">{subhead}</p>
    </div>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-3 text-sm text-text-muted" aria-hidden>
      <span className="h-px flex-1 bg-border" />
      {auth.or}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function GoogleButton({ next }: { next: string }) {
  const { showInfo } = useFeedback();
  const className = buttonStyles("secondary", "min-h-12 gap-3 border border-border bg-surface");
  // Built and switched off: the button stays, and says so plainly instead of starting anything.
  if (!googleAuthEnabled) {
    return (
      <button
        type="button"
        onClick={() => showInfo(auth.googleOff.body, auth.googleOff.title)}
        className={className}
      >
        <GoogleMark />
        {auth.google}
      </button>
    );
  }
  return (
    <a
      href={`/api/auth/google?next=${encodeURIComponent(next)}`}
      className={buttonStyles("secondary", "min-h-12 gap-3 border border-border bg-surface")}
    >
      <GoogleMark />
      {auth.google}
    </a>
  );
}

function Terms() {
  return (
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
  );
}

/** Sign in in two steps: email first, then password. No code is ever needed to sign in. */
export function LoginForm({ next, error }: AuthFormProps) {
  const router = useRouter();
  const { showError } = useFeedback();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (error && auth.errors[error]) showError(auth.errors[error]);
  }, [error, showError]);

  const emailForm = useForm<{ email: string }>({
    resolver: zodResolver(requestOtpSchema.pick({ email: true })),
    defaultValues: { email: "" },
  });
  const passwordForm = useForm<Pick<LoginInput, "password">>({
    resolver: zodResolver(loginSchema.pick({ password: true })),
    defaultValues: { password: "" },
  });

  async function submitPassword(values: Pick<LoginInput, "password">) {
    if (!email) return;
    try {
      const res = await apiFetch<{ needsOnboarding: boolean }>("/api/auth/login", {
        body: { email, password: values.password },
      });
      router.replace(res.needsOnboarding ? `/onboarding?next=${encodeURIComponent(next)}` : next);
      router.refresh();
    } catch (e) {
      if (
        e instanceof ApiClientError &&
        (e.status === 401 || e.status === 429 || e.status === 400)
      ) {
        passwordForm.setError("password", { message: e.fields.password ?? e.message });
        passwordForm.resetField("password", { keepError: true });
      } else if (e instanceof ApiClientError) {
        showError(e.message);
      } else {
        throw e;
      }
    }
  }

  const signupHref = `/signup?next=${encodeURIComponent(next)}`;

  if (email === null) {
    return (
      <>
        <Heading title={auth.login.heading} subhead={auth.login.subhead} />
        <form
          noValidate
          onSubmit={emailForm.handleSubmit((v) => setEmail(emailSchema.parse(v.email)))}
          className="flex flex-col gap-4"
        >
          <Field label={auth.emailLabel} error={emailForm.formState.errors.email?.message}>
            {(props) => (
              <Input
                {...props}
                type="text"
                inputMode="email"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                placeholder={auth.emailPlaceholder}
                {...emailForm.register("email")}
              />
            )}
          </Field>
          <Button type="submit" className="min-h-12">
            {auth.continue}
          </Button>
        </form>
        <Divider />
        <GoogleButton next={next} />
        <p className="text-sm text-text-muted">
          {auth.noAccount}{" "}
          <Link
            href={signupHref}
            className="font-semibold text-green-700 underline-offset-4 hover:underline"
          >
            {auth.signUpLink}
          </Link>
        </p>
        <Terms />
      </>
    );
  }

  return (
    <>
      <Heading title={auth.login.passwordHeading} subhead={`${auth.signingAs} ${email}`} />
      <form
        noValidate
        onSubmit={passwordForm.handleSubmit(submitPassword)}
        className="flex flex-col gap-4"
      >
        <Field label={auth.passwordLabel} error={passwordForm.formState.errors.password?.message}>
          {(props) => (
            <PasswordInput
              {...props}
              autoComplete="current-password"
              {...passwordForm.register("password")}
            />
          )}
        </Field>
        <Button type="submit" loading={passwordForm.formState.isSubmitting} className="min-h-12">
          {passwordForm.formState.isSubmitting ? auth.signingIn : auth.signIn}
        </Button>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <Link
          href={`/forgot?email=${encodeURIComponent(email)}`}
          className="inline-flex min-h-11 items-center font-semibold text-green-700 underline-offset-4 hover:underline"
        >
          {auth.forgot}
        </Link>
        <button
          type="button"
          onClick={() => setEmail(null)}
          className="min-h-11 font-semibold text-green-700 underline-offset-4 hover:underline"
        >
          {auth.wrongEmailShort}
        </button>
      </div>
    </>
  );
}

/** Sign up: the email gets one code now. After that it is email and password, or Google. */
export function SignupForm({ next, error }: AuthFormProps) {
  const router = useRouter();
  const { showError } = useFeedback();
  const form = useForm<RequestOtpInput>({
    resolver: zodResolver(requestOtpSchema),
    defaultValues: { email: "" },
  });

  useEffect(() => {
    if (error && auth.errors[error]) showError(auth.errors[error]);
  }, [error, showError]);

  async function onSubmit(values: RequestOtpInput) {
    try {
      await apiFetch("/api/auth/signup/start", { body: values });
      router.push(`/verify?${new URLSearchParams({ email: values.email, next }).toString()}`);
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

  return (
    <>
      <Heading title={auth.signup.heading} subhead={auth.signup.subhead} />
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
      <Divider />
      <GoogleButton next={next} />
      <p className="text-sm text-text-muted">
        {auth.haveAccount}{" "}
        <Link
          href={`/login?next=${encodeURIComponent(next)}`}
          className="font-semibold text-green-700 underline-offset-4 hover:underline"
        >
          {auth.signInLink}
        </Link>
      </p>
      <Terms />
    </>
  );
}
