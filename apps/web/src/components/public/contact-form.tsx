"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { contactSchema, type ContactInput } from "@gistroom/shared";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { contactForm as copy } from "@/content/pages";
import { ApiClientError, apiFetch } from "@/lib/api";

export function ContactForm() {
  const { showError, showSuccess } = useFeedback();
  const [sent, setSent] = useState(false);
  const form = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: "", email: "", message: "", website: "" },
  });
  const errors = form.formState.errors;

  async function onSubmit(values: ContactInput) {
    try {
      await apiFetch("/api/contact", { body: values });
      form.reset();
      setSent(true);
      showSuccess(copy.doneBody, copy.doneTitle);
    } catch (e) {
      if (e instanceof ApiClientError && e.fields && Object.keys(e.fields).length > 0) {
        for (const [field, message] of Object.entries(e.fields)) {
          if (field in values) form.setError(field as keyof ContactInput, { message });
        }
      } else if (e instanceof ApiClientError && e.status === 429) {
        showError(e.message);
      } else {
        showError(copy.failed);
      }
    }
  }

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(onSubmit)}
      onChange={() => setSent(false)}
      className="flex max-w-xl flex-col gap-4"
    >
      <Field label={copy.nameLabel} error={errors.name?.message}>
        {(props) => <Input {...props} autoComplete="name" {...form.register("name")} />}
      </Field>
      <Field label={copy.emailLabel} error={errors.email?.message}>
        {(props) => (
          <Input
            {...props}
            type="text"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            {...form.register("email")}
          />
        )}
      </Field>
      <Field label={copy.messageLabel} help={copy.messageHelp} error={errors.message?.message}>
        {(props) => <Textarea {...props} rows={5} {...form.register("message")} />}
      </Field>
      {/* Bots fill every field. People never see this one. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          {copy.honeypot}
          <input type="text" tabIndex={-1} autoComplete="off" {...form.register("website")} />
        </label>
      </div>
      <div className="flex items-center gap-4">
        <Button type="submit" loading={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? copy.sending : copy.send}
        </Button>
        {sent ? (
          <p role="status" className="text-sm font-medium text-green-700">
            {copy.doneTitle}
          </p>
        ) : null}
      </div>
    </form>
  );
}
