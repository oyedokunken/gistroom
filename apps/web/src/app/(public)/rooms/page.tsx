import type { Metadata } from "next";
import { Mic } from "lucide-react";
import { RoomMock } from "@/components/mock/screens";
import { PublicPage } from "@/components/public/public-page";
import { RoomsExplorer } from "@/components/public/rooms-explorer";
import { TopicCardsMarquee } from "@/components/landing/home-sections";
import {
  Band,
  Bento,
  CtaBand,
  HeroActions,
  PageHero,
  SectionHead,
  Steps,
} from "@/components/public/sections";
import { cta, roomsSearch } from "@/content/marketing";
import { roomsPage } from "@/content/pages";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { pageMetadata } from "@/lib/seo";
import { listPublicRooms } from "@/server/rooms/public";

export const metadata: Metadata = pageMetadata({
  title: roomsPage.title,
  description: roomsPage.description,
  path: "/rooms",
});

export default async function RoomsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const q = ((await searchParams).q ?? "").trim().slice(0, 60);
  const { rooms, failed } = await listPublicRooms(q ? { q } : {});

  return (
    <PublicPage
      jsonLd={[
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: roomsPage.title, path: "/rooms" },
        ]),
      ]}
    >
      <PageHero
        title={roomsSearch.hero.title}
        lead={roomsSearch.hero.lead}
        crumbs={[
          { name: "Home", href: "/" },
          { name: roomsPage.title, href: "/rooms" },
        ]}
        actions={
          <HeroActions
            primary={{
              label: roomsPage.start,
              href: "/app/rooms?new=1",
              icon: <Mic aria-hidden className="size-5" />,
            }}
          />
        }
        visual={<RoomMock />}
      />
      <RoomsExplorer initialRooms={rooms} initialQuery={q} initialFailed={failed} />

      <Band tone="soft" labelledBy="browse-h" className="[&>div]:px-0">
        <div className="px-6">
          <SectionHead id="browse-h" title={roomsPage.browse.title} lead={roomsPage.browse.lead} />
        </div>
        <TopicCardsMarquee />
      </Band>

      <Band tone="plain" labelledBy="how-h">
        <SectionHead id="how-h" title={roomsPage.how.title} lead={roomsPage.how.lead} />
        <Steps items={roomsPage.how.steps} />
      </Band>

      <Band tone="soft" labelledBy="kinds-h">
        <SectionHead id="kinds-h" title={roomsPage.kinds.title} lead={roomsPage.kinds.lead} />
        <Bento items={roomsPage.kinds.items} />
      </Band>

      <CtaBand
        title={roomsPage.closing.title}
        body={roomsPage.closing.body}
        primary={cta.startRoom}
        secondary={cta.safety}
        art="scene-village-square"
        icon="open-gist"
      />
    </PublicPage>
  );
}
