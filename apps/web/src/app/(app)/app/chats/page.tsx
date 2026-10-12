import type { Metadata } from "next";
import Image from "next/image";
import { chat } from "@/content/chat";

export const metadata: Metadata = { title: chat.title };

/** Desktop only: the right pane when no chat is open. On phones the list fills the screen. */
export default function ChatsIndexPage() {
  return (
    <div className="flex h-full items-center justify-center overflow-hidden bg-surface-2 p-8">
      <div className="flex w-full max-w-md flex-col items-center gap-4 text-center">
        <Image
          src="/images/fab/chat.png"
          alt=""
          width={112}
          height={112}
          className="size-28 object-contain"
        />
        <h2 className="text-2xl font-bold tracking-tight text-text">{chat.emptyPane.title}</h2>
        <p className="text-text-muted">{chat.emptyPane.body}</p>
      </div>
    </div>
  );
}
