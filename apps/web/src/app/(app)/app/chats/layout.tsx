import type { ReactNode } from "react";
import { ChatsShell } from "@/components/chat/chats-shell";
import { requireUserForPage } from "@/server/auth/page";

export default async function ChatsLayout({ children }: { children: ReactNode }) {
  const { user } = await requireUserForPage();
  return <ChatsShell viewerId={user.id}>{children}</ChatsShell>;
}
