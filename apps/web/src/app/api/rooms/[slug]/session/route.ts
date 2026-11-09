import { z } from "zod";
import { api, json, parseJson } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import {
  endRoom,
  leaveRoom,
  muteAll,
  setGoing,
  setReminders,
  setLocked,
  startRoom,
} from "@/server/rooms/service";

const schema = z.object({
  action: z.enum([
    "leave",
    "start",
    "end",
    "mute-all",
    "lock",
    "unlock",
    "going",
    "not-going",
    "reminders-on",
    "reminders-off",
  ]),
  /** With mute-all: only moderators can unmute people afterwards. */
  lockUnmute: z.boolean().optional(),
});

/** Things you do to the room as a whole: leave, start a scheduled one, end it, mute everyone, lock or unlock. */
export const POST = api(async (request, ctx: { params: Promise<{ slug: string }> }) => {
  const { user } = await requireOnboarded();
  const { action, lockUnmute } = await parseJson(request, schema);
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
    case "going":
    case "not-going":
      return json({ room: await setGoing(user, slug, action === "going") });
    case "reminders-on":
    case "reminders-off":
      return json({ room: await setReminders(user, slug, action === "reminders-on") });
    case "mute-all":
      await muteAll(user, slug, { lockUnmute });
      return json({ ok: true });
    case "lock":
    case "unlock":
      return json({ room: await setLocked(user, slug, action === "lock") });
  }
});
