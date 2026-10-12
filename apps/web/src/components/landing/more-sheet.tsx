"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  Info,
  LifeBuoy,
  Lock,
  Radio,
  ShieldCheck,
  Smartphone,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { buttonStyles } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { cta } from "@/content/marketing";
import { useAuthState } from "@/lib/auth-state";
import { cn } from "@/lib/cn";

export interface MoreItem {
  label: string;
  href: string;
}

/** One icon per destination, so every row has a tile of the same size on the left. */
const ICONS: Record<string, LucideIcon> = {
  "/features": Sparkles,
  "/rooms": Radio,
  "/safety": ShieldCheck,
  "/about": Info,
  "/support": LifeBuoy,
  "/install": Smartphone,
  "/privacy": Lock,
  "/terms": FileText,
  "/security": ShieldCheck,
};

export const moreIconFor = (href: string): LucideIcon => ICONS[href] ?? Info;

/**
 * The "More" sheet on phones. Each row has an icon tile, a 56 pixel hit area, a hover state that turns the row
 * green with a white icon and label, a pressed tint, and a green bar for the page you are on. Swipe down or
 * press Escape to close. Reduced motion removes the scale and the lift.
 */
export function MoreSheet({
  open,
  onOpenChange,
  title,
  items,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  items: readonly MoreItem[];
}) {
  const pathname = usePathname();
  const person = useAuthState((st) => st.person);
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title}>
      {person ? (
        <div className="mb-3 flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
          <Avatar name={person.name} src={person.avatarUrl} size={44} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold text-text">{person.name}</span>
            <span className="block truncate text-sm text-text-muted">@{person.username}</span>
          </span>
          <Link
            href={cta.open.href}
            onClick={() => onOpenChange(false)}
            className={buttonStyles("primary", "min-h-11 px-4")}
          >
            {cta.open.label}
          </Link>
        </div>
      ) : null}
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => {
          const Icon = moreIconFor(item.href);
          const current = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                onClick={() => onOpenChange(false)}
                className={cn(
                  "group relative flex min-h-14 items-center gap-4 rounded-2xl px-3 text-lg font-medium text-text",
                  "transition-[background-color,transform] duration-150",
                  "hover:bg-green-600 hover:text-white active:bg-green-100 active:text-text motion-safe:active:scale-[0.98]",
                  current && "bg-green-100",
                )}
              >
                {current ? (
                  <span
                    aria-hidden
                    className="absolute inset-y-3 left-0 w-1 rounded-full bg-green-600"
                  />
                ) : null}
                <span
                  aria-hidden
                  className={cn(
                    "flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-green-700",
                    "transition-[background-color,color,transform] duration-150",
                    "motion-safe:group-hover:-translate-y-0.5 group-hover:bg-transparent group-hover:text-white group-active:bg-green-600 group-active:text-white",
                    current && "bg-green-600 text-white",
                  )}
                >
                  <Icon className="size-5" />
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
