"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

/**
 * A room link navigates to the room page. Browser link actions such as opening in a new tab keep working normally.
 */
export function RoomLink({
  slug,
  ...rest
}: { slug: string } & Omit<ComponentProps<typeof Link>, "href">) {
  return <Link {...rest} href={`/app/rooms/${slug}`} />;
}
