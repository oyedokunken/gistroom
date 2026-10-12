"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { newPasswordSchema, passwordMessages } from "@gistroom/shared";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { PasswordStrength } from "@/components/ui/password-strength";
import { isPasswordAcceptable, usePasswordStrength } from "@/lib/password-strength";
import { passwordSettings as copy } from "@/content/app";
import { auth } from "@/content/auth";
import { ApiClientError, apiFetch } from "@/lib/api";

function schemaFor(hasPassword: boolean) {
  return z
    .object({
      currentPassword: hasPassword
        ? z.string().min(1, passwordMessages.loginRequired)
        : z.string().optional(),
      newPassword: newPasswordSchema,
      confirm: z.string(),
    })
    .refine((v) => v.newPassword === v.confirm, {
      path: ["confirm"],
      message: passwordMessages.mismatch,
    });
}

export function PasswordForm({ hasPassword, email }: { hasPassword: boolean; email: string }) {
  const { showError } = useFeedback();
  const [saved, setSaved] = useState(false);
  const form = useForm<{ currentPassword?: string; newPassword: string; confirm: string }>({
    resolver: zodResolver(schemaFor(hasPassword)),
    defaultValues: { currentPassword: "", newPassword: "", confirm: "" },
  });
  const errors = form.formState.errors;
  const strength = usePasswordStrength(form.watch("newPassword"));

  async function onSubmit(v: { currentPassword?: string; newPassword: string }) {
    setSaved(false);
    if (!(await isPasswordAcceptable(v.newPassword))) {
      form.setError("newPassword", { message: passwordMessages.tooWeak });
      return;
    }
    try {
      await apiFetch("/api/me/password", {
        body: { currentPassword: v.currentPassword || undefined, newPassword: v.newPassword },
      });
      form.reset();
      setSaved(true);
    } catch (e) {
      if (e instanceof ApiClientError && e.fields.currentPassword)
        form.setError("currentPassword", { message: e.fields.currentPassword });
      else if (e instanceof ApiClientError && e.fields.password)
        form.setError("newPassword", { message: e.fields.password });
      else if (e instanceof ApiClientError) showError(e.message);
      else throw e;
    }
  }

  return (
    <form
      noValidate
      onChange={() => setSaved(false)}
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex w-full flex-col gap-4"
    >
      <p className="text-text-muted">{hasPassword ? copy.introSet : copy.introNone}</p>
      {/* Lets password managers file the new password under the right account. */}
      <input
        type="text"
        name="username"
        autoComplete="username"
        defaultValue={email}
        readOnly
        className="sr-only"
        aria-hidden
        tabIndex={-1}
      />
      {hasPassword ? (
        <Field label={copy.current} error={errors.currentPassword?.message}>
          {(props) => (
            <PasswordInput
              {...props}
              autoComplete="current-password"
              placeholder={auth.currentPasswordPlaceholder}
              {...form.register("currentPassword")}
            />
          )}
        </Field>
      ) : null}
      <Field label={copy.next} help={copy.help} error={errors.newPassword?.message}>
        {(props) => (
          <PasswordInput
            {...props}
            autoComplete="new-password"
            placeholder={auth.newPasswordPlaceholder}
            {...form.register("newPassword")}
          />
        )}
      </Field>
      <PasswordStrength strength={strength} />
      <Field label={copy.confirm} error={errors.confirm?.message}>
        {(props) => (
          <PasswordInput
            {...props}
            autoComplete="new-password"
            placeholder={auth.confirmPlaceholder}
            {...form.register("confirm")}
          />
        )}
      </Field>
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" loading={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? copy.saving : copy.save}
        </Button>
        {saved ? (
          <p role="status" className="text-sm font-medium text-green-700">
            {copy.saved}
          </p>
        ) : null}
      </div>
    </form>
  );
}
