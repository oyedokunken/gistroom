import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquarePlus, Mic, Search, Sparkles } from "lucide-react";
import { LogoMark } from "@/components/brand/logo-mark";
import { chat } from "@/content/chat";

export const metadata: Metadata = { title: chat.title };

const BARS = [18, 34, 52, 30, 64, 42, 78, 48];

/** Desktop only: the right pane when no chat is open. On phones the list fills the screen. */
export default function ChatsIndexPage() {
  const cards = [
    { href: "/app/friends", label: chat.emptyPane.newChat, icon: MessageSquarePlus },
    { href: "/app/friends?tab=find", label: chat.emptyPane.findFriends, icon: Search },
    { href: "/app/rooms", label: chat.emptyPane.hostRoom, icon: Mic },
  ];
  return (
    <div className="flex h-full items-center justify-center overflow-y-auto bg-surface-2 p-8">
      <div className="flex w-full max-w-xl flex-col items-center gap-8 text-center">
        <div className="relative flex size-32 items-center justify-center rounded-hero bg-green-600 text-white shadow-lift">
          <LogoMark size={64} bubble="currentColor" className="text-white" />
          <span
            aria-hidden
            className="absolute -bottom-3 flex h-8 items-end gap-1 rounded-full bg-yellow-400 px-3 pb-1.5 pt-1"
          >
            {BARS.map((h, i) => (
              <span
                key={i}
                className="w-1 rounded-full bg-ink-950 motion-safe:animate-pulse"
                style={{ height: `${Math.max(6, h / 4)}px`, animationDelay: `${i * 120}ms` }}
              />
            ))}
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="text-3xl font-bold tracking-tight text-text">{chat.emptyPane.title}</h2>
          <p className="mx-auto max-w-md text-text-muted">{chat.emptyPane.body}</p>
        </div>
        <ul className="grid w-full gap-3 sm:grid-cols-3">
          {cards.map((c) => (
            <li key={c.href}>
              <Link
                href={c.href}
                className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-card bg-surface px-3 py-4 font-semibold text-text shadow-soft transition-transform hover:-translate-y-0.5"
              >
                <c.icon aria-hidden className="size-6 text-green-600" />
                {c.label}
              </Link>
            </li>
          ))}
        </ul>
        <ul className="flex flex-col gap-2 text-sm text-text-muted">
          {chat.emptyPane.tips.map((tip) => (
            <li key={tip} className="flex items-center justify-center gap-2">
              <Sparkles aria-hidden className="size-4 shrink-0 text-green-600" />
              {tip}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
