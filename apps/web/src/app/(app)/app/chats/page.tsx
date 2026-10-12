import type { Metadata } from "next";
import { AnimatedArt } from "@/components/public/animated-art";
import { chat } from "@/content/chat";

export const metadata: Metadata = { title: chat.title };

/** Desktop only: the right pane when no chat is open. On phones the list fills the screen. */
export default function ChatsIndexPage() {
  return (
    <div className="flex h-full items-center justify-center overflow-y-auto bg-surface-2 p-8">
      <div className="flex w-full max-w-md flex-col items-center gap-5 text-center">
        <AnimatedArt
          id="scene-barbershop"
          alt={chat.emptyPane.alt}
          width={1000}
          height={800}
          sizes="(max-width: 1024px) 60vw, 28rem"
          className="h-auto w-full max-w-[22rem] rounded-card"
        />
        <h2 className="text-2xl font-bold tracking-tight text-text">{chat.emptyPane.title}</h2>
        <p className="text-text-muted">{chat.emptyPane.body}</p>
      </div>
    </div>
  );
}
