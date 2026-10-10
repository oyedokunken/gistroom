"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { footer } from "@/content/landing";
import { cn } from "@/lib/cn";
import { DEFAULT_THEME, THEME_KEY, resolveTheme, type ThemePreference } from "@/lib/theme";

const options: { value: ThemePreference; label: string; icon: LucideIcon }[] = [
  { value: "light", label: footer.theme.light, icon: Sun },
  { value: "dark", label: footer.theme.dark, icon: Moon },
  { value: "system", label: footer.theme.system, icon: Monitor },
];

function read(): ThemePreference {
  try {
    const v = window.localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" || v === "system" ? v : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

function apply(pref: ThemePreference) {
  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.setAttribute("data-theme", resolveTheme(pref, dark));
}

/** Light, Dark or System. The choice is a per viewer convenience, so localStorage is fine here. */
export function ThemeToggle({
  className,
  compact,
}: {
  className?: string;
  /** Collapses to one circular button showing the active theme. Clicking opens the picker. */
  compact?: boolean;
}) {
  const [pref, setPref] = useState<ThemePreference>(DEFAULT_THEME);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setPref(read());
  }, []);

  useEffect(() => {
    if (pref !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);

  function choose(next: ThemePreference) {
    setPref(next);
    setOpen(false);
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      // Storage can be blocked. The choice still applies for this visit.
    }
    apply(next);
  }

  const group = (
    <div
      role="radiogroup"
      aria-label={footer.theme.label}
      className={cn("inline-flex gap-1 rounded-full bg-surface p-1 shadow-soft", className)}
    >
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={pref === value}
          aria-label={compact ? label : undefined}
          onClick={() => choose(value)}
          className={cn(
            "inline-flex min-h-11 items-center gap-2 rounded-full text-sm font-medium transition-colors",
            compact ? "min-w-11 justify-center px-0" : "px-4",
            pref === value ? "bg-green-600 text-white" : "text-text-muted hover:text-text",
          )}
        >
          <Icon aria-hidden className="size-4" />
          {compact ? null : label}
        </button>
      ))}
    </div>
  );

  if (!compact) return group;

  const ActiveIcon = (options.find((o) => o.value === pref) ?? options[2]!).icon;
  return (
    <div className={cn("relative size-11", className)}>
      {open ? (
        <button
          type="button"
          aria-label={footer.theme.close}
          tabIndex={-1}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 cursor-default"
        />
      ) : null}
      <motion.div
        initial={false}
        animate={{ width: open ? "auto" : "100%" }}
        transition={{ type: "spring", stiffness: 360, damping: 30 }}
        className="absolute right-0 top-0 z-50 flex h-11 items-center justify-end overflow-hidden rounded-full bg-surface text-text shadow-soft"
      >
        {open ? (
          <div
            role="radiogroup"
            aria-label={footer.theme.label}
            tabIndex={-1}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
            }}
            className="flex gap-1 p-1"
          >
            {options.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={pref === value}
                aria-label={label}
                onClick={() => choose(value)}
                className={cn(
                  "inline-flex size-9 items-center justify-center rounded-full transition-colors",
                  pref === value ? "bg-green-600 text-white" : "text-text-muted hover:text-text",
                )}
              >
                <Icon aria-hidden className="size-4" />
              </button>
            ))}
          </div>
        ) : (
          <button
            type="button"
            aria-label={footer.theme.label}
            aria-expanded={false}
            aria-haspopup="true"
            onClick={() => setOpen(true)}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-colors hover:text-green-700"
          >
            <ActiveIcon aria-hidden className="size-4" />
          </button>
        )}
      </motion.div>
    </div>
  );
}
