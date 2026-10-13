"use client";

import type { RoomSummaryDto } from "@gistroom/shared";
import { session as copy } from "@/content/session";
import { roomApi } from "@/lib/rooms/api";
import { formatDuration } from "@/lib/chat/voice";
import { useRoomStore } from "@/lib/rooms/store";
import { showSessionModal, type SessionAction } from "@/lib/session/modals";
import type { Nav } from "./call-outcomes";

const told = new Set<string>();

/**
 * Tells everyone in a room it is over. The person who ended it reads "You ended the room". Everyone else is told who
 * ended it, with how long it ran. Attendees can open the summary, and anyone can go and find another room.
 */
export async function showRoomEnded(slug: string, nav: Nav): Promise<void> {
  if (told.has(slug)) return;
  told.add(slug);
  let summary: RoomSummaryDto | null = null;
  try {
    summary = (await roomApi.summary(slug)).summary;
  } catch {
    summary = null;
  }
  const self = Boolean(useRoomStore.getState().selfEnded[slug]);
  const duration = summary ? formatDuration(summary.durationSec * 1000) : null;
  const title = self
    ? copy.room.endedSelfTitle
    : summary?.endedBy === "MODERATOR"
      ? copy.room.endedByModeratorTitle
      : summary?.endedBy === "HOST"
        ? copy.room.endedByHostTitle
        : copy.room.endedTitle;
  const body =
    summary && duration
      ? copy.room.endedStats(duration, summary.peakParticipants)
      : copy.room.endedBody;
  const actions: SessionAction[] = [];
  if (summary?.attended) {
    actions.push({
      id: "summary",
      label: copy.modal.viewSummary,
      run: () => nav.push(`/app/rooms/${slug}`),
    });
  }
  actions.push({
    id: "browse",
    label: copy.modal.browseRooms,
    kind: "secondary",
    run: () => nav.push("/app/rooms"),
  });
  showSessionModal({
    id: `room-ended:${slug}`,
    priority: "ended",
    icon: "radio",
    title,
    body,
    actions,
  });
}

export function forgetRoomEnded(slug: string): void {
  told.delete(slug);
}
