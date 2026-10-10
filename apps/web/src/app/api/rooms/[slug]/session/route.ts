import { z } from "zod";
import { api, json, parseJson } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { endRoom, leaveRoom, muteAll, setLocked, startRoom } from "@/server/rooms/service";

const schema = z.object({
  action: z.enum(["leave", "start", "end", "mute-all", "lock", "unlock"]),
});

/** Things you do to the room as a whole: leave, start a scheduled one, end it, mute everyone, lock or unlock. */
export const POST = api(async (request, ctx: { params: Promise<{ slug: string }> }) => {
  const { user } = await requireOnboarded();
  const { action } = await parseJson(request, schema);
  const { slug } = await ctx.params;
  switch (action) {
    case "leave":
      await leaveRoom(user, slug);
      return json({ ok: true });
    case "start":
      return json({ room: await startRoom(user, slug) });
    case "end":
      await endRoom(user, slug);
      return json({ ok: true });
    case "mute-all":
      await muteAll(user, slug);
      return json({ ok: true });
    case "lock":
    case "unlock":
      return json({ room: await setLocked(user, slug, action === "lock") });
  }
});
