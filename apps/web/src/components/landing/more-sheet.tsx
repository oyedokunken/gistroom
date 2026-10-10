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
import { Sheet } from "@/components/ui/sheet";
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
 * The "More" sheet on phones. Each row has an icon tile, a 56 pixel hit area, a pressed state that tints the row and
 * turns the tile green, a hover lift on pointers, and a green bar for the page you are on. Swipe down or press
 * Escape to close. Reduced motion removes the scale and the lift.
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
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title}>
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
                  "hover:bg-surface-2 active:bg-green-100 motion-safe:active:scale-[0.98]",
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
                    "motion-safe:group-hover:-translate-y-0.5 group-active:bg-green-600 group-active:text-white",
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
