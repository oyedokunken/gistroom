import { getDb, type Note, type User } from "@gistroom/db";
import { LIMITS, errors, type NoteDto } from "@gistroom/shared";
import { AppError, forbidden, notFound } from "../http";
import { enforce, policies } from "../rate-limit";

const toDto = (n: Note): NoteDto => ({
  id: n.id,
  body: n.body,
  createdAt: n.createdAt.toISOString(),
  updatedAt: n.updatedAt.toISOString(),
});

export type NoteScope = { conversationId: string } | { roomId: string };

/** Resolves a room slug or a conversation id to a scope the person is allowed to keep notes in. */
export async function resolveScope(
  me: User,
  input: { conversationId?: string; roomSlug?: string },
): Promise<NoteScope> {
  const db = getDb();
  if (input.conversationId) {
    const member = await db.conversationMember.findUnique({
      where: {
        conversationId_userId: { conversationId: input.conversationId, userId: me.id },
      },
      select: { id: true },
    });
    if (!member) throw notFound();
    return { conversationId: input.conversationId };
  }
  if (input.roomSlug) {
    const room = await db.room.findUnique({
      where: { slug: input.roomSlug },
      select: { id: true, hostId: true },
    });
    if (!room) throw notFound();
    const member = await db.roomMember.findUnique({
      where: { roomId_userId: { roomId: room.id, userId: me.id } },
      select: { state: true },
    });
    // Anyone who took part keeps their notes. People who were removed or banned lose the room, not their words.
    const took = member && (member.state === "JOINED" || member.state === "LEFT");
    if (!took && room.hostId !== me.id) throw forbidden();
    return { roomId: room.id };
  }
  throw new AppError(400, "INVALID", errors.invalidRequest);
}

export async function listNotes(me: User, scope: NoteScope): Promise<NoteDto[]> {
  const rows = await getDb().note.findMany({
    where: { userId: me.id, ...scope },
    orderBy: { createdAt: "desc" },
    take: LIMITS.NOTES_PER_SCOPE_MAX,
  });
  return rows.map(toDto);
}

export async function createNote(me: User, scope: NoteScope, body: string): Promise<NoteDto> {
  await enforce(policies.noteWrite, me.id);
  const db = getDb();
  const count = await db.note.count({ where: { userId: me.id, ...scope } });
  if (count >= LIMITS.NOTES_PER_SCOPE_MAX) {
    throw new AppError(400, "INVALID", errors.notesFull(LIMITS.NOTES_PER_SCOPE_MAX));
  }
  return toDto(await db.note.create({ data: { userId: me.id, ...scope, body } }));
}

async function owned(me: User, id: string): Promise<Note> {
  const note = await getDb().note.findUnique({ where: { id } });
  // Someone else's note looks the same as one that does not exist.
  if (!note || note.userId !== me.id) throw notFound();
  return note;
}

export async function updateNote(me: User, id: string, body: string): Promise<NoteDto> {
  await enforce(policies.noteWrite, me.id);
  await owned(me, id);
  return toDto(await getDb().note.update({ where: { id }, data: { body } }));
}

export async function deleteNote(me: User, id: string): Promise<void> {
  await enforce(policies.noteWrite, me.id);
  await owned(me, id);
  await getDb().note.delete({ where: { id } });
}
