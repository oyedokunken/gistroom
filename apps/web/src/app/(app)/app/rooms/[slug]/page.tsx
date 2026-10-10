import type { Metadata } from "next";
import { RoomScreen } from "@/components/room/room-screen";
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
    <RoomScreen
      slug={slug}
      invite={query.invite ?? null}
      meId={ctx?.user.id ?? ""}
      dataSaver={ctx?.user.dataSaver ?? true}
    />
  );
}
