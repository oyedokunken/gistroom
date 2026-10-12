import { z } from "zod";
import { roomReactionSchema } from "@gistroom/shared";
import { api, json, parseJson } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { reactToRoomMessage, sendRoomReaction } from "@/server/rooms/service";

const schema = z.union([
  roomReactionSchema.extend({ messageId: z.undefined().optional() }),
  roomReactionSchema.extend({ messageId: z.string().trim().min(1).max(64) }),
]);

/** A floating reaction for the room, or a toggle on one chat message when messageId is given. */
export const POST = api(async (request, ctx: { params: Promise<{ slug: string }> }) => {
  const { user } = await requireOnboarded();
  const input = await parseJson(request, schema);
  const { slug } = await ctx.params;
  if (input.messageId) await reactToRoomMessage(user, slug, input.messageId, input.emoji);
  else await sendRoomReaction(user, slug, input.emoji);
  return json({ ok: true });
});
