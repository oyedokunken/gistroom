"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { onboardingSchema, type OnboardingInput } from "@gistroom/shared";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { Button } from "@/components/ui/button";
import { UsernameField } from "@/components/auth/username-field";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, Input } from "@/components/ui/field";
import { auth } from "@/content/auth";
import { ApiClientError, apiFetch } from "@/lib/api";

export function OnboardingForm({ defaultName, next }: { defaultName: string; next: string }) {
  const router = useRouter();
  const { showError } = useFeedback();
  const copy = auth.onboarding;
  const form = useForm<OnboardingInput>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      name: defaultName,
      username: "",
      ageConfirmed: false as unknown as true,
      termsAccepted: false as unknown as true,
    },
    mode: "onTouched",
  });

  const username = form.watch("username");

  async function onSubmit(values: OnboardingInput) {
    try {
      await apiFetch("/api/onboarding", {
        body: values,
      });
      const target = next === "/app/chats" ? "/app/discover" : next;
      router.replace(`/interests?first=1&next=${encodeURIComponent(target)}`);
      router.refresh();
    } catch (e) {
      if (e instanceof ApiClientError && e.fields.username) {
        form.setError("username", { message: e.fields.username });
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
        <Field label={copy.nameLabel} error={errors.name?.message}>
          {(props) => (
            <Input
              {...props}
              type="text"
              autoComplete="name"
              placeholder={copy.namePlaceholder}
              {...form.register("name")}
            />
          )}
        </Field>
        <UsernameField
          label={copy.usernameLabel}
          value={username}
          serverError={errors.username?.message}
          {...form.register("username", { setValueAs: (v: string) => v.toLowerCase() })}
        />
        <Checkbox
          label={copy.ageLabel}
          error={errors.ageConfirmed?.message}
          {...form.register("ageConfirmed")}
        />
        <Checkbox
          label={copy.termsLabel}
          error={errors.termsAccepted?.message}
          {...form.register("termsAccepted")}
        />
        <Button type="submit" loading={form.formState.isSubmitting} className="min-h-12">
          {form.formState.isSubmitting ? copy.submitting : copy.submit}
        </Button>
      </form>
    </>
  );
}
