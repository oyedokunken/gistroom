"use client";

import Link from "next/link";
import type { ComponentProps, MouseEvent } from "react";
import { openRoom } from "@/lib/call-window/store";

/**
 * A link to a room. A plain click opens the room in the call window and leaves the page as it is. A modified click, a
 * middle click or "open in new tab" still goes to the room's own address, which opens the window there.
 */
export function RoomLink({
  slug,
  onClick,
  ...rest
}: { slug: string } & Omit<ComponentProps<typeof Link>, "href">) {
  return (
    <Link
      {...rest}
      href={`/app/rooms/${slug}`}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e);
        if (
          e.defaultPrevented ||
          e.button !== 0 ||
          e.metaKey ||
          e.ctrlKey ||
          e.shiftKey ||
          e.altKey
        ) {
          return;
        }
        e.preventDefault();
        openRoom(slug);
      }}
    />
  );
}
