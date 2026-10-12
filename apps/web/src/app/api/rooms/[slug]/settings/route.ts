import { roomSettingsSchema } from "@gistroom/shared";
import { api, json, parseJson } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { updateSettings } from "@/server/rooms/service";

/** Change room settings live. The host and moderators only. */
export const PATCH = api(async (request, ctx: { params: Promise<{ slug: string }> }) => {
  const { user } = await requireOnboarded();
  const input = await parseJson(request, roomSettingsSchema);
  return json({ room: await updateSettings(user, (await ctx.params).slug, input) });
});
