import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PublicPage } from "@/components/public/public-page";
import { AlertsMock, CallMock, ChatMock, DataMock, RoomMock } from "@/components/public/mocks";
import {
  Band,
  Bento,
  CtaBand,
  Facts,
  FeatureRow,
  HeroActions,
  PageHero,
  SectionHead,
} from "@/components/public/sections";
import { cta, featuresPage as p } from "@/content/marketing";
import { features } from "@/content/pages";
import { breadcrumbJsonLd, softwareAppJsonLd } from "@/lib/jsonld";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: features.title,
  description: features.description,
  path: "/features",
});

const visuals: Record<string, ReactNode> = {
  chat: <ChatMock />,
  call: <CallMock />,
  room: <RoomMock />,
  alerts: <AlertsMock />,
  data: <DataMock />,
};

export default function Page() {
  return (
    <PublicPage
      jsonLd={[
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: features.title, path: "/features" },
        ]),
        softwareAppJsonLd(),
      ]}
    >
      <PageHero
        title={p.hero.title}
        lead={p.hero.lead}
        crumbs={[
          { name: "Home", href: "/" },
          { name: features.title, href: "/features" },
        ]}
        actions={<HeroActions primary={cta.enter} secondary={cta.rooms} />}
        visual={
          <div className="relative flex items-start justify-center gap-4">
            <ChatMock />
            <div className="hidden pt-16 sm:block">
              <CallMock />
            </div>
          </div>
        }
      />

      <Band tone="plain">
        {p.rows.map((row, i) => (
          <FeatureRow
            key={row.id}
            id={row.id}
            title={row.title}
            body={row.body}
            points={row.points}
            visual={visuals[row.visual]}
            reverse={i % 2 === 1}
          />
        ))}
      </Band>

      <Band tone="soft" labelledBy="more-h">
        <SectionHead id="more-h" title={p.more.title} />
        <Bento items={p.more.items} />
      </Band>

      <Band tone="green" labelledBy="facts-h">
        <SectionHead id="facts-h" title={p.facts.title} lead={p.facts.lead} />
        <Facts items={p.facts.items} />
      </Band>

      <CtaBand
        title={p.closing.title}
        body={p.closing.body}
        primary={cta.enter}
        secondary={cta.safety}
      />
    </PublicPage>
  );
}
