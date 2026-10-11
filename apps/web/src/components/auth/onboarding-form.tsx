"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { onboardingSchema, usernameSchema, type OnboardingInput } from "@gistroom/shared";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, Input } from "@/components/ui/field";
import { auth } from "@/content/auth";
import { ApiClientError, apiFetch } from "@/lib/api";

type Availability = "idle" | "checking" | "free" | "taken";

export function OnboardingForm({ defaultName, next }: { defaultName: string; next: string }) {
  const router = useRouter();
  const { showError } = useFeedback();
  const copy = auth.onboarding;
  const [availability, setAvailability] = useState<Availability>("idle");
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
  useEffect(() => {
    // Only ask the server when the local rules already pass, which keeps the rate limit for real checks.
    if (!usernameSchema.safeParse(username).success) {
      setAvailability("idle");
      return;
    }
    setAvailability("checking");
    const controller = new AbortController();
    const id = window.setTimeout(async () => {
      try {
        const res = await apiFetch<{ available: boolean }>(
          `/api/username/check?username=${encodeURIComponent(username)}`,
          { signal: controller.signal },
        );
        setAvailability(res.available ? "free" : "taken");
      } catch (e) {
        if (!(e instanceof DOMException)) setAvailability("idle");
      }
    }, 400);
    return () => {
      window.clearTimeout(id);
      controller.abort();
    };
  }, [username]);

  async function onSubmit(values: OnboardingInput) {
    try {
      await apiFetch("/api/onboarding", {
        body: values,
      });
      router.replace(`${next}${next.includes("?") ? "&" : "?"}welcome=1`);
      router.refresh();
    } catch (e) {
      if (e instanceof ApiClientError && e.fields.username) {
        form.setError("username", { message: e.fields.username });
        setAvailability("taken");
      } else if (e instanceof ApiClientError) {
        showError(e.message);
      } else {
        throw e;
      }
    }
  }

  const errors = form.formState.errors;
  const usernameError =
    errors.username?.message ?? (availability === "taken" ? auth.errors.username_taken : undefined);
  const usernameHelp =
    availability === "checking"
      ? copy.usernameChecking
      : availability === "free"
        ? copy.usernameFree
        : copy.usernameHelp;

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
        <Field label={copy.usernameLabel} help={usernameHelp} error={usernameError}>
          {(props) => (
            <Input
              {...props}
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              {...form.register("username", { setValueAs: (v: string) => v.toLowerCase() })}
            />
          )}
        </Field>
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
