"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { attendanceLabel, LANGUAGE_LABELS, type PublicRoomCard } from "@gistroom/shared";
import { buttonStyles } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { roomCards as copy } from "@/content/room-cards";
import { apiFetch } from "@/lib/api";
import { selectSignedIn, useAuthState } from "@/lib/auth-state";

/** Other rooms you might like. Same topic first, then language, then live before upcoming. Empty and error states included. */
export function RelatedRooms({ slug, onNavigate }: { slug: string; onNavigate?: () => void }) {
  const signedIn = useAuthState(selectSignedIn);
  const related = useQuery({
    queryKey: ["related-rooms", slug],
    queryFn: () => apiFetch<{ rooms: PublicRoomCard[] }>(`/api/rooms/${slug}/related`),
    staleTime: 15_000,
  });
  const base = signedIn ? "/app/rooms" : "/rooms";

  return (
    <section aria-labelledby={`related-${slug}`} className="flex flex-col gap-3">
      <h2 id={`related-${slug}`} className="text-lg font-bold text-text">
        {copy.related.heading}
      </h2>
      {related.isPending ? (
        <div role="status" aria-label={copy.related.loading} className="flex flex-col gap-2">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      ) : related.isError ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-text-muted">{copy.related.error}</p>
          <button
            type="button"
            onClick={() => void related.refetch()}
            className="min-h-11 font-semibold text-green-700 underline-offset-4 hover:underline"
          >
            {copy.related.retry}
          </button>
        </div>
      ) : related.data.rooms.length === 0 ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-text-muted">{copy.related.empty}</p>
          <Link href={signedIn ? "/app/discover" : "/rooms"} className={buttonStyles("secondary")}>
            {copy.related.emptyLink}
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {related.data.rooms.map((r) => (
            <li key={r.slug}>
              <Link
                href={`${base}/${r.slug}`}
                onClick={onNavigate}
                className="flex min-h-14 flex-col gap-0.5 rounded-xl border border-border bg-surface px-3 py-2 hover:bg-surface-2"
              >
                <span className="line-clamp-1 font-semibold text-text">{r.title}</span>
                <span className="tabular line-clamp-1 text-sm text-text-muted">
                  {r.status === "LIVE" ? copy.status.live : copy.status.upcoming}
                  {" - "}
                  {attendanceLabel(r.status, r.status === "LIVE" ? r.listeners : r.attending)}
                  {r.topicName ? ` - ${r.topicName}` : ""}
                  {` - ${LANGUAGE_LABELS[r.language]}`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
