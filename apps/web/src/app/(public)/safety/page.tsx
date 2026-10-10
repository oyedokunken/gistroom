import type { Metadata } from "next";
import Link from "next/link";
import { PublicPage } from "@/components/public/public-page";
import { SafetyMock } from "@/components/public/mocks";
import {
  Band,
  Bento,
  Callout,
  CtaBand,
  HeroActions,
  PageHero,
  SectionHead,
  StatementGrid,
  Steps,
} from "@/components/public/sections";
import { cta, safetyPage as p } from "@/content/marketing";
import { safety } from "@/content/pages";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { rhythm } from "@/lib/rhythm";
import { pageMetadata } from "@/lib/seo";

const tones = rhythm.safety;

export const metadata: Metadata = pageMetadata({
  title: safety.title,
  description: safety.description,
  path: "/safety",
});

export default function Page() {
  return (
    <PublicPage
      jsonLd={[
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: safety.title, path: "/safety" },
        ]),
      ]}
    >
      <PageHero
        title={p.hero.title}
        lead={p.hero.lead}
        crumbs={[
          { name: "Home", href: "/" },
          { name: safety.title, href: "/safety" },
        ]}
        actions={
          <HeroActions primary={cta.enter} secondary={{ label: "Contact us", href: "/support" }} />
        }
        visual={<SafetyMock />}
      />

      <Band tone={tones[1]} labelledBy="guidelines-h">
        <SectionHead id="guidelines-h" title={p.guidelines.title} />
        <StatementGrid items={p.guidelines.items} />
      </Band>

      <Band tone={tones[2]} labelledBy="tools-h">
        <SectionHead id="tools-h" title={p.tools.title} />
        <Bento items={p.tools.items} />
      </Band>

      <Band tone={tones[3]} labelledBy="how-h">
        <SectionHead id="how-h" title={p.how.title} />
        <Steps items={p.how.steps} />
      </Band>

      <Band tone={tones[4]}>
        <Callout title={p.moderators.title} body={p.moderators.body} tone="soft" />
      </Band>

      <Band tone={tones[5]} labelledBy="contact-h">
        <div className="grid items-center gap-8 md:grid-cols-[1fr_auto]">
          <div>
            <h2
              id="contact-h"
              className="text-[clamp(1.75rem,4vw,2.5rem)] font-bold tracking-[-0.02em]"
            >
              {p.contact.title}
            </h2>
            <p className="mt-3 max-w-[56ch] text-lg text-white/85">{p.contact.body}</p>
          </div>
          <Link
            href={p.contact.action.href}
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-yellow-400 px-8 font-semibold text-ink-950 hover:bg-yellow-100"
          >
            {p.contact.action.label}
          </Link>
        </div>
      </Band>

      <CtaBand
        title="Talk freely. Stay safe."
        body="You decide who can reach you, and you can block or report in one tap."
        primary={cta.enter}
        secondary={cta.features}
      />
    </PublicPage>
  );
}
