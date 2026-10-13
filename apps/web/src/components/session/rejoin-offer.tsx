"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import type { CallJoin } from "@gistroom/shared";
import { session as copy } from "@/content/session";
import { apiFetch } from "@/lib/api";
import { openCall, openRoom } from "@/lib/call-window/store";
import { useLive } from "@/lib/live/live-session";
import { roomApi } from "@/lib/rooms/api";
import { showSessionModal } from "@/lib/session/modals";

/**
 * After a reload or a reopened tab, a call that is still going or a room that still holds your seat is offered back with
 * one tap. It looks once, when the app opens, and never when you are already in one.
 */
export function RejoinOffer() {
  const pathname = usePathname();
  const asked = useRef(false);

  useEffect(() => {
    if (asked.current || useLive.getState().kind !== null) return;
    asked.current = true;
    let cancelled = false;
    void (async () => {
      try {
        const { current } = await apiFetch<{ current: CallJoin | null }>("/api/calls?current=1");
        if (cancelled) return;
        if (
          current &&
          current.call.status === "ACTIVE" &&
          pathname !== `/app/call/${current.call.id}`
        ) {
          showSessionModal({
            id: `rejoin-call:${current.call.id}`,
            priority: "disconnected",
            icon: "refresh",
            title: copy.call.rejoinCallTitle,
            body: copy.call.rejoinCallBody(current.call.peer.name),
            actions: [
              {
                id: "rejoin",
                label: copy.modal.rejoin,
                run: () => openCall(current.call.id),
              },
              { id: "close", label: copy.modal.close, kind: "secondary" },
            ],
          });
          return;
        }
        const { rooms } = await roomApi.mine();
        const mine = rooms.find((r) => r.status === "LIVE" && r.rejoin);
        if (cancelled || !mine || pathname === `/app/rooms/${mine.slug}`) return;
        showSessionModal({
          id: `rejoin-room:${mine.slug}`,
          priority: "disconnected",
          icon: "radio",
          title: copy.call.rejoinRoomTitle,
          body: copy.call.rejoinRoomBody(mine.title),
          actions: [
            {
              id: "rejoin",
              label: copy.modal.rejoin,
              run: () => openRoom(mine.slug),
            },
            { id: "close", label: copy.modal.close, kind: "secondary" },
          ],
        });
      } catch {
        // Offering a rejoin is a kindness. If the lookup fails there is nothing to say.
      }
    })();
    return () => {
      cancelled = true;
    };
    // Looked at once when the app opens.
  }, []);

  return null;
}
