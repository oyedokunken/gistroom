"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, NotebookPen, Phone, Settings, Video } from "lucide-react";
import { LIMITS, receiptStatus, type ConversationDto, type MessageDto } from "@gistroom/shared";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { NotesPanel } from "@/components/notes/notes-panel";
import { IconButton } from "@/components/ui/icon-button";
import { Modal } from "@/components/ui/modal";
import { notes as notesCopy } from "@/content/notes";
import { Skeleton } from "@/components/ui/skeleton";
import { chat } from "@/content/chat";
import { ApiClientError, apiFetch } from "@/lib/api";
import { upsertMessage, flattenOldestFirst, type CachedMessages } from "@/lib/chat/cache";
import { startCallRequest } from "@/lib/calls/api";
import { keys, useMessages } from "@/lib/chat/hooks";
import { useOutbox } from "@/lib/chat/outbox-store";
import { toggleReactionLocal } from "@/lib/chat/reactions";
import { buildRows, type Row } from "@/lib/chat/rows";
import { presenceLabel, presenceOf } from "@/lib/presence";
import { useRealtime } from "@/lib/realtime/provider";
import { useRealtimeStore } from "@/lib/realtime/store";
import { CallRecord } from "./call-record";
import { AnniversaryCard } from "./anniversary-card";
import { ChatBubble } from "./chat-bubble";
import { ChatSettings, ReportDialog, StarredDialog } from "./chat-dialogs";
import { Composer } from "./composer";
import { session } from "@/content/session";
import { useOffline } from "@/lib/session/use-offline";
import { MessageList } from "./message-list";
import { PendingUploads } from "./uploads";
import { TypingBubble } from "./typing-bubble";

