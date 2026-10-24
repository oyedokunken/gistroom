"use client";

import Link from "next/link";
import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { Code2, Coffee, ExternalLink } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { footer, social } from "@/content/landing";
import { builderCredit } from "@/content/site";
import { OPEN_CONSENT_EVENT } from "@/components/system/consent-banner";

const BARS = [0.35, 0.7, 0.5, 0.95, 0.6, 0.85, 0.45, 0.75, 0.55, 0.9, 0.4, 0.7];

/** Oversized wordmark with an endless waveform behind it. It pauses only while off screen. */
function Wordmark() {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.05 });
  const run = inView && !reduced;
  return (
    <div ref={ref} data-wordmark className="relative select-none overflow-x-clip pt-10">
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

function openCookieSettings() {
  window.dispatchEvent(new Event(OPEN_CONSENT_EVENT));
}

export function Footer({ year = new Date().getUTCFullYear() }: { year?: number }) {
  return (
    <footer
      aria-label={footer.label}
      className="border-t border-border bg-surface-2 pb-40 md:pb-24"
    >
      <div className="mx-auto max-w-[1200px] px-4 pt-14 md:px-6">
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4 lg:gap-10">
          {footer.columns.map((col) => (
            <div key={col.title}>
              <h2 className="text-sm font-semibold text-text">{col.title}</h2>
              <ul className="mt-3 flex flex-col">
                {col.links.map((l) => (
                  <li key={l.href}>
                    {l.href === "#cookie-settings" ? (
                      <button
                        type="button"
                        onClick={openCookieSettings}
                        className="inline-flex min-h-11 items-center text-text-muted hover:text-green-700"
                      >
                        {l.label}
                      </button>
                    ) : (
                      <Link
                        href={l.href}
                        className="inline-flex min-h-11 items-center text-text-muted hover:text-green-700"
                      >
                        {l.label}
                      </Link>
                    )}
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

        {/* Phones keep the theme control here. From tablet up it floats at the bottom right. */}
        <div className="mt-4 flex justify-center md:hidden">
          <ThemeToggle />
        </div>

        {/* As wide as the wordmark above it. Phones may wrap onto a second row. */}
        <div
          data-legal-row
          className="mx-[6%] mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-0 whitespace-nowrap text-[clamp(0.5625rem,2.9vw,0.875rem)] tracking-tight text-text-muted md:grid md:grid-cols-3 md:gap-0"
        >
          <p className="min-h-11 basis-full content-center text-center md:basis-auto md:justify-self-start">
            {footer.copyright(year)}
          </p>
          <div className="flex min-h-11 basis-full items-center justify-center gap-x-4 md:contents">
            <p className="md:justify-self-center">
              {builderCredit.prefix}{" "}
              <a
                href={builderCredit.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-1 font-semibold text-green-700 underline-offset-4 hover:underline"
              >
                <Code2 aria-hidden className="size-4" />
                {builderCredit.label}
              </a>
            </p>
            <a
              href={footer.coffee.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-1 font-semibold text-green-700 underline-offset-4 hover:underline md:justify-self-end"
            >
              <Coffee aria-hidden className="size-4" />
              {footer.coffee.label}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
