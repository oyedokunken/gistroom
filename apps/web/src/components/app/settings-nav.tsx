"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { settings } from "@/content/app";
import { cn } from "@/lib/cn";

/** Desktop sidebar list. On phones the index page shows the same list full width and subpages show a back link. */
export function SettingsNav({ mode }: { mode: "sidebar" | "index" }) {
  const pathname = usePathname();
  return (
    <nav aria-label={settings.title}>
      <ul className="flex flex-col gap-1">
        {settings.sections.map((s) => {
          const active = pathname === s.href;
          return (
            <li key={s.id}>
              <Link
                href={s.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 items-center justify-between gap-3 rounded-2xl px-4 py-2",
                  active && mode === "sidebar"
                    ? "bg-green-100 text-green-700"
                    : "text-text hover:bg-surface-2",
                )}
              >
                <span className="flex flex-col">
                  <span className="font-semibold">{s.label}</span>
                  {mode === "index" ? (
                    <span className="text-sm text-text-muted">{s.description}</span>
                  ) : null}
                </span>
                <ChevronRight aria-hidden className="size-4 text-text-muted" />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
