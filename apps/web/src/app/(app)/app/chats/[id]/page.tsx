import type { Metadata } from "next";
import { ThreadView } from "@/components/chat/thread-view";
import { chat } from "@/content/chat";
import { requireUserForPage } from "@/server/auth/page";

export const metadata: Metadata = { title: chat.title };

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireUserForPage();
  const { id } = await params;
  return <ThreadView conversationId={id} viewerId={user.id} />;
}
