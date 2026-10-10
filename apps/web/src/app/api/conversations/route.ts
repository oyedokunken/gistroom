import { openChatSchema } from "@gistroom/shared";
import { api, json, parseJson } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { assertCanInteract, archivedUnreadCount, listConversations } from "@/server/chat/service";
import { ensureConversation } from "@/server/friends/service";

export const dynamic = "force-dynamic";

export const GET = api(async (request) => {
  const { user } = await requireOnboarded();
  const archived = new URL(request.url).searchParams.get("archived") === "1";
  const [conversations, archivedUnread] = await Promise.all([
    listConversations(user, archived),
    archived ? Promise.resolve(0) : archivedUnreadCount(user),
  ]);
  return json({ conversations, archivedUnread });
});

/** Open the chat with a friend, creating it if the friendship is new. */
export const POST = api(async (request) => {
  const { user } = await requireOnboarded();
  const { userId } = await parseJson(request, openChatSchema);
  await assertCanInteract(user.id, userId);
  return json({ conversationId: await ensureConversation(user.id, userId) });
});
