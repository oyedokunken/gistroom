import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { PublicPage } from "@/components/public/public-page";
import { DevicesMock } from "@/components/public/mocks";
import { Band, Callout, CtaBand, HeroActions, PageHero } from "@/components/public/sections";
import { cta, securityPage as p } from "@/content/marketing";
import { security } from "@/content/pages";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { pageMetadata } from "@/lib/seo";

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

      <Band tone="plain" labelledBy="pillars-h">
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
                  ? "rounded-hero bg-green-600 p-8 text-white md:col-span-2 md:p-12"
                  : "rounded-card bg-surface-2 p-8"
              }
            >
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

      <Band tone="soft">
        <Callout title={p.honest.title} body={p.honest.body} tone="yellow" />
      </Band>

      <Band tone="ink" labelledBy="report-h">
        <div className="grid items-center gap-8 md:grid-cols-[1fr_auto]">
          <div>
            <h2
              id="report-h"
              className="text-[clamp(1.75rem,4vw,2.5rem)] font-bold tracking-[-0.02em]"
            >
              {p.report.title}
            </h2>
            <p className="mt-3 max-w-[56ch] text-lg text-white/85">{p.report.body}</p>
          </div>
          <Link
            href={p.report.action.href}
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-yellow-400 px-8 font-semibold text-ink-950 hover:bg-yellow-100"
          >
            {p.report.action.label}
          </Link>
        </div>
      </Band>

      <CtaBand
        title="Safe, and easy to start."
        body="Make an account in a minute. You choose who can reach you."
        primary={cta.enter}
        secondary={cta.safety}
      />
    </PublicPage>
  );
}
