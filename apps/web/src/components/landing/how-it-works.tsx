"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { ArrowUpRight, Search } from "lucide-react";
import { type DemoPerson } from "@gistroom/shared";
import { AndroidStatusBar, SamsungNavBar } from "@/components/mock/phone";
import { ChatScreen, PersonAvatar, RoomScreen } from "@/components/mock/screens";
import { buttonStyles } from "@/components/ui/button";
import { homeCopy as copy } from "@/content/home";
import { useCalm } from "@/lib/calm";
import { cn } from "@/lib/cn";

/** The step nearest the middle of the screen. Each item registers its element with attach(i). */
export function useActiveStep() {
  const [active, setActive] = useState(0);
  const items = useRef(new Map<number, Element>());
  const observer = useRef<IntersectionObserver | null>(null);
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          for (const [i, el] of items.current) if (el === e.target) setActive(i);
        }
      },
      { rootMargin: "-40% 0px -40% 0px" },
    );
    observer.current = io;
    for (const el of items.current.values()) io.observe(el);
    return () => io.disconnect();
  }, []);
  const attach = (i: number) => (el: Element | null) => {
    if (el) {
      items.current.set(i, el);
      observer.current?.observe(el);
    } else items.current.delete(i);
  };
  return { active, attach };
}

// ---------- How it works ----------

function CodeScreen() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-5 text-center">
      <p className="text-sm font-semibold">Confirm your email</p>
      <div className="flex gap-1.5">
        {["4", "8", "2", "1", "9", "3"].map((d, i) => (
          <span
            key={i}
            className="tabular flex h-10 w-8 items-center justify-center rounded-input border border-border bg-surface-2 text-lg font-bold"
          >
            {d}
          </span>
        ))}
      </div>
      <span className="rounded-full bg-green-600 px-6 py-2 text-sm font-semibold text-white">
        Confirm
      </span>
    </div>
  );
}

function FindScreen() {
  const found: { name: DemoPerson; handle: string; action: string }[] = [
    { name: "Ada", handle: "ada_b", action: "Add friend" },
    { name: "Emeka", handle: "emeka", action: "Request sent" },
    { name: "Zainab", handle: "zee", action: "Message" },
  ];
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-3 py-3">
      <div className="flex items-center gap-2 rounded-full bg-surface-2 px-3 py-2 text-sm text-text-muted">
        <Search aria-hidden className="size-4" />
        ada
      </div>
      {found.map((f) => (
        <div key={f.name} className="flex items-center gap-2.5">
          <PersonAvatar name={f.name} size={40} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{f.name}</span>
            <span className="block text-xs text-text-muted">@{f.handle}</span>
          </span>
          <span className="rounded-full bg-green-100 px-2.5 py-1 text-[0.6875rem] font-semibold text-green-700">
            {f.action}
          </span>
        </div>
      ))}
    </div>
  );
}

const STEP_SCREENS = [CodeScreen, FindScreen, RoomScreen, ChatScreen] as const;

/** An accordion of the four steps: collapsed strips grow into a card with the screen, the words and a button. */
export function HowItWorks() {
  const calm = useCalm();
  const [open, setOpen] = useState(0);
  const total = copy.how.steps.length;
  return (
    <ol className="flex flex-col gap-4 md:h-[680px] md:flex-row">
      {copy.how.steps.map((step, i) => {
        const Mini = STEP_SCREENS[i] ?? CodeScreen;
        const isOpen = open === i;
        return (
          <li
            key={step.title}
            aria-current={isOpen ? "step" : undefined}
            className={cn(
              "overflow-hidden rounded-card border-2 transition-all duration-500 ease-out",
              isOpen
                ? "border-white bg-white md:flex-[4]"
                : "group/step border-yellow-400 bg-yellow-400 hover:border-white/40 hover:bg-transparent focus-within:border-white/40 focus-within:bg-transparent md:flex-[1]",
            )}
          >
            {isOpen ? (
              <div className="relative flex h-full flex-col gap-4 p-5 md:p-7">
                <span className="tabular absolute right-5 top-5 flex size-11 items-center justify-center rounded-full bg-yellow-400 text-xl font-black text-ink-950 md:right-7 md:top-7">
                  {i + 1}
                </span>
                <div className="flex h-[380px] min-h-0 items-stretch justify-start md:h-auto md:flex-1">
                  <motion.div
                    initial={calm ? false : { opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="flex aspect-[9/19] h-full flex-col overflow-hidden rounded-[1.9rem] border-[7px] border-ink-950 bg-surface text-text ring-1 ring-ink-700"
                  >
                    <AndroidStatusBar tone="dark" />
                    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden [container-type:size]">
                      <div className="flex h-[470px] w-[270px] origin-top-left scale-[calc(100cqw/270px)] flex-col">
                        <Mini />
                      </div>
                    </div>
                    <SamsungNavBar tone="dark" />
                  </motion.div>
                </div>
                <p className="sr-only">{copy.how.stepLabel(i + 1, total)}</p>
                <div>
                  <h3 className="text-[clamp(1.4rem,2.4vw,2rem)] font-bold tracking-[-0.02em] text-ink-950">
                    {step.title}
                  </h3>
                  <p className="mt-2 max-w-[46ch] text-text-muted">{step.body}</p>
                  <Link
                    href={step.cta.href}
                    className={buttonStyles("accent", "mt-4 min-h-11 px-6")}
                  >
                    {step.cta.label}
                    <ArrowUpRight aria-hidden className="size-4" />
                  </Link>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setOpen(i)}
                aria-expanded={false}
                className="flex h-16 w-full items-center gap-4 px-5 text-left md:h-full md:flex-col md:gap-6 md:px-0 md:py-6"
              >
                <span
                  aria-hidden
                  className="flex size-10 shrink-0 items-center justify-center rounded-full border border-ink-950/30 text-ink-950 transition-colors group-hover/step:border-white/40 group-hover/step:text-white group-focus-within/step:border-white/40 group-focus-within/step:text-white md:order-1"
                >
                  <ArrowUpRight className="size-4" />
                </span>
                <span className="flex-1 text-lg font-bold tracking-[-0.02em] text-ink-950 transition-colors group-hover/step:text-white group-focus-within/step:text-white md:order-2 md:my-auto md:rotate-180 md:text-[clamp(1.4rem,2.4vw,2rem)] md:[writing-mode:vertical-rl]">
                  {step.title}
                </span>
                <span className="tabular flex size-9 shrink-0 items-center justify-center rounded-full bg-ink-950 text-sm font-black text-yellow-400 md:order-3 md:-rotate-90">
                  {i + 1}
                </span>
                <span className="sr-only">{copy.how.stepLabel(i + 1, total)}</span>
              </button>
            )}
          </li>
        );
      })}
    </ol>
  );
}
