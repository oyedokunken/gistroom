import { getDb, type User } from "@gistroom/db";
import type { SearchResults } from "@gistroom/shared";
import { listPublicRooms } from "../rooms/public";
import { toPublicUser } from "../users/serialize";
import { searchPeople } from "../people/search";

const PER_GROUP = 5;

/**
 * One search box for everything a person owns or can find: people by name or username, their own chats,
 * public rooms by title or topic, and their private notes. Notes are only ever searched for the viewer.
 */
export async function searchEverything(me: User, raw: string): Promise<SearchResults> {
  const q = raw.trim().replace(/^@+/, "").toLowerCase();
  const db = getDb();

  const [people, rooms, chatRows, noteRows] = await Promise.all([
    searchPeople(me.id, q, PER_GROUP, null, me.isInternal),
    listPublicRooms({ q }),
    db.conversationMember.findMany({
      where: {
        userId: me.id,
        archivedAt: null,
        conversation: {
          members: {
            some: {
              userId: { not: me.id },
              user: {
                status: "ACTIVE",
                OR: [{ name: { contains: q, mode: "insensitive" } }, { username: { contains: q } }],
              },
            },
          },
        },
      },
      include: { conversation: { include: { members: { include: { user: true } } } } },
      orderBy: { updatedAt: "desc" },
      take: PER_GROUP,
    }),
    db.note.findMany({
      where: { userId: me.id, body: { contains: q, mode: "insensitive" } },
      include: {
        room: { select: { slug: true, title: true } },
        conversation: { include: { members: { include: { user: true } } } },
      },
      orderBy: { updatedAt: "desc" },
      take: PER_GROUP,
    }),
  ]);

  const chats = chatRows.flatMap((m) => {
    const peer = m.conversation.members.find((x) => x.userId !== me.id)?.user;
    return peer ? [{ conversationId: m.conversationId, peer: toPublicUser(peer) }] : [];
  });

  const notes = noteRows.map((n) => {
    if (n.room)
      return { id: n.id, body: n.body, where: n.room.title, href: `/app/rooms/${n.room.slug}` };
    const peer = n.conversation?.members.find((x) => x.userId !== me.id)?.user;
    return {
      id: n.id,
      body: n.body,
      where: peer?.name ?? "Chat",
      href: n.conversationId ? `/app/chats/${n.conversationId}` : "/app/chats",
    };
  });

  return { people: people.people, chats, rooms: rooms.rooms.slice(0, PER_GROUP), notes };
}
