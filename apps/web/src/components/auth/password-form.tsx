"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { newPasswordSchema } from "@gistroom/shared";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { auth } from "@/content/auth";
import { ApiClientError, apiFetch } from "@/lib/api";

const schema = z
  .object({ password: newPasswordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: auth.password.mismatch,
  });
type Values = z.infer<typeof schema>;

/** Step three of sign up: the email is confirmed, now choose the password you will sign in with. */
export function PasswordForm({ next }: { next: string }) {
  const router = useRouter();
  const { showError } = useFeedback();
  const copy = auth.password;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirm: "" },
  });

  async function onSubmit(values: Values) {
    try {
      await apiFetch("/api/auth/password", { body: { password: values.password } });
      router.replace(`/onboarding?next=${encodeURIComponent(next)}`);
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
          {copy.heading}
        </h1>
        <p className="text-text-muted">{copy.subhead}</p>
      </div>
      <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Field label={auth.passwordLabel} help={auth.passwordHelp} error={errors.password?.message}>
          {(props) => (
            <PasswordInput {...props} autoComplete="new-password" {...form.register("password")} />
          )}
        </Field>
        <Field label={copy.confirmLabel} error={errors.confirm?.message}>
          {(props) => (
            <PasswordInput {...props} autoComplete="new-password" {...form.register("confirm")} />
          )}
        </Field>
        <Button type="submit" loading={form.formState.isSubmitting} className="min-h-12">
          {form.formState.isSubmitting ? copy.submitting : copy.submit}
        </Button>
      </form>
    </>
  );
}
