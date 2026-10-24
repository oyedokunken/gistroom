import { RoomScreen } from "@/components/room/room-screen";

/**
 * Render the room directly on its page. Keeping this route out of the floating call window gives the room stage the
 * full screen and makes the page address useful when shared or reopened.
 */
export function RoomEntry({
  slug,
  invite,
  meId,
  meName,
  meAvatar,
  dataSaver,
}: {
  slug: string;
  invite: string | null;
  meId: string;
  meName: string;
  meAvatar: string | null;
  dataSaver: boolean;
}) {
  return (
    <RoomScreen
      slug={slug}
      invite={invite}
      meId={meId}
      meName={meName}
      meAvatar={meAvatar}
      dataSaver={dataSaver}
    />
  );
}
