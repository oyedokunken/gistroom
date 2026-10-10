import type { Metadata } from "next";
import Link from "next/link";
import { LANGUAGES, LANGUAGE_LABELS, TOPICS, type Language } from "@gistroom/shared";
import { FilterChips } from "@/components/public/filter-chips";
import { PublicPage } from "@/components/public/public-page";
import { RoomCard } from "@/components/public/room-card";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { roomsPage } from "@/content/pages";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { pageMetadata } from "@/lib/seo";
import { listPublicRooms } from "@/server/rooms/public";

export const metadata: Metadata = pageMetadata({
  title: roomsPage.title,
  description: roomsPage.description,
  path: "/rooms",
});

function href(topic?: string, language?: string): string {
  const q = new URLSearchParams();
  if (topic) q.set("topic", topic);
  if (language) q.set("language", language);
  const s = q.toString();
  return s ? `/rooms?${s}` : "/rooms";
}

export default async function RoomsPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string; language?: string }>;
}) {
  const params = await searchParams;
  const topic = TOPICS.find((t) => t.slug === params.topic)?.slug;
  const language = LANGUAGES.find((l) => l === params.language) as Language | undefined;
  const { rooms, failed } = await listPublicRooms({ topic, language });
  const live = rooms.filter((r) => r.status === "LIVE");
  const soon = rooms.filter((r) => r.status === "SCHEDULED");

  return (
    <PublicPage
      jsonLd={[
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: roomsPage.title, path: "/rooms" },
        ]),
      ]}
    >
      <div className="mx-auto w-full max-w-[1200px] px-6 pb-24 pt-28 md:pt-36">
        <header className="max-w-[44rem]">
          <h1 className="text-[clamp(2.25rem,6vw,3.5rem)] font-black leading-[1.05] tracking-[-0.03em] text-text">
            {roomsPage.title}
          </h1>
          <p className="mt-5 max-w-[60ch] text-lg text-text-muted">{roomsPage.lead}</p>
          <Link href="/app/rooms?new=1" className={buttonStyles("primary", "mt-6 min-h-12 px-7")}>
            {roomsPage.start}
          </Link>
        </header>

        <div className="mt-10 flex flex-col gap-4">
          <FilterChips
            label={roomsPage.topicLabel}
            chips={[
              { label: roomsPage.allTopics, href: href(undefined, language), active: !topic },
              ...TOPICS.map((t) => ({
                label: t.name,
                href: href(t.slug, language),
                active: topic === t.slug,
              })),
            ]}
          />
          <FilterChips
            label={roomsPage.languageLabel}
            chips={[
              { label: roomsPage.allLanguages, href: href(topic), active: !language },
              ...LANGUAGES.map((l) => ({
                label: LANGUAGE_LABELS[l],
                href: href(topic, l),
                active: language === l,
              })),
            ]}
          />
        </div>

        {failed ? (
          <p role="status" className="mt-12 text-text-muted">
            {roomsPage.loadError}
          </p>
        ) : rooms.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              artId="empty-rooms"
              title={roomsPage.emptyTitle}
              body={roomsPage.emptyBody}
              action={
                <Link href="/app/rooms?new=1" className={buttonStyles("primary")}>
                  {roomsPage.start}
                </Link>
              }
            />
          </div>
        ) : (
          <>
            {live.length > 0 ? (
              <section className="mt-12" aria-labelledby="live-h">
                <h2 id="live-h" className="text-2xl font-bold text-text">
                  {roomsPage.liveHeading}
                </h2>
                <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {live.map((r) => (
                    <RoomCard key={r.slug} room={r} />
                  ))}
                </ul>
              </section>
            ) : null}
            {soon.length > 0 ? (
              <section className="mt-12" aria-labelledby="soon-h">
                <h2 id="soon-h" className="text-2xl font-bold text-text">
                  {roomsPage.soonHeading}
                </h2>
                <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {soon.map((r) => (
                    <RoomCard key={r.slug} room={r} />
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        )}
      </div>
    </PublicPage>
  );
}
