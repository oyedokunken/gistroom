"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, BellOff, ChevronLeft, MoreVertical, Trash2, UserX } from "lucide-react";
import { receiptStatus, type ConversationDto, type MessageDto } from "@gistroom/shared";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownContent,
  DropdownItem,
  DropdownMenu,
  DropdownSeparator,
  DropdownTrigger,
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { Skeleton } from "@/components/ui/skeleton";
import { chat } from "@/content/chat";
import { ApiClientError, apiFetch } from "@/lib/api";
import { upsertMessage, flattenOldestFirst, type CachedMessages } from "@/lib/chat/cache";
import { keys, useMessages } from "@/lib/chat/hooks";
import { useOutbox } from "@/lib/chat/outbox-store";
import { buildRows, type Row } from "@/lib/chat/rows";
import { presenceLabel } from "@/lib/presence";
import { useRealtime } from "@/lib/realtime/provider";
import { useRealtimeStore } from "@/lib/realtime/store";
import { ChatBubble } from "./chat-bubble";
import { Composer } from "./composer";
import { MessageList } from "./message-list";

const DELETE_WINDOW_MS = 60 * 60_000;

function useConversation(id: string) {
  return useQuery({
    queryKey: ["conversation", id],
    queryFn: () => apiFetch<{ conversation: ConversationDto }>(`/api/conversations/${id}`),
  });
}

