"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, MailOpen, MoreVertical, Trash2 } from "lucide-react";
import type { NotificationDto, Page } from "@gistroom/shared";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownContent,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { Skeleton } from "@/components/ui/skeleton";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { notices } from "@/content/app";
import { pushCopy, notificationCopy } from "@gistroom/shared";
import { ApiClientError, apiFetch } from "@/lib/api";
import { formatRelative } from "@/lib/time";
import { cn } from "@/lib/cn";

function Item({ n, onChange }: { n: NotificationDto; onChange: () => void }) {
  const { showError } = useFeedback();
  const copy = notificationCopy(n.type, n.payload, n.id);
  const unread = n.readAt === null;

  async function call(fn: () => Promise<unknown>) {
    try {
      await fn();
      onChange();
    } catch (e) {
      if (e instanceof ApiClientError) showError(e.message);
      else throw e;
    }
  }

  return (
    <li className={cn("flex items-start gap-1 px-2 py-1", unread && "bg-green-100/60")}>
      <Link
        href={n.href}
        onClick={() => {
          if (unread)
            void apiFetch("/api/notifications/read", { body: { ids: [n.id] } })
              .then(onChange)
              .catch(() => undefined);
        }}
        className="flex min-h-14 min-w-0 flex-1 items-start gap-3 rounded-2xl px-2 py-2 hover:bg-surface-2"
      >
        <span className="mt-1 flex size-10 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">
          <Bell aria-hidden className="size-5" />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="flex items-center gap-2">
            <span className={cn("truncate text-text", unread ? "font-bold" : "font-semibold")}>
              {copy.title || pushCopy.genericTitle}
            </span>
            {unread ? (
              <span className="size-2 shrink-0 rounded-full bg-green-600">
                <span className="sr-only">{notices.unreadDot}</span>
              </span>
            ) : null}
          </span>
          <span className="line-clamp-2 text-sm text-text-muted">{copy.body}</span>
          <time dateTime={n.createdAt} className="mt-0.5 text-xs text-text-muted">
            {formatRelative(new Date(n.createdAt))}
          </time>
        </span>
      </Link>
      <DropdownMenu>
        <DropdownTrigger asChild>
          <IconButton label={notices.more}>
            <MoreVertical aria-hidden className="size-5" />
          </IconButton>
        </DropdownTrigger>
        <DropdownContent>
          {unread ? (
            <DropdownItem
              icon={MailOpen}
              onSelect={() =>
                void call(() => apiFetch("/api/notifications/read", { body: { ids: [n.id] } }))
              }
            >
              {notices.markRead}
            </DropdownItem>
          ) : (
            <DropdownItem
              icon={Bell}
              onSelect={() =>
                void call(() => apiFetch("/api/notifications/unread", { body: { ids: [n.id] } }))
              }
            >
              {notices.markUnread}
            </DropdownItem>
          )}
          <DropdownItem
            icon={Trash2}
            danger
            onSelect={() =>
              void call(() =>
                apiFetch(`/api/notifications/${n.id}`, { method: "DELETE", body: {} }),
              )
            }
          >
            {notices.remove}
          </DropdownItem>
        </DropdownContent>
      </DropdownMenu>
    </li>
  );
}

export function NotificationsList() {
  const queryClient = useQueryClient();
  const { confirm } = useFeedback();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const q = useInfiniteQuery({
    queryKey: ["notifications", filter === "unread"],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      apiFetch<Page<NotificationDto>>(
        `/api/notifications?${filter === "unread" ? "unread=1&" : ""}${pageParam ? `cursor=${encodeURIComponent(pageParam)}` : ""}`,
      ),
    getNextPageParam: (last) => last.nextCursor,
  });
  const items = useMemo(() => q.data?.pages.flatMap((p) => p.items) ?? [], [q.data]);
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    void queryClient.invalidateQueries({ queryKey: ["unread"] });
  };

  async function clearAll() {
    const ok = await confirm({
      title: notices.clearTitle,
      message: notices.clearBody,
      confirmLabel: notices.clearConfirm,
      destructive: true,
    });
    if (!ok) return;
    await apiFetch("/api/notifications", { method: "DELETE", body: {} });
    refresh();
  }

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <SegmentedTabs
          label={notices.filterLabel}
          value={filter}
          onChange={(v) => setFilter(v as "all" | "unread")}
          options={[
            { value: "all", label: notices.all },
            { value: "unread", label: notices.unread },
          ]}
        />
        <div className="flex gap-2">
          <Button
            variant="ghost"
            className="border border-border"
            icon={<CheckCheck aria-hidden className="size-4" />}
            onClick={async () => {
              await apiFetch("/api/notifications/read", { body: { all: true } });
              refresh();
            }}
          >
            {notices.markAllRead}
          </Button>
          <Button variant="ghost" className="border border-border" onClick={() => void clearAll()}>
            {notices.clearAll}
          </Button>
        </div>
      </div>

      {q.isPending ? (
        <div className="flex flex-col gap-3 p-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : q.isError ? (
        <div className="flex flex-col items-center gap-3 p-8 text-center">
          <p className="text-text-muted">{notices.loadError}</p>
          <Button variant="secondary" onClick={() => void q.refetch()}>
            {notices.retry}
          </Button>
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon="alerts"
          title={filter === "unread" ? notices.emptyUnread : notices.emptyAll}
        />
      ) : (
        <>
          <ul className="divide-y divide-border">
            {items.map((n) => (
              <Item key={n.id} n={n} onChange={refresh} />
            ))}
          </ul>
          {q.hasNextPage ? (
            <div className="flex justify-center p-4">
              <Button
                variant="secondary"
                loading={q.isFetchingNextPage}
                onClick={() => void q.fetchNextPage()}
              >
                {notices.loadMore}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
