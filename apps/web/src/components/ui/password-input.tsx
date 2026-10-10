"use client";

import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { auth } from "@/content/auth";
import { cn } from "@/lib/cn";

/** Password field with a show and hide control. Validation is Zod, never HTML (R5). */
export const PasswordInput = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, "type">
>(function PasswordInput({ className, ...rest }, ref) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input
        ref={ref}
        type={shown ? "text" : "password"}
        autoCapitalize="none"
        spellCheck={false}
        className={cn(
          "min-h-11 w-full rounded-input border border-border bg-surface px-4 py-3 pr-12 text-base text-text placeholder:text-text-muted",
          "focus-visible:border-green-600 aria-[invalid=true]:border-danger-600",
          className,
        )}
        {...rest}
      />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? auth.hidePassword : auth.showPassword}
        aria-pressed={shown}
        className="absolute right-1 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-text-muted hover:text-text"
      >
        {shown ? <EyeOff aria-hidden className="size-5" /> : <Eye aria-hidden className="size-5" />}
      </button>
    </div>
  );
});
