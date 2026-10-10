"use client";

import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

export interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  length?: number;
  label: string;
  digitLabel: (n: number) => string;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
  focusOnMount?: boolean;
}

/** Six boxes that behave like one field: paste a whole code, backspace walks back, one time code autofill. */
export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  label,
  digitLabel,
  invalid,
  describedBy,
  disabled,
  focusOnMount,
}: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  useEffect(() => {
    // Move focus to the first box when the person arrives on the code screen.
    if (focusOnMount) refs.current[0]?.focus();
  }, [focusOnMount]);

  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  function commit(next: string) {
    const clean = next.replace(/[^0-9]/g, "").slice(0, length);
    onChange(clean);
    if (clean.length === length) onComplete?.(clean);
  }

  function setDigit(index: number, raw: string) {
    const typed = raw.replace(/[^0-9]/g, "");
    if (!typed) return;
    if (typed.length > 1) {
      // Autofill or a fast typist: spread the digits from this box.
      commit(value.slice(0, index) + typed);
      refs.current[Math.min(index + typed.length, length - 1)]?.focus();
      return;
    }
    const next = value.padEnd(index, " ").slice(0, index) + typed + value.slice(index + 1);
    commit(next.replace(/ /g, ""));
    refs.current[Math.min(index + 1, length - 1)]?.focus();
  }

  function onKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[index]) {
        commit(value.slice(0, index) + value.slice(index + 1));
      } else if (index > 0) {
        commit(value.slice(0, index - 1) + value.slice(index));
        refs.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft") {
      refs.current[Math.max(0, index - 1)]?.focus();
    } else if (e.key === "ArrowRight") {
      refs.current[Math.min(length - 1, index + 1)]?.focus();
    }
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    commit(e.clipboardData.getData("text"));
    refs.current[
      Math.min(e.clipboardData.getData("text").replace(/\D/g, "").length, length - 1)
    ]?.focus();
  }

  return (
    <div
      role="group"
      aria-label={label}
      aria-describedby={describedBy}
      className="flex justify-between gap-2"
    >
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={d}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={digitLabel(i + 1)}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          onChange={(e) => setDigit(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={onPaste}
          onFocus={(e) => e.target.select()}
          className={cn(
            "tabular size-12 rounded-input border bg-surface text-center text-2xl font-bold text-text sm:size-14",
            invalid ? "border-danger-600" : "border-border focus-visible:border-green-600",
          )}
        />
      ))}
    </div>
  );
}
