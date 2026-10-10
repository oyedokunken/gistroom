import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Mail } from "lucide-react";
import { CardIcon, type CardIconName } from "@/components/public/card-icon";
import { PublicPage } from "@/components/public/public-page";
import { DevicesMock } from "@/components/public/mocks";
import { Band, CtaBand, HeroActions, PageHero } from "@/components/public/sections";
import { cta, securityPage as p } from "@/content/marketing";
import { security } from "@/content/pages";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { rhythm } from "@/lib/rhythm";
import { pageMetadata } from "@/lib/seo";

const tones = rhythm.security;

export const metadata: Metadata = pageMetadata({
  title: security.title,
  description: security.description,
  path: "/security",
});

export default function Page() {
  return (
    <PublicPage
      jsonLd={[
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: security.title, path: "/security" },
        ]),
      ]}
    >
      <PageHero
        title={p.hero.title}
        lead={p.hero.lead}
        crumbs={[
          { name: "Home", href: "/" },
          { name: security.title, href: "/security" },
        ]}
        actions={<HeroActions primary={cta.enter} secondary={cta.safety} />}
        visual={<DevicesMock />}
      />

      <Band tone={tones[1]} labelledBy="pillars-h">
        <h2 id="pillars-h" className="sr-only">
          How we protect you
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          {p.pillars.map((pillar, i) => (
            <section
              key={pillar.id}
              id={pillar.id}
              aria-labelledby={`${pillar.id}-h`}
              className={
                i === 0
                  ? "group rounded-hero bg-green-600 p-8 text-white md:col-span-2 md:p-12"
                  : "group rounded-card bg-surface-2 p-8"
              }
            >
              <CardIcon name={pillar.icon as CardIconName} className="mb-4" />
              <h3
                id={`${pillar.id}-h`}
                className="text-2xl font-bold tracking-[-0.02em] md:text-3xl"
              >
                {pillar.title}
              </h3>
              <ul className="mt-5 grid gap-3 md:grid-cols-2">
                {pillar.points.map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <span
                      className={
                        i === 0
                          ? "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-ink-950"
                          : "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-green-600 text-white"
                      }
                    >
                      <Check aria-hidden className="size-4" />
                    </span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </Band>

      <Band tone={tones[2]} labelledBy="honest-h">
        <div className="grid overflow-hidden rounded-hero md:grid-cols-2">
          <section
            aria-labelledby="honest-h"
            className="flex flex-col items-start bg-yellow-400 p-8 text-ink-950 md:p-12"
          >
            <CardIcon name={p.honest.icon as CardIconName} className="mb-4" />
            <h2
              id="honest-h"
              className="text-[clamp(1.5rem,3.5vw,2.25rem)] font-bold tracking-[-0.02em]"
            >
              {p.honest.title}
            </h2>
            <p className="mt-3 max-w-[56ch] pb-6 text-lg">{p.honest.body}</p>
            <Link
              href={p.honest.action.href}
              className="mt-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-ink-950 px-8 font-semibold text-white hover:bg-ink-700"
            >
              {p.honest.action.label}
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </section>
          <section
            aria-labelledby="report-h"
            className="flex flex-col items-start bg-ink-950 p-8 text-white md:p-12"
          >
            <CardIcon name={p.report.icon as CardIconName} className="mb-4" />
            <h2
              id="report-h"
              className="text-[clamp(1.5rem,3.5vw,2.25rem)] font-bold tracking-[-0.02em]"
            >
              {p.report.title}
            </h2>
            <p className="mt-3 max-w-[56ch] pb-6 text-lg text-white/85">{p.report.body}</p>
            <Link
              href={p.report.action.href}
              className="mt-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-yellow-400 px-8 font-semibold text-ink-950 hover:bg-yellow-100"
            >
              <Mail aria-hidden className="size-4" />
              {p.report.action.label}
            </Link>
          </section>
        </div>
      </Band>

      <CtaBand
        title="Safe, and easy to start."
        body="Make an account in a minute. You choose who can reach you."
        primary={cta.enter}
        secondary={cta.safety}
        art="scene-barbershop"
        icon="account"
      />
    </PublicPage>
  );
}
