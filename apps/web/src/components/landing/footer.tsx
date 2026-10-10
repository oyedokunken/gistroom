"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { ExternalLink } from "lucide-react";
import { ScrollToTop } from "@/components/ui/scroll-to-top";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { footer, social } from "@/content/landing";

const BARS = [0.35, 0.7, 0.5, 0.95, 0.6, 0.85, 0.45, 0.75, 0.55, 0.9, 0.4, 0.7];

/** Oversized wordmark. Hover or focus raises a row of waveform bars behind the letters. */
function Wordmark() {
  const reduced = useReducedMotion();
  const [hover, setHover] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.6 });
  // No hover on touch screens, so the waveform plays while the wordmark is on screen.
  const on =
    hover ||
    (inView && typeof window !== "undefined" && window.matchMedia("(hover: none)").matches);
  return (
    <div
      className="relative select-none overflow-hidden pt-10"
      ref={ref}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
    >
      <p
        aria-hidden
        className="relative z-10 text-center text-[clamp(4rem,19vw,15rem)] font-black leading-[0.85] tracking-[-0.05em] text-green-600"
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
            style={{ height: "100%" }}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: on && !reduced ? [h * 0.4, h, h * 0.5, h * 0.9] : 0 }}
            transition={{ duration: 0.9, repeat: on && !reduced ? Infinity : 0, delay: i * 0.05 }}
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
      className="border-t border-border bg-surface-2 pb-28 md:pb-10"
    >
      <div className="mx-auto max-w-[1200px] px-6 pt-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
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

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-text-muted">
          <p>{footer.madeIn}</p>
          <ThemeToggle />
          <p>
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
