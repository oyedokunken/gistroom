"use client";

import { Crown, Shield } from "lucide-react";
import { type RoomRole } from "@gistroom/shared";
import { roomCopy as copy } from "@/content/rooms";
import { ApiClientError } from "@/lib/api";

export const fail = (e: unknown) =>
  e instanceof ApiClientError ? e.message : copy.invite.loadError;

export interface PersonState {
  mic: boolean;
  cam: boolean;
}

// ---------- Badges ----------

export function RoleBadge({ role }: { role: RoomRole }) {
  if (role === "MEMBER") return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-400 px-2 py-0.5 text-[0.6875rem] font-bold text-ink-950">
      {role === "HOST" ? (
        <Crown aria-hidden className="size-3" />
      ) : (
        <Shield aria-hidden className="size-3" />
      )}
      {role === "HOST" ? copy.stage.host : copy.stage.moderator}
    </span>
  );
}
