import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/empty-state";
import { chat } from "@/content/chat";

export const metadata: Metadata = { title: chat.title };

/** Desktop only: the right pane when no chat is open. On phones the list fills the screen. */
export default function ChatsIndexPage() {
  return (
    <div className="flex h-full items-center justify-center">
      <EmptyState
        artId="empty-chat"
        title={chat.noChatSelectedTitle}
        body={chat.noChatSelectedBody}
      />
    </div>
  );
}
