"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { newPasswordSchema, passwordMessages } from "@gistroom/shared";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { PasswordStrength } from "@/components/ui/password-strength";
import { auth } from "@/content/auth";
import { ApiClientError, apiFetch } from "@/lib/api";
import { isPasswordAcceptable, usePasswordStrength } from "@/lib/password-strength";

const schema = z
  .object({
    password: newPasswordSchema,
    confirm: z.string().min(1, auth.password.confirmRequired),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: passwordMessages.mismatch,
  });
type Values = z.infer<typeof schema>;

/**
 * Sets a first password: right after the email code at sign up, and for any signed in account that has none.
 * `next` was cleaned on the server, so it is always a path on this site.
 */
export function PasswordForm({ next, intro }: { next: string; intro?: "signup" | "existing" }) {
  const router = useRouter();
  const { showError } = useFeedback();
  const copy = auth.password;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirm: "" },
    mode: "onTouched",
  });
  const password = form.watch("password");
  const confirm = form.watch("confirm");
  const strength = usePasswordStrength(password);

  // Keep the mismatch message honest while the first field changes after the second one was filled in.
  useEffect(() => {
    if (confirm) void form.trigger("confirm");
  }, [password, confirm, form]);

  async function onSubmit(values: Values) {
    if (!(await isPasswordAcceptable(values.password))) {
      form.setError("password", { message: passwordMessages.tooWeak });
      return;
    }
    try {
      await apiFetch("/api/auth/password", { body: { password: values.password } });
      const target = intro === "existing" ? next : `/onboarding?next=${encodeURIComponent(next)}`;
      router.replace(target);
      router.refresh();
    } catch (e) {
      if (e instanceof ApiClientError && e.fields.password) {
        form.setError("password", { message: e.fields.password });
      } else if (e instanceof ApiClientError) {
        showError(e.message);
      } else {
        throw e;
      }
    }
  }

  const errors = form.formState.errors;
  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-[clamp(1.875rem,5vw,2.5rem)] font-bold leading-[1.1] tracking-tight text-text">
          {intro === "existing" ? copy.existingHeading : copy.heading}
        </h1>
        <p className="text-text-muted">
          {intro === "existing" ? copy.existingSubhead : copy.subhead}
        </p>
      </div>
      <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Field label={auth.passwordLabel} help={auth.passwordHelp} error={errors.password?.message}>
          {(props) => (
            <PasswordInput
              {...props}
              autoComplete="new-password"
              placeholder={auth.newPasswordPlaceholder}
              {...form.register("password")}
            />
          )}
        </Field>
        <Field label={copy.confirmLabel} error={errors.confirm?.message}>
          {(props) => (
            <PasswordInput
              {...props}
              autoComplete="new-password"
              placeholder={auth.confirmPlaceholder}
              {...form.register("confirm")}
            />
          )}
        </Field>
        <PasswordStrength strength={strength} />
        <Button type="submit" loading={form.formState.isSubmitting} className="min-h-12">
          {form.formState.isSubmitting ? copy.submitting : copy.submit}
        </Button>
      </form>
    </>
  );
}
