"use client";

import { type CardIconName } from "@/components/public/card-icon";
import Link from "next/link";
import { errors } from "@gistroom/shared";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { roomCopy as copy } from "@/content/rooms";
import { ApiClientError } from "@/lib/api";
import { type LucideIcon } from "lucide-react";

export type Panel = "chat" | "people" | "notes" | "invite" | "settings" | "log" | null;
export type Block =
  "FULL" | "LOCKED" | "NOT_INVITED" | "ENDED" | "NOT_STARTED" | "BANNED" | "REMOVED" | null;

const LOCK_EXPLAINED_KEY = "gr_lock_explained";
/** How many people one page of the stage shows. More than this and a pager appears. */
export const TILES_PER_PAGE = 16;
export const NO_REACTIONS: readonly never[] = [];

export function blockFor(e: unknown): Block {
  if (!(e instanceof ApiClientError)) return null;
  if (e.message === errors.roomFull) return "FULL";
  if (e.message === errors.roomLocked) return "LOCKED";
  if (e.message === errors.roomEnded) return "ENDED";
  if (e.message === errors.roomNotStarted) return "NOT_STARTED";
  if (e.message === errors.roomBanned) return "BANNED";
  if (e.message === errors.roomRemoved) return "REMOVED";
  if (e.status === 403) return "NOT_INVITED";
  return null;
}

export function Wall({ icon, title, body }: { icon: CardIconName; title: string; body?: string }) {
  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center px-6 text-center">
      <EmptyState icon={icon} title={title} body={body} />
      <Link href="/app/discover" className={buttonStyles("secondary")}>
        {copy.stage.browseLive}
      </Link>
    </div>
  );
}

export function lockWasExplained(): boolean {
  try {
    return window.localStorage.getItem(LOCK_EXPLAINED_KEY) === "1";
  } catch {
    return false;
  }
}

export function rememberLockExplained() {
  try {
    window.localStorage.setItem(LOCK_EXPLAINED_KEY, "1");
  } catch {
    // Without storage the explanation simply shows again next time.
  }
}

/** One button along the bottom of the stage that opens a side panel. */
export interface StagePanel {
  id: Exclude<Panel, null>;
  label: string;
  icon: LucideIcon;
  show: boolean;
}
