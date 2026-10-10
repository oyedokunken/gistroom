import type { Metadata } from "next";
import { PublicPage } from "@/components/public/public-page";
import { RoomsExplorer } from "@/components/public/rooms-explorer";
import { HeroActions, PageHero } from "@/components/public/sections";
import { roomsSearch } from "@/content/marketing";
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
        actions={<HeroActions primary={{ label: roomsPage.start, href: "/app/rooms?new=1" }} />}
      />
      <RoomsExplorer initialRooms={rooms} initialQuery={q} initialFailed={failed} />
    </PublicPage>
  );
}
