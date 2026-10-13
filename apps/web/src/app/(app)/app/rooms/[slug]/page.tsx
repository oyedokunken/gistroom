import type { Metadata } from "next";
import { RoomEntry } from "@/components/call-window/room-entry";
import { avatarUrl } from "@gistroom/db";
import { getSessionContext } from "@/server/auth/session";

// Room pages stay out of search results (Section 12.2).
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function RoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ invite?: string }>;
}) {
  const [{ slug }, query, ctx] = await Promise.all([params, searchParams, getSessionContext()]);
  return (
    <RoomEntry
      slug={slug}
      invite={query.invite ?? null}
      meId={ctx?.user.id ?? ""}
      meName={ctx?.user.name ?? ""}
      meAvatar={ctx?.user.avatarPath ? avatarUrl(ctx.user.avatarPath) : null}
      dataSaver={ctx?.user.dataSaver ?? true}
    />
  );
}
