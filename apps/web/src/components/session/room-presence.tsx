"use client";

import { useEffect } from "react";
import { LIMITS } from "@gistroom/shared";
import { session as copy } from "@/content/session";
import { onLiveEvent, useLive } from "@/lib/live/live-session";
import { pushChip } from "@/lib/session/chips";
import { showRoomNotices } from "@/lib/session/prefs";
import { PresenceAnnouncer, type Announcement } from "@/lib/session/presence-announcer";
import { sounds } from "@/lib/sound/sounds";

/**
 * Says who joined and who left a room, with a small chip and a soft tone. It never announces you to yourself, turns a
 * burst into "5 people joined", calls a quick drop and return "reconnected", and in a crowd shows counts only.
 */
export function RoomPresence() {
  useEffect(() => {
    const crowd = () => useLive.getState().participants.length > LIMITS.ROOM_CHIP_CROWD;
    const small = () => useLive.getState().participants.length <= LIMITS.ROOM_SOUND_MAX_PEOPLE;
    const self = () => useLive.getState().participants.find((p) => p.isLocal)?.identity ?? null;

    const announce = (a: Announcement) => {
      if (useLive.getState().kind !== "room") return;
      if (a.kind === "joined" && small()) sounds().play("roomJoin");
      if (a.kind === "left" && small()) sounds().play("roomLeave");
      if (!showRoomNotices()) return;
      if (a.kind === "reconnected") {
        pushChip({ text: copy.chips.reconnected(a.name), kind: "join" });
      } else if (a.kind === "joined") {
        pushChip({
          text: crowd() ? copy.chips.crowdJoined(1) : copy.chips.joined(a.name),
          kind: "join",
          key: "join",
          many: copy.chips.manyJoined,
        });
      } else {
        pushChip({
          text: crowd() ? copy.chips.manyLeft(1) : copy.chips.left(a.name),
          kind: "leave",
          key: "leave",
          many: copy.chips.manyLeft,
        });
      }
    };

    const announcer = new PresenceAnnouncer(
      {
        setTimeout: (fn, ms) => window.setTimeout(fn, ms),
        clearTimeout: (id) => window.clearTimeout(id as number),
        announce,
      },
      self,
    );

    const off = onLiveEvent((e) => {
      if (e.type === "connected") {
        // The people already here when you arrive are not announced.
        announcer.seed(useLive.getState().participants.map((p) => p.identity));
      } else if (e.type === "participant-joined") {
        if (useLive.getState().kind === "room") announcer.joined(e.identity, e.name);
      } else if (e.type === "participant-left") {
        if (useLive.getState().kind === "room") {
          announcer.left(e.identity, e.name);
          // The host dropped: everyone is told it may only be a bad moment, before anything changes hands.
          if (e.identity === useLive.getState().hostIdentity) {
            pushChip({ text: copy.room.hostReconnecting, kind: "mod" });
          }
        }
      } else if (e.type === "left") {
        announcer.dispose();
      } else if (e.type === "reconnecting") {
        sounds().play("reconnecting");
      } else if (e.type === "reconnected") {
        sounds().play("reconnected");
      }
    });
    return () => {
      off();
      announcer.dispose();
    };
  }, []);

  return null;
}
