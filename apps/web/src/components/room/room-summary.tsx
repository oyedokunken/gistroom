"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import type { RoomSummaryDto } from "@gistroom/shared";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { roomCopy as copy } from "@/content/rooms";
import { roomApi } from "@/lib/rooms/api";
import { formatFull } from "@/lib/time";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 p-3">
      <dt className="text-sm text-text-muted">{label}</dt>
      <dd className="tabular mt-1 text-xl font-bold text-text">{value}</dd>
    </div>
  );
}

/** What an ended room leaves behind. Chat is gone, the numbers and the people stay. */
export function RoomSummaryView({ summary: s }: { summary: RoomSummaryDto }) {
  return (
    <article className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {s.topicName ? <Badge>{s.topicName}</Badge> : null}
          <Badge>{s.media === "VIDEO" ? copy.create.video : copy.create.audio}</Badge>
        </div>
        <h2 className="text-2xl font-black tracking-tight text-text">{s.title}</h2>
        <p className="flex items-center gap-2 text-text-muted">
          <Avatar name={s.host.name} src={s.host.avatarUrl} size={28} />
          {copy.summary.host(s.host.name)}
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat
          label={copy.summary.started}
          value={s.startedAt ? formatFull(new Date(s.startedAt)) : "-"}
        />
        <Stat
          label={copy.summary.ended}
          value={s.endedAt ? formatFull(new Date(s.endedAt)) : "-"}
        />
        <Stat label={copy.summary.duration} value={copy.summary.durationText(s.durationSec)} />
        <Stat label={copy.summary.peak} value={String(s.peakParticipants)} />
        <Stat label={copy.summary.attendees} value={String(s.attendeeCount)} />
        <Stat label={copy.summary.messages} value={String(s.messageCount)} />
        <Stat label={copy.summary.reactions} value={String(s.reactionCount)} />
        {s.modActionCount !== null ? (
          <Stat label={copy.summary.modActions} value={String(s.modActionCount)} />
        ) : null}
      </dl>
      <p className="text-sm text-text-muted">{copy.summary.chatGone}</p>

      {s.attendees ? (
        <section aria-labelledby={`att-${s.slug}`} className="flex flex-col gap-2">
          <h3 id={`att-${s.slug}`} className="text-base font-bold text-text">
            {copy.summary.attendeesTitle}
          </h3>
          <ul className="flex flex-wrap gap-3">
            {s.attendees.map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-sm text-text">
                <Avatar name={p.name} src={p.avatarUrl} size={28} />
                {p.name}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {s.attended ? (
        <section aria-labelledby={`notes-${s.slug}`} className="flex flex-col gap-2">
          <h3
            id={`notes-${s.slug}`}
            className="flex items-center gap-2 text-base font-bold text-text"
          >
            <Lock aria-hidden className="size-4 text-green-600" />
            {copy.summary.notesTitle}
          </h3>
          {s.notes.length === 0 ? (
            <p className="text-text-muted">{copy.summary.noNotes}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {s.notes.map((n) => (
                <li key={n.id} className="rounded-2xl bg-yellow-100 p-3 text-ink-950">
                  <p className="whitespace-pre-wrap break-words">{n.body}</p>
                  <time dateTime={n.createdAt} className="tabular mt-1 block text-xs text-ink-700">
                    {formatFull(new Date(n.createdAt))}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </article>
  );
}

/** Loads one room's summary. A person who did not attend a private room gets nothing, so the caller shows the plain wall. */
export function RoomSummaryLoader({ slug }: { slug: string }) {
  const q = useQuery({
    queryKey: ["room-summary", slug],
    queryFn: () => roomApi.summary(slug),
    retry: false,
  });
  if (q.isPending) return <Skeleton className="h-64" />;
  if (q.isError) return null;
  return <RoomSummaryView summary={q.data.summary} />;
}

export function EndedRoom({ slug }: { slug: string }) {
  const q = useQuery({
    queryKey: ["room-summary", slug],
    queryFn: () => roomApi.summary(slug),
    retry: false,
  });
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-12">
      <div className="text-center">
        <h1 className="text-3xl font-black tracking-tight text-text">{copy.stage.endedTitle}</h1>
        <p className="mt-2 text-text-muted">{copy.stage.endedBody}</p>
      </div>
      {q.isPending ? (
        <Skeleton className="h-64" />
      ) : q.isError || !q.data.summary.attended ? null : (
        <RoomSummaryView summary={q.data.summary} />
      )}
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/app/discover" className={buttonStyles("primary")}>
          {copy.stage.browseLive}
        </Link>
        <Link href="/app/rooms?new=1" className={buttonStyles("secondary")}>
          {copy.start}
        </Link>
      </div>
    </div>
  );
}