const DELETE_WINDOW_MS = LIMITS.DELETE_FOR_EVERYONE_WINDOW_MIN * 60_000;
const EDIT_WINDOW_MS = LIMITS.EDIT_WINDOW_MIN * 60_000;

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
  const offline = useOffline();
  const queryClient = useQueryClient();
  const realtime = useRealtime();
  const { confirm, showError, showInfo } = useFeedback();
  const conv = useConversation(conversationId);
  const messages = useMessages(conversationId);
  const outbox = useOutbox((s) => s.queue);
  const [replyTo, setReplyTo] = useState<{ id: string; name: string; text: string } | null>(null);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [starredOpen, setStarredOpen] = useState(false);

  const conversation = conv.data?.conversation;
  const peer = conversation?.peer;
  const availability = conversation?.availability ?? "OK";
  const livePresence = useRealtimeStore((s) => (peer ? s.presence[peer.id] : undefined));
  const presence = presenceOf(livePresence, conversation?.peerLastSeenAt);
  const peerTyping = useRealtimeStore((s) => (s.typing[conversationId] ?? []).length > 0);
  const live = availability === "OK";

  // Tell the store which chat is open, so arriving messages here count as read.
  useEffect(() => {
    useRealtimeStore.getState().setOpenConversation(conversationId);
    return () => useRealtimeStore.getState().setOpenConversation(null);
  }, [conversationId]);

  // Moving to another chat leaves any reply or edit behind.
  useEffect(() => {
    setReplyTo(null);
    setEditing(null);
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

  const failure = useCallback(
    (e: unknown) => showError(e instanceof ApiClientError ? e.message : chat.reactionFailed),
    [showError],
  );

  const star = useMutation({
    mutationFn: (m: MessageDto) =>
      apiFetch<{ message: MessageDto }>(`/api/messages/${m.id}/star`, { body: { on: !m.starred } }),
    onSuccess: (r) => {
      replace(r.message);
      void queryClient.invalidateQueries({ queryKey: ["starred"] });
    },
    onError: failure,
  });

  /** Optimistic: the chip changes at once, and goes back with a visible error if the server says no. */
  const react = useMutation({
    mutationFn: ({ m, emoji }: { m: MessageDto; emoji: string }) =>
      apiFetch<{ message: MessageDto }>(`/api/messages/${m.id}/reactions`, { body: { emoji } }),
    onMutate: ({ m, emoji }) => {
      replace({ ...m, reactions: toggleReactionLocal(m.reactions, emoji) });
    },
    onSuccess: (r) => replace(r.message),
    onError: (e, { m }) => {
      replace(m);
      failure(e);
    },
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
      failure(e);
    }
  }

  async function toggleArchive() {
    if (!conversation) return;
    if (!conversation.archived) {
      const ok = await confirm({
        title: chat.archiveConfirmTitle,
        message: chat.archiveConfirmBody,
        confirmLabel: chat.archiveConfirmLabel,
      });
      if (!ok) return;
    }
    patch.mutate({ archived: !conversation.archived });
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
      failure(e);
    }
  }

  async function copy(m: MessageDto) {
    try {
      await navigator.clipboard.writeText(m.body ?? "");
      showInfo(chat.actions.copied);
    } catch {
      showError(chat.loadError);
    }
  }

  async function saveEdit(text: string) {
    if (!editing) return;
    try {
      const res = await apiFetch<{ message: MessageDto }>(`/api/messages/${editing.id}`, {
        method: "PATCH",
        body: { body: text },
      });
      replace(res.message);
      setEditing(null);
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    } catch (e) {
      failure(e);
    }
  }

  const patch = useMutation({
    mutationFn: (body: { archived?: boolean; muteMinutes?: number }) =>
      apiFetch(`/api/conversations/${conversationId}`, { method: "PATCH", body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      void queryClient.invalidateQueries({ queryKey: ["conversation", conversationId] });
    },
    onError: failure,
  });

  async function clearChat() {
    const ok = await confirm({
      title: chat.conversation.clearTitle,
      message: chat.conversation.clearBody,
      confirmLabel: chat.conversation.clearConfirm,
      destructive: true,
    });
    if (!ok) return;
    try {
      await apiFetch(`/api/conversations/${conversationId}`, { method: "DELETE", body: {} });
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      router.replace("/app/chats");
    } catch (e) {
      failure(e);
    }
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
      void queryClient.invalidateQueries({ queryKey: ["conversation", conversationId] });
      void queryClient.invalidateQueries({ queryKey: ["friends"] });
    } catch (e) {
      failure(e);
    }
  }

  async function unblockPeer() {
    if (!peer) return;
    const ok = await confirm({
      title: chat.blockedByMe.unblockTitle(peer.name),
      message: chat.blockedByMe.unblockBody,
      confirmLabel: chat.blockedByMe.unblockConfirm,
    });
    if (!ok) return;
    try {
      await apiFetch(`/api/blocks/${peer.id}`, { method: "DELETE", body: {} });
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      void queryClient.invalidateQueries({ queryKey: ["conversation", conversationId] });
      void queryClient.invalidateQueries({ queryKey: ["friends"] });
    } catch (e) {
      failure(e);
    }
  }

  async function startCall(kind: "audio" | "video") {
    if (!peer) return;
    const video = kind === "video";
    const ok = await confirm({
      title: video
        ? chat.calls.confirmVideoTitle(peer.name)
        : chat.calls.confirmAudioTitle(peer.name),
      message: chat.calls.confirmBody,
      confirmLabel: video ? chat.calls.confirmVideo : chat.calls.confirmAudio,
    });
    if (!ok) return;
    try {
      const started = await startCallRequest(conversationId, video ? "VIDEO" : "AUDIO");
      router.push(`/app/call/${started.call.id}`);
    } catch (e) {
      failure(e);
    }
  }

  const status = !live ? null : peerTyping ? `${chat.typing}...` : presenceLabel(presence);
  const loadError =
    conv.isError && conv.error instanceof ApiClientError && conv.error.status === 404;

  function renderMessage(row: Extract<Row, { kind: "message" }>) {
    const m = row.message;
    const meta = m.meta as { kind?: string; years?: number } | null;
    if (m.type === "SYSTEM" && (m.meta as { kind?: string } | null)?.kind === "CALL") {
      return <CallRecord message={m} meId={viewerId} peerName={peer?.name ?? ""} />;
    }
    if (m.type === "SYSTEM" && meta?.kind === "FRIENDIVERSARY") {
      return <AnniversaryCard id={m.id} years={meta.years ?? 1} name={peer?.name ?? ""} />;
    }
    const age = Date.now() - new Date(m.createdAt).getTime();
    const settled = row.mine && !row.pending && !m.deletedForEveryone;
    return (
      <ChatBubble
        row={row}
        receipt={receiptFor(m)}
        peerName={peer?.name ?? ""}
        canDeleteEveryone={settled && age < DELETE_WINDOW_MS}
        canEdit={settled && live && m.type === "TEXT" && age < EDIT_WINDOW_MS}
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
          onEdit: () => {
            setReplyTo(null);
            setEditing({ id: m.id, text: m.body ?? "" });
          },
          onDeleteMe: () => void deleteMe(m),
          onDeleteEveryone: () => void deleteEveryone(m),
          onRetry: () => useOutbox.getState().retry(conversationId),
          onDiscard: () => useOutbox.getState().drop(m.clientId),
        }}
      />
    );
  }

  if (loadError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-text-muted">{chat.unavailable.title}</p>
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
      <header className="flex min-h-16 items-center gap-1 border-b border-border px-2 py-2 md:px-4">
        <Link
          href="/app/chats"
          aria-label={chat.back}
          className="flex size-11 items-center justify-center rounded-full text-text hover:bg-surface-2 md:hidden"
        >
          <ChevronLeft aria-hidden className="size-6" />
        </Link>
        {peer ? (
          <Link
            href={`/app/u/${peer.username}`}
            aria-label={`${chat.settings.profile}: ${peer.name}`}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-xl py-1"
          >
            <Avatar
              name={peer.name}
              src={live ? peer.avatarUrl : null}
              size={40}
              online={live ? presence?.online : undefined}
            />
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-semibold text-text">{peer.name}</span>
              <span
                role="status"
                aria-live="polite"
                className={`truncate text-sm ${peerTyping && live ? "font-medium text-green-700" : "text-text-muted"}`}
              >
                {availability === "UNAVAILABLE"
                  ? chat.unavailable.title
                  : availability === "BLOCKED_BY_ME"
                    ? chat.blockedByMe.title(peer.name)
                    : (status ?? `@${peer.username}`)}
              </span>
            </span>
          </Link>
        ) : (
          <div className="flex flex-1 items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <Skeleton className="h-4 w-32" />
          </div>
        )}
        {live ? (
          <>
            <IconButton
              label={chat.calls.audio}
              disabled={offline}
              title={offline ? session.needsConnection : undefined}
              onClick={() => void startCall("audio")}
            >
              <Phone aria-hidden className="size-5" />
            </IconButton>
            <IconButton
              label={chat.calls.video}
              disabled={offline}
              title={offline ? session.needsConnection : undefined}
              onClick={() => void startCall("video")}
            >
              <Video aria-hidden className="size-5" />
            </IconButton>
          </>
        ) : null}
        <IconButton
          label={notesCopy.open}
          onClick={() => setNotesOpen(true)}
          disabled={!conversation}
        >
          <NotebookPen aria-hidden className="size-5" />
        </IconButton>
        <IconButton
          label={chat.settings.open}
          onClick={() => setSettingsOpen(true)}
          disabled={!conversation}
        >
          <Settings aria-hidden className="size-5" />
        </IconButton>
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
          footer={
            <>
              <PendingUploads conversationId={conversationId} />
              {peerTyping && live && peer ? <TypingBubble name={peer.name} /> : null}
            </>
          }
        />
      )}

      {availability === "BLOCKED_BY_ME" && peer ? (
        <div className="flex flex-col items-center gap-2 border-t border-border bg-surface-2 px-4 py-4 text-center">
          <p className="font-semibold text-text">{chat.blockedByMe.title(peer.name)}</p>
          <p className="text-sm text-text-muted">{chat.blockedByMe.body}</p>
          <Button variant="secondary" onClick={() => void unblockPeer()}>
            {chat.blockedByMe.unblock}
          </Button>
        </div>
      ) : (
        <Composer
          conversationId={conversationId}
          disabled={availability === "UNAVAILABLE"}
          disabledReason={chat.unavailable.body}
          replyingTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          editing={editing}
          onSaveEdit={(text) => void saveEdit(text)}
          onCancelEdit={() => setEditing(null)}
          onUploaded={(m) => {
            replace(m);
            void queryClient.invalidateQueries({ queryKey: ["conversations"] });
          }}
          onSend={(text) => {
            useOutbox
              .getState()
              .add({ conversationId, body: text, replyToId: replyTo?.id ?? null });
            setReplyTo(null);
          }}
        />
      )}

      {conversation ? (
        <Modal
          open={notesOpen}
          onOpenChange={setNotesOpen}
          icon={NotebookPen}
          title={notesCopy.chatTitle}
          className="h-[min(80dvh,40rem)] w-[min(94vw,32rem)]"
        >
          <div className="-mx-6 -mb-6 flex h-[min(60dvh,28rem)] flex-col">
            <NotesPanel scope={{ conversationId: conversation.id }} />
          </div>
        </Modal>
      ) : null}

      {conversation ? (
        <ChatSettings
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          conversation={conversation}
          onToggleMute={() => patch.mutate({ muteMinutes: conversation.muted ? 0 : 8 * 60 })}
          onToggleArchive={() => void toggleArchive()}
          onStarred={() => setStarredOpen(true)}
          onReport={() => setReportOpen(true)}
          onBlock={() => void blockPeer()}
          onUnblock={() => void unblockPeer()}
          onClear={() => void clearChat()}
        />
      ) : null}
      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        conversationId={conversationId}
      />
      <StarredDialog
        open={starredOpen}
        onOpenChange={setStarredOpen}
        conversationId={conversationId}
      />
    </div>
  );
}