export function ThreadView({
  conversationId,
  viewerId,
}: {
  conversationId: string;
  viewerId: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const realtime = useRealtime();
  const { confirm, showError, showSuccess } = useFeedback();
  const conv = useConversation(conversationId);
  const messages = useMessages(conversationId);
  const outbox = useOutbox((s) => s.queue);
  const [replyTo, setReplyTo] = useState<{ id: string; name: string; text: string } | null>(null);

  const peer = conv.data?.conversation.peer;
  const presence = useRealtimeStore((s) => (peer ? s.presence[peer.id] : undefined));
  const peerTyping = useRealtimeStore((s) => (s.typing[conversationId] ?? []).length > 0);

  // Tell the store which chat is open, so arriving messages here count as read.
  useEffect(() => {
    useRealtimeStore.getState().setOpenConversation(conversationId);
    return () => useRealtimeStore.getState().setOpenConversation(null);
  }, [conversationId]);

  const flat = useMemo(
    () => flattenOldestFirst(messages.data as CachedMessages | undefined),
    [messages.data],
  );
  const mine = useMemo(
    () => outbox.filter((o) => o.conversationId === conversationId),
    [outbox, conversationId],
  );
  const rows = useMemo(
    () => buildRows({ messages: flat, outbox: mine, viewerId }),
    [flat, mine, viewerId],
  );

  // Read receipt for the newest message from the other person, once it is on screen and the tab is focused.
  const lastPeerMessage = useMemo(
    () => [...flat].reverse().find((m) => m.senderId !== viewerId),
    [flat, viewerId],
  );
  const acked = useRef<string | null>(null);
  useEffect(() => {
    if (!lastPeerMessage || acked.current === lastPeerMessage.id) return;
    if (document.visibilityState !== "visible") return;
    acked.current = lastPeerMessage.id;
    realtime.ack(conversationId, lastPeerMessage.id, "read");
    queryClient.setQueriesData<{ conversations: ConversationDto[]; archivedUnread: number }>(
      { queryKey: ["conversations"] },
      (data) =>
        data && {
          ...data,
          conversations: data.conversations.map((c) =>
            c.id === conversationId ? { ...c, unread: 0 } : c,
          ),
        },
    );
    void queryClient.invalidateQueries({ queryKey: ["unread"] });
  }, [lastPeerMessage, conversationId, realtime, queryClient]);

  const peerInfo = messages.data?.pages[0]?.peer;
  const receiptFor = useCallback(
    (m: MessageDto) =>
      m.senderId === viewerId && peerInfo
        ? receiptStatus({
            messageCreatedAt: new Date(m.createdAt),
            peerDeliveredAt: peerInfo.deliveredAt ? new Date(peerInfo.deliveredAt) : null,
            peerReadAt: peerInfo.readAt ? new Date(peerInfo.readAt) : null,
            peerSendsReadReceipts: peerInfo.sendsReadReceipts,
          })
        : null,
    [peerInfo, viewerId],
  );

  const replace = useCallback(
    (message: MessageDto) =>
      queryClient.setQueryData<CachedMessages>(keys.messages(conversationId), (c) =>
        upsertMessage(c, message),
      ),
    [queryClient, conversationId],
  );

  const star = useMutation({
    mutationFn: (m: MessageDto) =>
      apiFetch<{ message: MessageDto }>(`/api/messages/${m.id}/star`, { body: { on: !m.starred } }),
    onSuccess: (r) => replace(r.message),
    onError: (e) => e instanceof ApiClientError && showError(e.message),
  });
  const react = useMutation({
    mutationFn: ({ m, emoji }: { m: MessageDto; emoji: string }) =>
      apiFetch<{ message: MessageDto }>(`/api/messages/${m.id}/reactions`, { body: { emoji } }),
    onSuccess: (r) => replace(r.message),
    onError: (e) => e instanceof ApiClientError && showError(e.message),
  });

  async function deleteMe(m: MessageDto) {
    const ok = await confirm({
      title: chat.deleteMeTitle,
      message: chat.deleteMeBody,
      confirmLabel: chat.deleteConfirm,
      destructive: true,
    });
    if (!ok) return;
    try {
      await apiFetch(`/api/messages/${m.id}?scope=me`, { method: "DELETE", body: {} });
      queryClient.setQueryData<CachedMessages>(
        keys.messages(conversationId),
        (c) =>
          c && {
            ...c,
            pages: c.pages.map((p) => ({ ...p, items: p.items.filter((x) => x.id !== m.id) })),
          },
      );
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    } catch (e) {
      if (e instanceof ApiClientError) showError(e.message);
      else throw e;
    }
  }

  async function deleteEveryone(m: MessageDto) {
    const ok = await confirm({
      title: chat.deleteEveryoneTitle,
      message: chat.deleteEveryoneBody,
      confirmLabel: chat.deleteConfirm,
      destructive: true,
    });
    if (!ok) return;
    try {
      const res = await apiFetch<{ message: MessageDto }>(`/api/messages/${m.id}?scope=everyone`, {
        method: "DELETE",
        body: {},
      });
      replace(res.message);
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    } catch (e) {
      if (e instanceof ApiClientError) showError(e.message);
      else throw e;
    }
  }

  async function copy(m: MessageDto) {
    try {
      await navigator.clipboard.writeText(m.body ?? "");
      showSuccess(chat.actions.copied);
    } catch {
      showError(chat.loadError);
    }
  }

  const patch = useMutation({
    mutationFn: (body: { archived?: boolean; muteMinutes?: number }) =>
      apiFetch(`/api/conversations/${conversationId}`, { method: "PATCH", body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      void queryClient.invalidateQueries({ queryKey: ["conversation", conversationId] });
    },
  });

  async function clearChat() {
    const ok = await confirm({
      title: chat.conversation.clearTitle,
      message: chat.conversation.clearBody,
      confirmLabel: chat.conversation.clearConfirm,
      destructive: true,
    });
    if (!ok) return;
    await apiFetch(`/api/conversations/${conversationId}`, { method: "DELETE", body: {} });
    void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    router.replace("/app/chats");
  }

  async function blockPeer() {
    if (!peer) return;
    const ok = await confirm({
      title: chat.conversation.blockTitle(peer.name),
      message: chat.conversation.blockBody,
      confirmLabel: chat.conversation.blockConfirm,
      destructive: true,
    });
    if (!ok) return;
    try {
      await apiFetch("/api/blocks", { body: { userId: peer.id } });
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      void queryClient.invalidateQueries({ queryKey: ["friends"] });
      router.replace("/app/chats");
    } catch (e) {
      if (e instanceof ApiClientError) showError(e.message);
      else throw e;
    }
  }

  const status = peerTyping ? `${chat.typing}...` : presenceLabel(presence);
  const loadError =
    conv.isError && conv.error instanceof ApiClientError && conv.error.status === 404;

  function renderMessage(row: Extract<Row, { kind: "message" }>) {
    const m = row.message;
    const canDeleteEveryone =
      row.mine &&
      !row.pending &&
      !m.deletedForEveryone &&
      Date.now() - new Date(m.createdAt).getTime() < DELETE_WINDOW_MS;
    return (
      <ChatBubble
        row={row}
        receipt={receiptFor(m)}
        peerName={peer?.name ?? ""}
        canDeleteEveryone={canDeleteEveryone}
        actions={{
          onReply: () =>
            setReplyTo({
              id: m.id,
              name: row.mine ? chat.you : (peer?.name ?? ""),
              text: m.body ?? "",
            }),
          onCopy: () => void copy(m),
          onStar: () => star.mutate(m),
          onReact: (emoji) => react.mutate({ m, emoji }),
          onDeleteMe: () => void deleteMe(m),
          onDeleteEveryone: () => void deleteEveryone(m),
          onRetry: () => useOutbox.getState().retry(conversationId),
        }}
      />
    );
  }

  if (loadError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-text-muted">{chat.cannotMessage}</p>
        <Link
          href="/app/chats"
          className="font-semibold text-green-700 underline-offset-4 hover:underline"
        >
          {chat.back}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex min-h-16 items-center gap-2 border-b border-border px-2 py-2 md:px-4">
        <Link
          href="/app/chats"
          aria-label={chat.back}
          className="flex size-11 items-center justify-center rounded-full text-text hover:bg-surface-2 md:hidden"
        >
          <ChevronLeft aria-hidden className="size-6" />
        </Link>
        {peer ? (
          <Link href={`/app/u/${peer.username}`} className="flex min-w-0 flex-1 items-center gap-3">
            <Avatar name={peer.name} src={peer.avatarUrl} size={40} online={presence?.online} />
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-semibold text-text">{peer.name}</span>
              <span
                role="status"
                aria-live="polite"
                className={`truncate text-sm ${peerTyping ? "font-medium text-green-700" : "text-text-muted"}`}
              >
                {status ?? `@${peer.username}`}
              </span>
            </span>
          </Link>
        ) : (
          <div className="flex flex-1 items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <Skeleton className="h-4 w-32" />
          </div>
        )}
        <DropdownMenu>
          <DropdownTrigger asChild>
            <IconButton label={chat.conversation.menu}>
              <MoreVertical aria-hidden className="size-5" />
            </IconButton>
          </DropdownTrigger>
          <DropdownContent>
            <DropdownItem
              icon={Archive}
              onSelect={() => patch.mutate({ archived: !conv.data?.conversation.archived })}
            >
              {conv.data?.conversation.archived
                ? chat.conversation.unarchive
                : chat.conversation.archive}
            </DropdownItem>
            <DropdownItem
              icon={BellOff}
              onSelect={() =>
                patch.mutate({ muteMinutes: conv.data?.conversation.muted ? 0 : 8 * 60 })
              }
            >
              {conv.data?.conversation.muted ? chat.conversation.unmute : chat.conversation.mute}
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem icon={Trash2} danger onSelect={() => void clearChat()}>
              {chat.conversation.clear}
            </DropdownItem>
            <DropdownItem icon={UserX} danger onSelect={() => void blockPeer()}>
              {chat.conversation.block}
            </DropdownItem>
          </DropdownContent>
        </DropdownMenu>
      </header>

      {messages.isPending ? (
        <div className="flex flex-1 flex-col justify-end gap-3 p-4">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className={`h-11 ${i % 2 ? "w-2/3 self-end" : "w-1/2"}`} />
          ))}
        </div>
      ) : messages.isError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="text-text-muted">{chat.loadError}</p>
          <button
            type="button"
            onClick={() => void messages.refetch()}
            className="font-semibold text-green-700 underline-offset-4 hover:underline"
          >
            {chat.retry}
          </button>
        </div>
      ) : (
        <MessageList
          scrollKey={conversationId}
          rows={rows}
          renderMessage={renderMessage}
          hasOlder={Boolean(messages.hasNextPage)}
          loadingOlder={messages.isFetchingNextPage}
          onLoadOlder={() => void messages.fetchNextPage()}
          header={
            !messages.hasNextPage ? (
              <p className="py-4 text-center text-sm text-text-muted">
                {flat.length === 0 && peer ? chat.startOfChatNew(peer.name) : chat.startOfChat}
              </p>
            ) : null
          }
        />
      )}

      <Composer
        conversationId={conversationId}
        replyingTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        onSend={(text) => {
          useOutbox.getState().add({ conversationId, body: text, replyToId: replyTo?.id ?? null });
          setReplyTo(null);
        }}
      />
    </div>
  );
}
