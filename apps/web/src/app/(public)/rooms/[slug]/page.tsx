import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb, toPublicUser } from "@gistroom/db";
import { LANGUAGE_LABELS } from "@gistroom/shared";
import { PublicPage } from "@/components/public/public-page";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { roomsPage } from "@/content/pages";
import { microcopy } from "@/content/microcopy";
import { breadcrumbJsonLd, eventJsonLd } from "@/lib/jsonld";
import { pageMetadata } from "@/lib/seo";
import { getSessionContext } from "@/server/auth/session";

async function loadRoom(slug: string) {
  try {
    return await getDb().room.findUnique({
      where: { slug },
      include: {
        host: true,
        topic: true,
        _count: { select: { members: { where: { state: "JOINED" } } } },
      },
    });
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const room = await loadRoom((await params).slug);
  // Private, ended and unknown rooms say nothing about themselves and stay out of search (Section 12.2).
  if (!room || room.visibility !== "PUBLIC" || room.status === "ENDED")
    return { robots: { index: false, follow: false } };
  return pageMetadata({
    title: room.title,
    description: room.description ?? `A live room on Gistroom, hosted by ${room.host.name}.`,
    path: `/rooms/${room.slug}`,
  });
}

export default async function PublicRoomPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const room = await loadRoom(slug);
  if (!room || room.status === "ENDED") notFound();

  const ctx = await getSessionContext().catch(() => null);
  const joinPath = `/app/rooms/${room.slug}`;

  // The same screen for a private room and for one that does not exist for you: no title, host or member leaks.
  if (room.visibility === "PRIVATE") {
    return (
      <PublicPage>
        <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center px-6 pt-24 text-center">
          <EmptyState icon="private-room" title={microcopy.notInvited} />
          <Link href="/rooms" className={buttonStyles("secondary", "mt-2")}>
            {roomsPage.title}
          </Link>
        </div>
      </PublicPage>
    );
  }

  const host = toPublicUser(room.host);
  const live = room.status === "LIVE";
  const path = `/rooms/${room.slug}`;
  const jsonLd: unknown[] = [
    breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Rooms", path: "/rooms" },
      { name: room.title, path },
    ]),
  ];
  if (!live && room.scheduledFor) {
    jsonLd.push(
      eventJsonLd({
        name: room.title,
        description: room.description,
        startDate: room.scheduledFor,
        path,
      }),
    );
  }

  return (
    <PublicPage jsonLd={jsonLd}>
      <article className="mx-auto w-full max-w-[44rem] px-6 pb-24 pt-28 md:pt-36">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={live ? "yellow" : "neutral"}>{live ? "Live now" : "Scheduled"}</Badge>
          {room.topic ? <Badge tone="green">{room.topic.name}</Badge> : null}
          <Badge tone="neutral">{LANGUAGE_LABELS[room.language]}</Badge>
        </div>
        <h1 className="mt-4 text-[clamp(2rem,6vw,3.25rem)] font-black leading-[1.05] tracking-[-0.03em] text-text">
          {room.title}
        </h1>
        {room.description ? (
          <p className="mt-4 text-lg text-text-muted">{room.description}</p>
        ) : null}
        <div className="mt-6 flex items-center gap-3">
          <Avatar name={host.name} src={host.avatarUrl} size={44} />
          <div className="flex flex-col">
            <span className="font-semibold text-text">{host.name}</span>
            <span className="text-sm text-text-muted">@{host.username}</span>
          </div>
          {live ? (
            <span className="tabular ml-auto text-sm text-text-muted">
              {room._count.members} in the room
            </span>
          ) : null}
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={ctx ? joinPath : `/login?next=${encodeURIComponent(joinPath)}`}
            className={buttonStyles("primary", "min-h-12 px-7")}
          >
            {ctx ? roomsPage.join : "Sign in to join"}
          </Link>
          <Link href="/rooms" className={buttonStyles("secondary", "min-h-12 px-7")}>
            {roomsPage.title}
          </Link>
        </div>
      </article>
    </PublicPage>
  );
}
