"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
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
}) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <ul
        className={cn(
          "grid min-h-0 flex-1 gap-3 overflow-y-auto p-3 sm:p-4",
          peopleCount <= 1 && "mx-auto w-full max-w-4xl",
        )}
        style={{
          gridTemplateColumns: `repeat(${stageColumns(visible.length, viewportWidth)}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${stageRows(visible.length, stageColumns(visible.length, viewportWidth))}, minmax(10rem, 1fr))`,
        }}
      >
        {visible.map(({ p, id, role: r, avatarUrl }) => (
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
