"use client";

import { Check, Circle } from "lucide-react";
import { auth } from "@/content/auth";
import { cn } from "@/lib/cn";
import type { Strength } from "@/lib/password-strength";

const labels = {
  empty: "",
  weak: auth.strength.weak,
  okay: auth.strength.okay,
  strong: auth.strength.strong,
} as const;

const filled = { empty: 0, weak: 1, okay: 2, strong: 3 } as const;

const bar = {
  weak: "bg-danger-600",
  okay: "bg-yellow-400",
  strong: "bg-green-600",
} as const;

/**
 * A three segment bar with a word, and the checklist under it. The word and the ticks carry the meaning,
 * so colour is never the only signal (R19).
 */
export function PasswordStrength({ strength, id }: { strength: Strength; id?: string }) {
  const { level, checks } = strength;
  const rules: { key: keyof typeof checks; text: string; encouraged?: boolean }[] = [
    { key: "length", text: auth.strength.rules.length },
    { key: "mixedCase", text: auth.strength.rules.mixedCase },
    { key: "number", text: auth.strength.rules.number },
    { key: "symbol", text: auth.strength.rules.symbol, encouraged: true },
    { key: "notCommon", text: auth.strength.rules.notCommon },
  ];
  return (
    <div id={id} className="flex flex-col gap-2" data-strength={level}>
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1" aria-hidden>
          {[1, 2, 3].map((i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full bg-border transition-colors",
                level !== "empty" && i <= filled[level] && bar[level],
              )}
            />
          ))}
        </div>
        <span
          role="status"
          aria-live="polite"
          aria-label={`${auth.strength.label}: ${labels[level] || auth.strength.checking}`}
          className="tabular w-14 text-right text-sm font-semibold text-text"
        >
          {labels[level]}
        </span>
      </div>
      <ul className="grid gap-1 text-sm sm:grid-cols-2">
        {rules.map((r) => {
          const ok = checks[r.key];
          return (
            <li
              key={r.key}
              className={cn("flex items-center gap-2", ok ? "text-green-700" : "text-text-muted")}
            >
              {ok ? (
                <Check aria-hidden className="size-4 shrink-0" />
              ) : (
                <Circle aria-hidden className="size-4 shrink-0" />
              )}
              <span>
                {r.text}
                {r.encouraged ? ` (${auth.strength.optional})` : ""}
                <span className="sr-only">
                  {ok ? `, ${auth.strength.met}` : `, ${auth.strength.notMet}`}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
