"use client";

import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { useCalm } from "@/lib/calm";
import { auth } from "@/content/auth";
import { cn } from "@/lib/cn";
import { useUsernameAvailability, type UsernameState } from "@/lib/username-availability";

/** The icon on the right of the input. The spinner is an animated WebP with a still PNG for calm mode. */
function StatusIcon({ state }: { state: UsernameState }) {
  const calm = useCalm();
  if (state.status === "available") {
    return <img src="/images/status/check.png" alt="" width={20} height={20} className="size-5" />;
  }
  if (state.status === "taken" || state.status === "invalid") {
    return <img src="/images/status/cross.png" alt="" width={20} height={20} className="size-5" />;
  }
  if (state.status === "checking" || state.status === "typing") {
    if (calm) {
      return (
        <img src="/images/status/spinner.png" alt="" width={20} height={20} className="size-5" />
      );
    }
    return (
      <picture>
        <source media="(prefers-reduced-motion: reduce)" srcSet="/images/status/spinner.png" />
        <img src="/images/status/spinner.webp" alt="" width={20} height={20} className="size-5" />
      </picture>
    );
  }
  return null;
}

function hintFor(state: UsernameState, value: string) {
  const copy = auth.username;
  switch (state.status) {
    case "idle":
      return { text: copy.help, tone: "muted" as const };
    case "typing":
    case "checking":
      return { text: copy.checking, tone: "muted" as const };
    case "available":
      return { text: copy.available(value), tone: "good" as const };
    case "taken":
      return { text: copy.taken, tone: "bad" as const };
    case "invalid":
      return { text: state.message, tone: "bad" as const };
    case "error":
      return { text: copy.error, tone: "muted" as const };
  }
}

export interface UsernameFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "type"
> {
  label: string;
  /** The current value, from the form. */
  value: string;
  /** The person's own current username, which counts as fine and is not checked again. */
  own?: string;
  /** A message from the server on submit, shown instead of the live hint. */
  serverError?: string;
}

/** Username input with live availability. Used at onboarding and in Settings. */
export const UsernameField = forwardRef<HTMLInputElement, UsernameFieldProps>(
  function UsernameField({ label, value, own, serverError, className, ...rest }, ref) {
    const id = useId();
    const hintId = `${id}-hint`;
    const state = useUsernameAvailability(value, own);
    const hint = serverError
      ? { text: serverError, tone: "bad" as const }
      : hintFor(state, value.trim().toLowerCase());
    const invalid = hint.tone === "bad";
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-sm font-semibold text-text">
          {label}
        </label>
        <div className="relative">
          <input
            ref={ref}
            id={id}
            type="text"
            placeholder={auth.usernamePlaceholder}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            aria-describedby={hintId}
            aria-invalid={invalid || undefined}
            className={cn(
              "min-h-11 w-full rounded-input border border-border bg-surface px-4 py-3 pr-12 text-base text-text placeholder:text-text-muted",
              "focus-visible:border-green-600 aria-[invalid=true]:border-danger-600",
              state.status === "available" && !serverError && "border-green-600",
              className,
            )}
            {...rest}
          />
          <span className="pointer-events-none absolute right-4 top-1/2 flex size-5 -translate-y-1/2">
            <StatusIcon state={serverError ? { status: "taken" } : state} />
          </span>
        </div>
        <p
          id={hintId}
          aria-live="polite"
          className={cn(
            "text-sm",
            hint.tone === "good" && "font-medium text-green-700",
            hint.tone === "bad" && "font-medium text-danger-600",
            hint.tone === "muted" && "text-text-muted",
          )}
        >
          {hint.text}
        </p>
      </div>
    );
  },
);
