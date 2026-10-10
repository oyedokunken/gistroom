"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/cn";

export interface ContentsItem {
  id: string;
  heading: string;
}

/** The section inside the middle band of the viewport is the active one. */
function useActiveSection(items: readonly ContentsItem[]) {
  const [active, setActive] = useState(items[0]?.id);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: "-25% 0px -65% 0px", threshold: 0 },
    );
    for (const item of items) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [items]);
  return active;
}

/** The rail in the left column. The green marker springs from item to item as sections come active. */
export function ContentsRail({ items, label }: { items: readonly ContentsItem[]; label: string }) {
  const active = useActiveSection(items);
  return (
    <nav aria-label={label} className="hidden lg:block">
      <ul className="sticky top-28 flex flex-col gap-1 border-l-2 border-border">
        {items.map((s) => {
          const on = active === s.id;
          return (
            <li key={s.id} className="relative">
              <a
                href={`#${s.id}`}
                aria-current={on ? "location" : undefined}
                className={cn(
                  "flex min-h-11 items-center py-1 pl-4 text-sm transition-colors duration-300",
                  on
                    ? "font-semibold text-green-700"
                    : "font-medium text-text-muted hover:text-text",
                )}
              >
                {s.heading}
                {on ? (
                  <motion.span
                    layoutId="toc-marker"
                    aria-hidden
                    transition={{ type: "spring", stiffness: 420, damping: 36 }}
                    className="absolute -left-0.5 top-0 h-full w-0.5 bg-green-600"
                  />
                ) : null}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** The sticky strip under the header on small screens. The active item keeps a sliding underline. */
export function ContentsBar({ items, label }: { items: readonly ContentsItem[]; label: string }) {
  const active = useActiveSection(items);
  return (
    <nav aria-label={label} className="sticky top-20 z-30 bg-surface/95 backdrop-blur lg:hidden">
      <ul className="mx-auto flex w-full max-w-[1200px] gap-1 overflow-x-auto px-6">
        {items.map((s) => {
          const on = active === s.id;
          return (
            <li key={s.id} className="relative shrink-0">
              <a
                href={`#${s.id}`}
                aria-current={on ? "location" : undefined}
                className={cn(
                  "flex min-h-11 items-center px-3 text-sm transition-colors duration-300",
                  on
                    ? "font-semibold text-green-700"
                    : "font-medium text-text-muted hover:text-text",
                )}
              >
                {s.heading}
                {on ? (
                  <motion.span
                    layoutId="toc-marker-mobile"
                    aria-hidden
                    transition={{ type: "spring", stiffness: 420, damping: 36 }}
                    className="absolute inset-x-3 bottom-0 h-0.5 bg-green-600"
                  />
                ) : null}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
