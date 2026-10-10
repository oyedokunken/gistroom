import { getDb } from "@gistroom/db";
import { api, json } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { unreadChatCount } from "@/server/chat/unread";

export const dynamic = "force-dynamic";

/** Totals for the rail and the app icon badge. Clients refetch by cursor-free counts after any reconnect. */
export const GET = api(async () => {
  const { user } = await requireOnboarded();
  const [notifications, chats] = await Promise.all([
    getDb().notification.count({ where: { userId: user.id, readAt: null } }),
    unreadChatCount(user.id),
  ]);
  return json({ notifications, chats }, { headers: { "Cache-Control": "no-store" } });
});
