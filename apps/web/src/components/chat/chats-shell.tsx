"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ConversationList } from "./conversation-list";
import { cn } from "@/lib/cn";
import { useFab } from "@/lib/fab";

/** Two panes on desktop (list and thread). One pane on phones: the list, or the open thread. */
export function ChatsShell({ viewerId, children }: { viewerId: string; children: ReactNode }) {
  const pathname = usePathname();
  useFab("chats");
  const open = pathname !== "/app/chats";
  return (
    <div className="flex h-[calc(100dvh-3.25rem-4.5rem)] min-h-0 md:h-[calc(100dvh-3.5rem)]">
      <section
        aria-label="Chats"
        className={cn(
          "min-h-0 w-full shrink-0 border-border md:w-[22rem] md:border-r lg:w-[24rem]",
          open && "hidden md:block",
        )}
      >
        <ConversationList viewerId={viewerId} />
      </section>
      <section className={cn("min-h-0 min-w-0 flex-1", !open && "hidden md:block")}>
        {children}
      </section>
    </div>
  );
}
