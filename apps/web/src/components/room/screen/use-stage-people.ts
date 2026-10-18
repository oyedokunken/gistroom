import { useMemo } from "react";
import { type RoomRole, type RoomDto, type RoomMemberDto } from "@gistroom/shared";
import { useRoomLiveKit } from "@/lib/rooms/use-room-livekit";
import { type PersonState } from "../panels/shared";

/** Who is on each tile, their role, and their mic and camera, from LiveKit and the people list the server keeps. */
export function useStagePeople({
  lk,
  members,
  room,
  meId,
  role,
}: {
  lk: ReturnType<typeof useRoomLiveKit>;
  members: { data: { members: RoomMemberDto[] } | undefined };
  room: RoomDto | null;
  meId: string;
  role: RoomRole;
}) {
  // Who each LiveKit tile belongs to, from the people list the server keeps.
  const byUser = useMemo(() => {
    const map = new Map<string, { role: RoomRole; avatarUrl: string | null }>();
    for (const m of members.data?.members ?? []) {
      map.set(m.user.id, {
        role: m.user.id === room?.host.id ? "HOST" : m.role,
        avatarUrl: m.user.avatarUrl,
      });
    }
    return map;
  }, [members.data, room?.host.id]);

  const people = useMemo(
    () =>
      lk.participants.map((p) => {
        const id = p.identity.replace(/^user_/, "");
        const known = byUser.get(id);
        return {
          p,
          id,
          role: id === meId ? role : (known?.role ?? (room?.host.id === id ? "HOST" : null)),
          avatarUrl: known?.avatarUrl ?? null,
        };
      }),
    [lk.participants, byUser, meId, role, room?.host.id],
  );

  const states = useMemo(() => {
    const out: Record<string, PersonState> = {};
    for (const { p, id } of people)
      out[id] = { mic: p.isMicrophoneEnabled, cam: p.isCameraEnabled };
    return out;
    // version bumps on every track change, which is when these flags move.
  }, [people, lk.version]);
  return { people, states };
}

/** One tile's person: the LiveKit participant, who they are and what role they hold. */
export type StagePerson = ReturnType<typeof useStagePeople>["people"][number];
