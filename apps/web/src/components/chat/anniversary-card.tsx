"use client";

import { useEffect, useRef } from "react";
import { PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { chat } from "@/content/chat";
import { burstConfetti } from "@/lib/confetti";

/** The card that appears in a chat on the day two friends reach a year (or more) together. */
export function AnniversaryCard({ id, years, name }: { id: string; years: number; name: string }) {
  const ref = useRef<HTMLDivElement>(null);

  // Confetti once per device for each anniversary, when the card first scrolls into view.
  useEffect(() => {
    const key = `gr_anniv_${id}`;
    let seen = false;
    try {
      seen = window.sessionStorage.getItem(key) === "1";
    } catch {
      seen = false;
    }
    if (seen || !ref.current) return;
    const el = ref.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        try {
          window.sessionStorage.setItem(key, "1");
        } catch {
          // Without storage it may burst again on the next visit. That is fine.
        }
        const rect = el.getBoundingClientRect();
        burstConfetti({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
      },
      { threshold: 0.6 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [id]);

  return (
    <div ref={ref} className="my-6 flex justify-center px-2">
      <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-hero bg-green-700 p-6 text-center text-white shadow-lift">
        <span className="flex size-14 items-center justify-center rounded-full bg-yellow-400 text-ink-950">
          <PartyPopper aria-hidden className="size-7" />
        </span>
        <p className="text-sm font-semibold text-yellow-400">{chat.anniversary.title(years)}</p>
        <p className="text-lg font-bold leading-snug">{chat.anniversary.body(name, years)}</p>
        <Button
          type="button"
          variant="accent"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            burstConfetti({ x: r.left + r.width / 2, y: r.top }, 180);
          }}
        >
          {chat.anniversary.celebrate}
        </Button>
      </div>
    </div>
  );
}
