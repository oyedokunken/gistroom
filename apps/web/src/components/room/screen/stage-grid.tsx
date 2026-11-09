"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PresentationTile } from "@/components/live/presentation-tile";
import type { Presenter } from "@/lib/live/use-presenter";
import { roomCopy as copy } from "@/content/rooms";
import { cn } from "@/lib/cn";
import { stageColumns, stageRows } from "@/lib/rooms/grid";
import { useRoomLiveKit } from "@/lib/rooms/use-room-livekit";
import { session as sessionCopy } from "@/content/session";
import { ParticipantTile } from "../participant-tile";
import { type QualityLabel } from "@/lib/live/live-session";
import { type FloatingReaction } from "@/lib/rooms/store";
import { type StagePerson } from "./use-stage-people";

/** The tiles for one page of people, and the pager when there is more than one page. */
export function StageGrid({
  peopleCount,
  visible,
  viewportWidth,
  quality,
  mirror,
  lk,
  floating,
  slug,
  dropReaction,
  page,
  pages,
  setPage,
  presenter,
}: {
  peopleCount: number;
  visible: StagePerson[];
  viewportWidth: number;
  quality: Record<string, QualityLabel>;
  mirror: boolean;
  lk: ReturnType<typeof useRoomLiveKit>;
  floating: readonly FloatingReaction[];
  slug: string;
  dropReaction: (slug: string, id: string) => void;
  page: number;
  pages: number;
  setPage: (update: (n: number) => number) => void;
  presenter: Presenter;
}) {
  // Someone else is presenting: their screen is a stage tile. Viewers can enlarge it or put it back in the grid.
  const [pinned, setPinned] = useState(true);
  const sharer = presenter.remoteSharer
    ? lk.participants.find((x) => x.identity === presenter.remoteSharer)
    : undefined;
  const enlarged = Boolean(sharer) && pinned;
  const cells = visible.length + (sharer && !enlarged ? 1 : 0);
  const tile = sharer ? (
    <PresentationTile
      participant={sharer}
      version={lk.version}
      p={presenter}
      pinned={pinned}
      onTogglePin={() => setPinned((v) => !v)}
      className="h-full flex-1"
    />
  ) : null;
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {sharer && enlarged ? (
        <div className="flex min-h-0 flex-[3] p-3 pb-0 sm:p-4 sm:pb-0">{tile}</div>
      ) : null}
      <ul
        className={cn(
          "grid gap-3 p-3 sm:p-4",
          enlarged ? "max-h-44 shrink-0 overflow-x-auto" : "min-h-0 flex-1 overflow-y-auto",
          peopleCount <= 1 && !enlarged && "mx-auto w-full max-w-4xl",
        )}
        style={
          enlarged
            ? { gridAutoFlow: "column", gridAutoColumns: "11rem", gridTemplateRows: "8.5rem" }
            : {
                gridTemplateColumns: `repeat(${stageColumns(cells, viewportWidth)}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${stageRows(cells, stageColumns(cells, viewportWidth))}, minmax(10rem, 1fr))`,
              }
        }
      >
        {sharer && !enlarged ? <li className="flex min-h-40">{tile}</li> : null}
        {visible.map(({ p, id, role: r, avatarUrl, badges }) => (
          <ParticipantTile
            key={p.identity}
            participant={p}
            quality={quality[p.identity] ?? "unknown"}
            mirror={mirror}
            speaking={lk.speaking.has(p.identity)}
            roleLabel={
              r === "HOST" ? copy.stage.host : r === "MODERATOR" ? copy.stage.moderator : null
            }
            version={lk.version}
            avatarUrl={avatarUrl}
            badges={badges}
            reactions={floating.filter((f) => f.userId === id)}
            onReactionDone={(rid) => dropReaction(slug, rid)}
          />
        ))}
      </ul>
      {pages > 1 ? (
        <div className="flex items-center justify-center gap-3 pb-2 text-sm text-white/80">
          <button
            type="button"
            aria-label={sessionCopy.controls.prev}
            disabled={page === 0}
            onClick={() => setPage((n) => Math.max(0, n - 1))}
            className="flex size-11 items-center justify-center rounded-full bg-white/10 disabled:opacity-40"
          >
            <ChevronLeft aria-hidden className="size-5" />
          </button>
          <span className="tabular">{sessionCopy.controls.page(page + 1, pages)}</span>
          <button
            type="button"
            aria-label={sessionCopy.controls.next}
            disabled={page >= pages - 1}
            onClick={() => setPage((n) => Math.min(pages - 1, n + 1))}
            className="flex size-11 items-center justify-center rounded-full bg-white/10 disabled:opacity-40"
          >
            <ChevronRight aria-hidden className="size-5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
