"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { Archive, ChevronLeft, Search, UserPlus } from "lucide-react";
import { previewText, type ConversationDto } from "@gistroom/shared";
import { Avatar } from "@/components/ui/avatar";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { chat } from "@/content/chat";
import { useConversations } from "@/lib/chat/hooks";
import { cn } from "@/lib/cn";
import { useRealtimeStore } from "@/lib/realtime/store";
import { formatClock, formatDayLabel } from "@/lib/time";

function whenLabel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const day = formatDayLabel(d);
  return day === chat.today
    ? formatClock(d)
    : day === chat.yesterday
      ? chat.yesterday
      : new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short" }).format(d);
}

function Row({ c, viewerId, active }: { c: ConversationDto; viewerId: string; active: boolean }) {
  const online = useRealtimeStore((s) => s.presence[c.peer.id]?.online);
  const typing = useRealtimeStore((s) => (s.typing[c.id] ?? []).length > 0);
  const preview = c.lastMessage
    ? previewText({
        type: c.lastMessage.type,
        body: c.lastMessage.body,
        deletedForEveryone: c.lastMessage.deletedForEveryone,
        mine: c.lastMessage.senderId === viewerId,
      })
    : chat.startOfChatNew(c.peer.name);
  return (
    <li>
      <Link
        href={`/app/chats/${c.id}`}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-h-[4.5rem] items-center gap-3 px-3 py-2.5 md:px-4",
          active ? "bg-green-100" : "hover:bg-surface-2",
        )}
      >
        <Avatar
          name={c.peer.name}
          src={c.peer.avatarUrl}
          size={48}
          online={online === undefined ? undefined : online}
        />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-baseline justify-between gap-2">
            <span
              className={cn(
                "truncate text-base text-text",
                c.unread > 0 ? "font-bold" : "font-semibold",
              )}
            >
              {c.peer.name}
            </span>
            <span
              className={cn(
                "tabular shrink-0 text-xs",
                c.unread > 0 ? "font-semibold text-green-700" : "text-text-muted",
              )}
            >
              {whenLabel(c.lastMessageAt)}
            </span>
          </span>
          <span className="flex items-center justify-between gap-2">
            <span
              className={cn(
                "truncate text-sm",
                typing
                  ? "font-medium text-green-700"
                  : c.unread > 0
                    ? "text-text"
                    : "text-text-muted",
              )}
            >
              {typing ? `${chat.typing}...` : preview}
            </span>
            {c.unread > 0 ? (
              <span className="tabular flex min-w-6 shrink-0 items-center justify-center rounded-full bg-green-600 px-1.5 text-xs font-bold text-white">
                <span className="sr-only">Unread: </span>
                {c.unread > 99 ? "99+" : c.unread}
              </span>
            ) : null}
          </span>
        </span>
      </Link>
    </li>
  );
}

export function ConversationList({ viewerId }: { viewerId: string }) {
  const pathname = usePathname();
  const [showArchived, setShowArchived] = useState(false);
  const [query, setQuery] = useState("");
  const main = useConversations(false);
  const archived = useConversations(true);
  const active = showArchived ? archived : main;

  const rows = useMemo(() => {
    const all = active.data?.conversations ?? [];
    const q = query.trim().toLowerCase();
    return q
      ? all.filter((c) => c.peer.name.toLowerCase().includes(q) || c.peer.username.includes(q))
      : all;
  }, [active.data, query]);

  const archivedDot = (main.data?.archivedUnread ?? 0) > 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-col gap-3 border-b border-border p-3 md:p-4">
        <div className="flex items-center justify-between">
          {showArchived ? (
            <button
              type="button"
              onClick={() => setShowArchived(false)}
              className="inline-flex min-h-11 items-center gap-1 text-lg font-bold text-text"
            >
              <ChevronLeft aria-hidden className="size-5" />
              {chat.archivedRow}
            </button>
          ) : (
            <h1 className="text-2xl font-bold tracking-tight text-text">{chat.title}</h1>
          )}
          <Link
            href="/app/friends"
            aria-label={chat.newChat}
            className="flex size-11 items-center justify-center rounded-full text-text hover:bg-surface-2"
          >
            <UserPlus aria-hidden className="size-5" />
          </Link>
        </div>
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
          />
          <Input
            type="search"
            inputMode="search"
            aria-label={chat.searchLabel}
            placeholder={chat.searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="rounded-full pl-9"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!showArchived ? (
          <button
            type="button"
            onClick={() => setShowArchived(true)}
            className="flex min-h-12 w-full items-center gap-3 px-4 text-left text-sm font-semibold text-text hover:bg-surface-2"
          >
            <Archive aria-hidden className="size-4 text-text-muted" />
            {chat.archivedRow}
            {archivedDot ? (
              <span className="size-2 rounded-full bg-green-600">
                <span className="sr-only">New activity</span>
              </span>
            ) : null}
          </button>
        ) : null}

        {active.isPending ? (
          <div className="flex flex-col gap-3 p-4">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-12 rounded-full" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : active.isError ? (
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-text-muted">{chat.loadError}</p>
            <button
              type="button"
              onClick={() => void active.refetch()}
              className={buttonStyles("secondary")}
            >
              {chat.retry}
            </button>
          </div>
        ) : rows.length === 0 ? (
          query ? (
            <p className="p-8 text-center text-text-muted">{chat.noSearchResults}</p>
          ) : showArchived ? (
            <EmptyState
              artId="empty-archived"
              title={chat.archivedEmptyTitle}
              body={chat.archivedEmptyBody}
            />
          ) : (
            <EmptyState
              artId="empty-chat"
              title={chat.emptyListTitle}
              body={chat.emptyListBody}
              action={
                <Link href="/app/friends" className={buttonStyles("primary")}>
                  {chat.emptyListAction}
                </Link>
              }
            />
          )
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((c) => (
              <Row
                key={c.id}
                c={c}
                viewerId={viewerId}
                active={pathname === `/app/chats/${c.id}`}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
