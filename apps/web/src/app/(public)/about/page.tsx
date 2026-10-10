import type { Metadata } from "next";
import Link from "next/link";
import { PublicPage } from "@/components/public/public-page";
import { RoomMock } from "@/components/public/mocks";
import {
  Band,
  CtaBand,
  HeroActions,
  PageHero,
  SectionHead,
  StatementGrid,
} from "@/components/public/sections";
import { aboutPage as p, cta } from "@/content/marketing";
import { about } from "@/content/pages";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: about.title,
  description: about.description,
  path: "/about",
});

export default function Page() {
  return (
    <PublicPage
      jsonLd={[
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: about.title, path: "/about" },
        ]),
      ]}
    >
      <PageHero
        title={p.hero.title}
        lead={p.hero.lead}
        crumbs={[
          { name: "Home", href: "/" },
          { name: about.title, href: "/about" },
        ]}
        actions={<HeroActions primary={cta.enter} secondary={cta.features} />}
        visual={<RoomMock />}
      />

      <Band tone="plain" labelledBy="story-h">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <h2
            id="story-h"
            className="text-[clamp(1.75rem,4vw,2.75rem)] font-bold leading-[1.08] tracking-[-0.025em]"
          >
            {p.story.title}
          </h2>
          <div className="flex flex-col gap-5 text-lg text-text-muted">
            {p.story.body.map((para) => (
              <p key={para} className="max-w-[60ch]">
                {para}
              </p>
            ))}
          </div>
        </div>
      </Band>

      <Band tone="soft" labelledBy="principles-h">
        <SectionHead id="principles-h" title={p.principles.title} />
        <StatementGrid items={p.principles.items} />
      </Band>

      <Band tone="yellow" labelledBy="maker-h">
        <div className="grid items-center gap-8 md:grid-cols-[1fr_auto]">
          <div>
            <h2
              id="maker-h"
              className="text-[clamp(1.75rem,4vw,2.75rem)] font-black tracking-[-0.03em]"
            >
              {p.maker.title}
            </h2>
            <p className="mt-3 max-w-[56ch] text-lg">{p.maker.body}</p>
          </div>
          <Link
            href={p.maker.link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-ink-950 px-8 font-semibold text-white hover:bg-ink-700"
          >
            {p.maker.link.label}
          </Link>
        </div>
      </Band>

      <CtaBand
        title={p.closing.title}
        body={p.closing.body}
        primary={cta.enter}
        secondary={cta.rooms}
      />
    </PublicPage>
  );
}
