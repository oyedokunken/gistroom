"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Forward, Search } from "lucide-react";
import {
  FORWARD_MAX_DESTINATIONS,
  type ConversationDto,
  type ForwardResult,
  type FriendDto,
} from "@gistroom/shared";
import { Avatar } from "@/components/ui/avatar";
import { Button, buttonStyles } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { chat } from "@/content/chat";
import { ApiClientError, apiFetch } from "@/lib/api";
import { cn } from "@/lib/cn";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messageIds: string[];
  /** Called after a send, so the thread can leave selection mode. */
  onDone: (result: ForwardResult) => void;
  /** The chat the messages came from. It is left out of the list. */
  fromConversationId: string;
}

/** Pick up to five friends, recent chats first, then forward. A retry of the same attempt never sends twice. */
export function ForwardModal({
  open,
  onOpenChange,
  messageIds,
  onDone,
  fromConversationId,
}: Props) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  // One id for this attempt. A second tap or a retry after a bad connection reuses it, so no copy is made twice.
  const batch = useRef<string | null>(null);

  const friends = useQuery({
    queryKey: ["friends"],
    queryFn: () => apiFetch<{ friends: FriendDto[] }>("/api/friends"),
    enabled: open,
  });
  const chats = useQuery({
    queryKey: ["conversations", "forward"],
    queryFn: () =>
      apiFetch<{ conversations: ConversationDto[] }>("/api/conversations").then(
        (r) => r.conversations,
      ),
    enabled: open,
  });

  const { recent, others } = useMemo(() => {
    const q = text.trim().toLowerCase();
    const all = (friends.data?.friends ?? []).filter(
      (f) =>
        !q || f.user.name.toLowerCase().includes(q) || f.user.username.toLowerCase().includes(q),
    );
    const order = new Map(
      (chats.data ?? [])
        .filter((c) => c.id !== fromConversationId)
        .map((c, i) => [c.peer.id, i] as const),
    );
    const recent = all
      .filter((f) => order.has(f.user.id))
      .sort((a, b) => (order.get(a.user.id) ?? 0) - (order.get(b.user.id) ?? 0))
      .slice(0, 5);
    const inRecent = new Set(recent.map((f) => f.user.id));
    return { recent, others: all.filter((f) => !inRecent.has(f.user.id)) };
  }, [friends.data, chats.data, text, fromConversationId]);

  function toggle(id: string) {
    setError(null);
    setPicked((p) => {
      if (p.includes(id)) return p.filter((x) => x !== id);
      if (p.length >= FORWARD_MAX_DESTINATIONS) {
        setNote(chat.forward.limit);
        return p;
      }
      setNote(null);
      return [...p, id];
    });
  }

  async function send() {
    if (picked.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    batch.current ??= `b${crypto.randomUUID().replaceAll("-", "")}`.slice(0, 36);
    try {
      const result = await apiFetch<ForwardResult>("/api/messages/forward", {
        body: { batchId: batch.current, messageIds, userIds: picked },
      });
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      const failed = result.outcomes.filter((o) => o.error);
      if (failed.length === result.outcomes.length) {
        setError(failed[0]?.error ?? chat.forward.failed);
        return;
      }
      batch.current = null;
      setPicked([]);
      onDone(result);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : chat.forward.failed);
    } finally {
      setBusy(false);
    }
  }

  const row = (f: FriendDto) => {
    const on = picked.includes(f.user.id);
    return (
      <li key={f.user.id}>
        <button
          type="button"
          role="checkbox"
          aria-checked={on}
          aria-label={chat.forward.pick(f.user.name)}
          onClick={() => toggle(f.user.id)}
          className="flex min-h-14 w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-surface-2"
        >
          <Avatar name={f.user.name} src={f.user.avatarUrl} size={40} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold text-text">{f.user.name}</span>
            <span className="block truncate text-sm text-text-muted">@{f.user.username}</span>
          </span>
          <span
            aria-hidden
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-full border-2",
              on
                ? "border-green-600 bg-green-600 text-white"
                : "border-border bg-surface text-transparent",
            )}
          >
            <Check className="size-4" />
          </span>
        </button>
      </li>
    );
  };

  const noFriends =
    !friends.isPending && !friends.isError && (friends.data?.friends.length ?? 0) === 0;

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
      icon={Forward}
      title={
        messageIds.length === 1 ? chat.forward.title : chat.forward.titleMany(messageIds.length)
      }
      description={chat.forward.body}
      footer={
        <Button
          loading={busy}
          disabled={picked.length === 0}
          onClick={() => void send()}
          className="w-full"
        >
          {busy ? chat.forward.sending : chat.forward.send(picked.length)}
        </Button>
      }
    >
      <div className="flex w-full flex-col gap-3">
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-text-muted"
          />
          <Input
            type="text"
            inputMode="search"
            aria-label={chat.forward.search}
            placeholder={chat.forward.search}
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoComplete="off"
            className="rounded-full pl-11"
          />
        </div>
        {note ? (
          <p role="status" className="text-sm text-text-muted">
            {note}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm font-medium text-danger-600">
            {error}
          </p>
        ) : null}
        {friends.isPending ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : friends.isError ? (
          <div className="flex flex-col items-center gap-2 py-4">
            <p className="text-text-muted">{chat.forward.loadError}</p>
            <Button variant="secondary" onClick={() => void friends.refetch()}>
              {chat.forward.retry}
            </Button>
          </div>
        ) : noFriends ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <p className="text-text-muted">{chat.forward.noFriends}</p>
            <Link
              href="/app/friends?tab=find"
              onClick={() => onOpenChange(false)}
              className={buttonStyles("primary")}
            >
              {chat.forward.findFriends}
            </Link>
          </div>
        ) : recent.length + others.length === 0 ? (
          <p className="py-4 text-center text-text-muted">{chat.forward.none}</p>
        ) : (
          <div className="-mx-2 flex max-h-[45dvh] flex-col overflow-y-auto text-left">
            {recent.length > 0 ? (
              <>
                <h3 className="px-2 pb-1 pt-2 text-sm font-semibold text-text-muted">
                  {chat.forward.recent}
                </h3>
                <ul>{recent.map(row)}</ul>
              </>
            ) : null}
            {others.length > 0 ? (
              <>
                <h3 className="px-2 pb-1 pt-2 text-sm font-semibold text-text-muted">
                  {chat.forward.friends}
                </h3>
                <ul>{others.map(row)}</ul>
              </>
            ) : null}
          </div>
        )}
      </div>
    </Modal>
  );
}
