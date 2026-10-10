"use client";

import Link from "next/link";
import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { ExternalLink } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { consent } from "@/content/consent";
import { footer, social } from "@/content/landing";
import { OPEN_CONSENT_EVENT } from "@/components/system/consent-banner";

const BARS = [0.35, 0.7, 0.5, 0.95, 0.6, 0.85, 0.45, 0.75, 0.55, 0.9, 0.4, 0.7];

/** Oversized wordmark with an endless waveform behind it. It pauses only while off screen. */
function Wordmark() {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.05 });
  const run = inView && !reduced;
  return (
    <div ref={ref} className="relative select-none overflow-x-clip pt-10">
      <button
        type="button"
        aria-label={footer.scrollTop}
        onClick={() => window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" })}
        className="relative z-10 block w-full cursor-pointer pb-[0.2em] text-center text-[clamp(4rem,19vw,15rem)] font-black leading-[0.85] tracking-[-0.05em] text-green-600"
      >
        <span aria-hidden>{footer.wordmark}</span>
      </button>
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
      className="border-t border-border bg-surface-2 pb-40 md:pb-10"
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
        <p className="mt-2 text-center text-sm text-text-muted">{footer.replayHint}</p>

        <div className="mt-6 grid grid-cols-1 items-center gap-y-3 text-sm text-text-muted md:flex md:justify-between">
          <div className="order-first flex flex-wrap items-center justify-center gap-3 md:order-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))}
              className="inline-flex min-h-11 items-center text-sm font-semibold text-green-700 underline-offset-4 hover:underline"
            >
              {consent.settings}
            </button>
          </div>
          {/* One centered row with a dot on phones. From tablet up the two sit at either end. */}
          <div className="flex items-center justify-center gap-2 md:contents">
            <p className="md:order-1">{footer.madeIn}</p>
            <span aria-hidden className="md:hidden">
              {footer.dot}
            </span>
            <p className="md:order-3">
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
      </div>
    </footer>
  );
}
