import type { Metadata } from "next";
import { PastRooms } from "@/components/room/past-rooms";
import { roomCopy } from "@/content/rooms";

export const metadata: Metadata = { title: roomCopy.past.title };

export default function Page() {
  return <PastRooms />;
}
