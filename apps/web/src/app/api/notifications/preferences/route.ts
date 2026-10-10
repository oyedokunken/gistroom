import { getDb, type Prisma } from "@gistroom/db";
import { NOTIFICATION_TYPES, notificationPrefsSchema } from "@gistroom/shared";
import { api, json, parseJson } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { loadPrefs } from "@/server/notifications/service";

export const dynamic = "force-dynamic";

export const GET = api(async () => {
  const { user } = await requireOnboarded();
  return json({ prefs: await loadPrefs(user.id), types: NOTIFICATION_TYPES });
});

export const PUT = api(async (request) => {
  const { user } = await requireOnboarded();
  const prefs = await parseJson(request, notificationPrefsSchema);
  const data = {
    switches: prefs.switches as Prisma.InputJsonValue,
    previews: prefs.previews,
    quietStart: prefs.quietStart,
    quietEnd: prefs.quietEnd,
  };
  await getDb().notificationPreference.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...data },
    update: data,
  });
  return json({ prefs: await loadPrefs(user.id) });
});
