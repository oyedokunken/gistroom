import Link from "next/link";
import { Pencil, Sparkles } from "lucide-react";
import { topicBySlug, type DiscoverData } from "@gistroom/shared";
import { PersonActions } from "@/components/friends/person-actions";
import { RoomCard } from "@/components/public/room-card";
import { Avatar } from "@/components/ui/avatar";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { interests as copy } from "@/content/interests";

/** Rooms and people picked for someone from the topics they chose. Public rooms only. */
export function DiscoverView({ data }: { data: DiscoverData }) {
  if (data.interests.length === 0) {
    return (
      <EmptyState
        icon="open-gist"
        title={copy.noInterestsTitle}
        body={copy.noInterestsBody}
        action={
          <Link href="/interests?next=/app/discover" className={buttonStyles("primary")}>
            {copy.pick}
          </Link>
        }
      />
    );
  }
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-6 md:px-6">
      <section aria-label={copy.groupLabel} className="flex flex-wrap items-center gap-2">
        {data.interests.map((slug) => (
          <span
            key={slug}
            className="rounded-full bg-green-100 px-3 py-1.5 text-sm font-semibold text-green-700"
          >
            {topicBySlug(slug)?.name ?? slug}
          </span>
        ))}
        <Link
          href="/interests?next=/app/discover"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-green-700 hover:bg-green-100"
        >
          <Pencil aria-hidden className="size-4" />
          {copy.edit}
        </Link>
      </section>

      <section aria-labelledby="rooms-h">
        <h2 id="rooms-h" className="text-xl font-bold text-text">
          {copy.roomsTitle}
        </h2>
        <p className="mt-1 text-text-muted">
          {data.matched ? copy.roomsMatchedLead : copy.roomsUnmatchedLead}
        </p>
        {data.rooms.length === 0 ? (
          <p className="mt-4 text-text-muted">{copy.roomsEmpty}</p>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.rooms.map((room) => (
              <RoomCard key={room.slug} room={room} hrefBase="/app/rooms" />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="people-h">
        <h2 id="people-h" className="text-xl font-bold text-text">
          {copy.peopleTitle}
        </h2>
        <p className="mt-1 text-text-muted">{copy.peopleLead}</p>
        {data.people.length === 0 ? (
          <p className="mt-4 flex items-center gap-2 text-text-muted">
            <Sparkles aria-hidden className="size-4 shrink-0 text-green-600" />
            {copy.peopleEmpty}
          </p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {data.people.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded-card border border-border bg-surface p-4"
              >
                <Link href={`/app/u/${p.username}`} className="shrink-0">
                  <Avatar name={p.name} src={p.avatarUrl} size={52} />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/app/u/${p.username}`}
                    className="block truncate font-semibold text-text hover:underline"
                  >
                    {p.name}
                  </Link>
                  <p className="truncate text-sm text-text-muted">@{p.username}</p>
                  <p className="truncate text-sm text-green-700">
                    {copy.shared(p.sharedTopics.join(", "))}
                  </p>
                </div>
                <PersonActions user={p} relationship={p.relationship} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
