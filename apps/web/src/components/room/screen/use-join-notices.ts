import { useRouter } from "next/navigation";
import { closeWindow } from "@/lib/call-window/store";
import { useEffect } from "react";
import { type RoomJoin, type RoomDto } from "@gistroom/shared";
import { session as sessionCopy } from "@/content/session";
import { unsupportedReason } from "@/lib/session/browser";
import { showSessionModal } from "@/lib/session/modals";
import { type Block } from "./shared";
import { type RoomView } from "@/lib/rooms/api";

/**
 * Why a room cannot be joined, and a browser that cannot run rooms, are each said once in a dialog.
 * The page behind stays quiet.
 */
export function useJoinNotices({
  slug,
  viewData,
  block,
  join,
  room,
  router,
  embedded,
}: {
  slug: string;
  viewData: RoomView | undefined;
  block: Block;
  join: RoomJoin | null;
  room: RoomDto | null;
  router: ReturnType<typeof useRouter>;
  embedded: boolean;
}) {
  // Why a room cannot be joined is said in a dialog with a way forward, and the page behind stays quiet.
  const denied: { id: string; title: string; body: string } | null = (() => {
    if (viewData?.state === "LINK_INVALID") {
      const expired = viewData.reason === "EXPIRED" || viewData.reason === "USED_UP";
      return {
        id: expired ? "link-expired" : "link-revoked",
        title: expired ? sessionCopy.room.linkExpiredTitle : sessionCopy.room.linkRevokedTitle,
        body: expired ? sessionCopy.room.linkExpiredBody : sessionCopy.room.linkRevokedBody,
      };
    }
    if (viewData?.state === "NOT_INVITED" || block === "NOT_INVITED") {
      return {
        id: "room-not-invited",
        title: sessionCopy.room.notInvitedTitle,
        body: sessionCopy.room.notInvitedBody,
      };
    }
    if (block === "FULL")
      return {
        id: "room-full",
        title: sessionCopy.room.fullTitle,
        body: sessionCopy.room.fullBody,
      };
    if (block === "LOCKED")
      return {
        id: "room-locked",
        title: sessionCopy.room.lockedTitle,
        body: sessionCopy.room.lockedBody,
      };
    if (block === "BANNED")
      return {
        id: "room-banned",
        title: sessionCopy.room.bannedTitle,
        body: sessionCopy.room.bannedBody,
      };
    if (block === "REMOVED")
      return {
        id: "room-removed-join",
        title: sessionCopy.room.removedTitle,
        body: sessionCopy.room.removedBody,
      };
    return null;
  })();
  useEffect(() => {
    if (!denied) return;
    showSessionModal({
      id: `join-denied:${slug}:${denied.id}`,
      priority: "ended",
      icon: "lock",
      title: denied.title,
      body: denied.body,
      actions: [
        {
          id: "browse",
          label: sessionCopy.modal.browseRooms,
          run: () => {
            router.push("/app/rooms");
            if (embedded) closeWindow();
          },
        },
        { id: "close", label: sessionCopy.modal.close, kind: "secondary" },
      ],
    });
  }, [denied?.id]);

  // A browser that cannot run rooms is told before anyone tries to join.
  useEffect(() => {
    if (join || !room || room.status !== "LIVE") return;
    if (
      unsupportedReason(
        navigator.userAgent,
        Boolean(navigator.mediaDevices?.getUserMedia),
        "RTCPeerConnection" in window,
      )
    ) {
      showSessionModal({
        id: "unsupported-browser",
        priority: "blocked",
        icon: "external",
        title: sessionCopy.unsupported.title,
        body: sessionCopy.unsupported.body,
        steps: sessionCopy.unsupported.steps,
        actions: [
          {
            id: "copy",
            label: sessionCopy.unsupported.copy,
            closes: false,
            run: async () => {
              await navigator.clipboard?.writeText(window.location.href).catch(() => undefined);
            },
          },
          { id: "close", label: sessionCopy.modal.close, kind: "secondary" },
        ],
      });
    }
  }, [room?.status, join]);
}
