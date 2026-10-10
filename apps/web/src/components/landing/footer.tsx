"use client";

import Link from "next/link";
import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { ExternalLink } from "lucide-react";
import { ScrollToTop } from "@/components/ui/scroll-to-top";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { footer, social } from "@/content/landing";

const BARS = [0.35, 0.7, 0.5, 0.95, 0.6, 0.85, 0.45, 0.75, 0.55, 0.9, 0.4, 0.7];

/** Oversized wordmark with an endless waveform behind it. It pauses only while off screen. */
function Wordmark() {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.05 });
  const run = inView && !reduced;
  return (
    <div ref={ref} className="relative select-none overflow-x-clip pt-10">
      <p
        aria-hidden
        className="relative z-10 pb-[0.2em] text-center text-[clamp(4rem,19vw,15rem)] font-black leading-[0.85] tracking-[-0.05em] text-green-600"
      >
        {footer.wordmark}
      </p>
      <div
        aria-hidden
        className="absolute inset-x-[6%] bottom-0 z-0 flex h-full items-end justify-between"
      >
        {BARS.map((h, i) => (
          <motion.span
            key={i}
            className="w-[5%] origin-bottom rounded-full bg-yellow-400"
            style={{ height: "100%", scaleY: h }}
            animate={
              run
                ? { scaleY: [h * 0.35, h, h * 0.6, Math.min(1, h + 0.15), h * 0.35] }
                : { scaleY: h }
            }
            transition={{
              duration: 1.6 + (i % 4) * 0.35,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.08,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function Footer() {
  return (
    <footer
      aria-label={footer.label}
      className="border-t border-border bg-surface-2 pb-44 md:pb-10"
    >
      <div className="mx-auto max-w-[1200px] px-6 pt-14">
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4 lg:gap-10">
          {footer.columns.map((col) => (
            <div key={col.title}>
              <h2 className="text-sm font-semibold text-text">{col.title}</h2>
              <ul className="mt-3 flex flex-col">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="inline-flex min-h-11 items-center text-text-muted hover:text-green-700"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {social.length > 0 ? (
          <div className="mt-8 flex flex-wrap items-center gap-2">
            <h2 className="mr-2 text-sm font-semibold text-text">{footer.followTitle}</h2>
            {social.map((s) => (
              <a
                key={s.label}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border px-4 text-sm font-medium text-text"
              >
                {s.label}
                <ExternalLink aria-hidden className="size-3.5" />
              </a>
            ))}
          </div>
        ) : null}

        <Wordmark />

        <div className="mt-6 grid grid-cols-2 items-center gap-y-3 text-sm text-text-muted md:flex md:justify-between">
          <ThemeToggle className="order-first col-span-2 justify-self-center md:order-2" />
          <p className="md:order-1">{footer.madeIn}</p>
          <p className="justify-self-end text-right md:order-3">
            {footer.builtBy}{" "}
            <a
              href={footer.builder.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center font-semibold text-green-700 underline-offset-4 hover:underline"
            >
              {footer.builder.label}
            </a>
          </p>
        </div>
      </div>
      <ScrollToTop />
    </footer>
  );
}
