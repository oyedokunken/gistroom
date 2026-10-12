import type { Metadata } from "next";
import Link from "next/link";
import { CardIcon, type CardIconName } from "@/components/public/card-icon";
import { AuthLink } from "@/components/public/auth-cta";
import { PublicPage } from "@/components/public/public-page";
import { AnimatedArt } from "@/components/public/animated-art";
import { MAKER_PHOTOS, MakerRing } from "@/components/public/maker-ring";
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
import { buttonStyles } from "@/components/ui/button";
import { about } from "@/content/pages";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { rhythm } from "@/lib/rhythm";
import { pageMetadata } from "@/lib/seo";

const tones = rhythm.about;

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

      <Band tone={tones[1]} labelledBy="story-h">
        <div className="grid items-center gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div className="group flex flex-col items-start gap-5">
            <CardIcon name={p.story.icon as CardIconName} />
            <h2
              id="story-h"
              className="text-[clamp(1.75rem,4vw,2.75rem)] font-bold leading-[1.08] tracking-[-0.025em]"
            >
              {p.story.title}
            </h2>
            <AuthLink
              to={cta.enter}
              className={buttonStyles(
                "accent",
                "min-h-12 w-fit min-w-[11rem] justify-center px-8 text-base",
              )}
            />
          </div>
          <div className="flex flex-col gap-5 text-lg text-text-muted">
            {p.story.body.map((para) => (
              <p key={para} className="max-w-[60ch]">
                {para}
              </p>
            ))}
          </div>
        </div>
      </Band>

      <Band tone={tones[2]} labelledBy="principles-h">
        <SectionHead id="principles-h" title={p.principles.title} />
        <StatementGrid items={p.principles.items} />
      </Band>

      <Band tone={tones[3]} labelledBy="maker-h">
        <div data-maker className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
          <AnimatedArt
            id="scene-dev-desk"
            alt="A developer at a tidy desk writing code on a laptop, with a plant and a cup beside them"
            width={1024}
            height={1024}
            className="w-full max-w-[17rem] md:max-w-sm"
            sizes="(max-width: 768px) 100vw, 28rem"
          />
          <h2
            id="maker-h"
            className="text-[clamp(1.75rem,4vw,2.75rem)] font-black tracking-[-0.03em]"
          >
            {p.maker.title}
          </h2>
          <p className="max-w-[56ch] text-lg">{p.maker.body}</p>
          <Link
            href={p.maker.link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-14 items-center justify-center gap-3 rounded-full bg-ink-950 py-2 pl-2 pr-8 font-semibold text-white hover:bg-ink-700"
          >
            <MakerRing photos={MAKER_PHOTOS} />
            {p.maker.link.label}
          </Link>
        </div>
      </Band>

      <Band tone={tones[4]} labelledBy="tools-h">
        <SectionHead id="tools-h" icon="tools" title={p.tools.title} lead={p.tools.lead} />
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {p.tools.items.map((tool) => (
            <li
              key={tool.name}
              className="group flex flex-col items-center gap-3 rounded-card bg-green-600 p-5 text-center text-white transition duration-300 hover:-translate-y-1.5 hover:bg-green-700 hover:shadow-lift motion-reduce:transition-none motion-reduce:hover:transform-none"
            >
              <span className="flex size-12 items-center justify-center rounded-full bg-white p-2.5 shadow-soft transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110 motion-reduce:group-hover:transform-none">
                {/* Real brand SVGs served locally from /images/tools (see scripts note in Section 17). */}
                <img
                  src={`/images/tools/${tool.icon}.svg`}
                  alt=""
                  width={28}
                  height={28}
                  className="size-7"
                />
              </span>
              <span className="text-sm font-bold">{tool.name}</span>
              <span className="text-xs text-white">{tool.role}</span>
            </li>
          ))}
        </ul>
      </Band>

      <CtaBand
        title={p.closing.title}
        body={p.closing.body}
        primary={cta.enter}
        secondary={cta.rooms}
        art="scene-rooftop"
        icon="mascot-gist"
      />
    </PublicPage>
  );
}
