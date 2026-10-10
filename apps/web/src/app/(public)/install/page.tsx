import type { Metadata } from "next";
import { CardIcon, type CardIconName } from "@/components/public/card-icon";
import { PlatformInstall } from "@/components/public/platform-install";
import { PublicPage } from "@/components/public/public-page";
import { InstallMock } from "@/components/public/mocks";
import {
  Band,
  Bento,
  CtaBand,
  HeroActions,
  PageHero,
  SectionHead,
} from "@/components/public/sections";
import { cta, installPage as p } from "@/content/marketing";
import { install } from "@/content/pages";
import { breadcrumbJsonLd, softwareAppJsonLd } from "@/lib/jsonld";
import { rhythm } from "@/lib/rhythm";
import { pageMetadata } from "@/lib/seo";

const tones = rhythm.install;

export const metadata: Metadata = pageMetadata({
  title: install.title,
  description: install.description,
  path: "/install",
});

export default function Page() {
  return (
    <PublicPage
      jsonLd={[
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: install.title, path: "/install" },
        ]),
        softwareAppJsonLd(),
      ]}
    >
      <PageHero
        title={p.hero.title}
        lead={p.hero.lead}
        crumbs={[
          { name: "Home", href: "/" },
          { name: install.title, href: "/install" },
        ]}
        actions={<HeroActions primary={cta.enter} />}
        visual={<InstallMock />}
      />

      <Band tone={tones[1]} labelledBy="platforms-h">
        <h2 id="platforms-h" className="sr-only">
          Install steps for your device
        </h2>
        <div className="grid gap-6 lg:grid-cols-3">
          {p.platforms.map((pl, i) => (
            <section
              key={pl.id}
              id={pl.id}
              aria-labelledby={`${pl.id}-h`}
              className={
                i === 1
                  ? "group rounded-hero bg-green-600 p-8 text-white"
                  : "group rounded-hero bg-surface-2 p-8"
              }
            >
              <CardIcon name={pl.icon as CardIconName} className="mb-5" />
              <h3 id={`${pl.id}-h`} className="text-2xl font-bold tracking-[-0.02em]">
                {pl.title}
              </h3>
              {"note" in pl && pl.note ? <p className="mt-3 opacity-90">{pl.note}</p> : null}
              <ol className="mt-5 flex flex-col gap-4">
                {pl.steps.map((step, n) => (
                  <li key={step} className="flex items-start gap-3">
                    <span className="tabular flex size-8 shrink-0 items-center justify-center rounded-full bg-yellow-400 font-black text-ink-950">
                      {n + 1}
                    </span>
                    <span className="pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
              <PlatformInstall platform={pl.id as "android" | "ios" | "desktop"} dark={i === 1} />
            </section>
          ))}
        </div>
      </Band>

      <Band tone={tones[2]} labelledBy="why-h">
        <SectionHead id="why-h" title={p.why.title} />
        <Bento items={p.why.items} />
      </Band>

      <CtaBand
        title={p.closing.title}
        body={p.closing.body}
        primary={cta.enter}
        art="scene-danfo"
        icon="mascot-install"
      />
    </PublicPage>
  );
}
