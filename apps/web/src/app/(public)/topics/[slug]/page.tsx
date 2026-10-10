import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TOPICS, topicBySlug } from "@gistroom/shared";
import { ProsePage } from "@/components/public/prose-page";
import { PublicPage } from "@/components/public/public-page";
import { RoomCard } from "@/components/public/room-card";
import { buttonStyles } from "@/components/ui/button";
import { topicsPage } from "@/content/pages";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { pageMetadata } from "@/lib/seo";
import { listPublicRooms } from "@/server/rooms/public";

export function generateStaticParams() {
  return TOPICS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const topic = topicBySlug((await params).slug);
  if (!topic) return {};
  return pageMetadata({
    title: topic.name,
    description: `${topic.description} Join live rooms on Gistroom.`,
    path: `/topics/${topic.slug}`,
  });
}

export default async function TopicPage({ params }: { params: Promise<{ slug: string }> }) {
  const topic = topicBySlug((await params).slug);
  if (!topic) notFound();
  const { rooms } = await listPublicRooms({ topic: topic.slug });
  const live = rooms.filter((r) => r.status === "LIVE");
  const path = `/topics/${topic.slug}`;
  return (
    <PublicPage
      jsonLd={[
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Rooms", path: "/rooms" },
          { name: topic.name, path },
        ]),
      ]}
    >
      <ProsePage
        title={topic.name}
        lead={`${topic.description} ${topicsPage.intro(topic.name)}`}
        crumbs={[
          { name: "Home", href: "/" },
          { name: "Rooms", href: "/rooms" },
          { name: topic.name, href: path },
        ]}
        cta={{ label: topicsPage.start, href: `/app/rooms?new=1&topic=${topic.slug}` }}
        sections={[
          {
            id: "live",
            heading: topicsPage.liveHeading,
            extra:
              live.length > 0 ? (
                <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                  {live.map((r) => (
                    <RoomCard key={r.slug} room={r} />
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-text-muted">{topicsPage.none}</p>
              ),
          },
          {
            id: "other",
            heading: topicsPage.other,
            extra: (
              <ul className="mt-4 flex flex-wrap gap-2">
                {TOPICS.filter((t) => t.slug !== topic.slug).map((t) => (
                  <li key={t.slug}>
                    <Link
                      href={`/topics/${t.slug}`}
                      className={buttonStyles("ghost", "border border-border")}
                    >
                      {t.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ),
          },
        ]}
      />
    </PublicPage>
  );
}
