"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { PageShell } from "@/components/app/page-shell";
import { RoomSummaryView } from "@/components/room/room-summary";
import { Button, buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { roomCopy as copy } from "@/content/rooms";
import { cn } from "@/lib/cn";
import { roomApi } from "@/lib/rooms/api";
import { formatFull } from "@/lib/time";

/** Every ended room you hosted or were in, with the numbers and your own private notes. */
export function PastRooms() {
  const q = useQuery({ queryKey: ["past-rooms"], queryFn: roomApi.past });
  const [open, setOpen] = useState<string | null>(null);

  return (
    <PageShell
      variant="narrow"
      title={copy.past.title}
      action={
        <Link href="/app/rooms" className={buttonStyles("secondary")}>
          {copy.stage.backToRooms}
        </Link>
      }
    >
      {q.isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : q.isError ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-text-muted">{copy.past.loadError}</p>
          <Button variant="secondary" onClick={() => void q.refetch()}>
            {copy.stage.retry}
          </Button>
        </div>
      ) : q.data.rooms.length === 0 ? (
        <EmptyState icon="voice" title={copy.past.emptyTitle} body={copy.past.empty} />
      ) : (
        <ul className="flex flex-col gap-3">
          {q.data.rooms.map((s) => {
            const expanded = open === s.slug;
            return (
              <li key={s.slug} className="rounded-card border border-border bg-surface">
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? null : s.slug)}
                  className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-text">{s.title}</span>
                    <span className="tabular block text-sm text-text-muted">
                      {s.endedAt ? formatFull(new Date(s.endedAt)) : ""}
                      {" | "}
                      {copy.summary.durationText(s.durationSec)}
                    </span>
                  </span>
                  <ChevronDown
                    aria-hidden
                    className={cn("size-5 shrink-0 transition-transform", expanded && "rotate-180")}
                  />
                </button>
                {expanded ? (
                  <div className="border-t border-border p-4">
                    <RoomSummaryView summary={s} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}
