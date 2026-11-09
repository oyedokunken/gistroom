"use client";

import Link from "next/link";
import { LogIn, Mic, Play } from "lucide-react";
import { countdownText, roomCardAction, type PublicRoomCard } from "@gistroom/shared";
import { buttonStyles } from "@/components/ui/button";
import { roomCards as copy } from "@/content/room-cards";
import { selectSignedIn, useAuthState } from "@/lib/auth-state";
import { cn } from "@/lib/cn";
import { useNow } from "./use-now";

/**
 * The one action on a room card. A host starts a scheduled room when it is ready, a signed in person joins a live
 * room, a signed out visitor is asked to sign in, and an upcoming room shows how long is left. The countdown is the gap
 * to the server's start time, so it is right in every time zone, and it falls back to a plain label until the time is known.
 */
export function RoomAction({
  room,
  className,
  size = "sm",
}: {
  room: Pick<PublicRoomCard, "slug" | "status" | "scheduledFor" | "host">;
  className?: string;
  size?: "sm" | "md";
}) {
  const signedIn = useAuthState(selectSignedIn);
  const username = useAuthState((s) => s.person?.username ?? null);
  const now = useNow();
  const isHost = signedIn && username !== null && username === room.host.username;
  const action = roomCardAction({
    status: room.status,
    scheduledFor: room.scheduledFor,
    signedIn,
    isHost,
    now: now ?? new Date(0),
  });
  const base = cn(
    buttonStyles("primary", size === "md" ? "min-h-11 px-5" : "min-h-11 px-4 text-sm"),
    "gap-2",
    className,
  );
  const appPath = `/app/rooms/${room.slug}`;

  if (action === "SIGN_IN") {
    return (
      <Link href={`/login?next=${encodeURIComponent(appPath)}`} className={base}>
        <LogIn aria-hidden className="size-4" />
        {copy.action.signIn}
      </Link>
    );
  }
  if (action === "JOIN") {
    return (
      <Link href={appPath} className={base}>
        <Mic aria-hidden className="size-4" />
        {copy.action.join}
      </Link>
    );
  }
  if (action === "START") {
    return (
      <Link href={appPath} className={base}>
        <Play aria-hidden className="size-4" />
        {copy.action.start}
      </Link>
    );
  }
  const left = now ? countdownText(room.scheduledFor, now) : null;
  const text =
    left === null
      ? copy.action.scheduledFallback
      : left === "now"
        ? copy.action.startsSoon
        : copy.action.startsIn(left);
  return (
    <span
      className={cn(
        "tabular inline-flex min-h-11 items-center rounded-full bg-surface-2 px-4 text-sm font-semibold text-text",
        className,
      )}
    >
      {room.scheduledFor && left !== null ? <time dateTime={room.scheduledFor}>{text}</time> : text}
    </span>
  );
}
