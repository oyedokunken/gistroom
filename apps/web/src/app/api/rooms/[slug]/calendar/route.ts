import { api, notFound } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { buildIcs } from "@/server/mail/ics";
import { viewRoom } from "@/server/rooms/service";

export const dynamic = "force-dynamic";

/** A calendar entry for a scheduled room. Only people who may see the room get it, so a private title never leaks. */
export const GET = api(async (_request, ctx: { params: Promise<{ slug: string }> }) => {
  const { user } = await requireOnboarded();
  const { slug } = await ctx.params;
  const view = await viewRoom(user, slug);
  if (view.state !== "OK" || view.room.status !== "SCHEDULED" || !view.room.scheduledFor) {
    throw notFound();
  }
  const { room } = view;
  const ics = buildIcs({
    uid: room.slug,
    title: room.title,
    description: `Hosted by ${room.host.name} on Gistroom.`,
    startsAt: new Date(room.scheduledFor ?? Date.now()),
    url: `${getEnv().APP_URL}/app/rooms/${room.slug}`,
  });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="gistroom-room.ics"',
      "Cache-Control": "private, no-store",
    },
  });
});
