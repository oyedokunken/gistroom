import type { Metadata } from "next";
import { Suspense } from "react";
import { RoomsHome } from "@/components/room/rooms-home";
import { pages } from "@/content/app";
import { listPublicRooms } from "@/server/rooms/public";

export const metadata: Metadata = { title: pages.rooms.title };

export default async function Page() {
  const { rooms, failed } = await listPublicRooms();
  return (
    <Suspense>
      <RoomsHome initialRooms={rooms} initialFailed={failed} />
    </Suspense>
  );
}
