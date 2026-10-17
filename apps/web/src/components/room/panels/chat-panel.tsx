"use client";

import { useEffect, useRef, useState } from "react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, SmilePlus, Pencil, Trash2 } from "lucide-react";
import {
  LIMITS,
  REACTIONS,
  canDo,
  type RoomChatDto,
  type RoomDto,
  type RoomRole,
} from "@gistroom/shared";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { EmojiButton } from "@/components/chat/emoji-button";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownContent, DropdownMenu, DropdownTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Skeleton } from "@/components/ui/skeleton";
import { roomCopy as copy } from "@/content/rooms";
import { cn } from "@/lib/cn";
import { roomApi } from "@/lib/rooms/api";
import { formatClock, formatFull } from "@/lib/time";
import { RoleBadge, fail } from "./shared";

// ---------- Chat ----------

function ReactionPicker({ onPick }: { onPick: (emoji: string) => void }) {
  return (
    <DropdownMenu>
      <DropdownTrigger asChild>
        <IconButton label={copy.chat.react} className="size-9">
          <SmilePlus aria-hidden className="size-4" />
        </IconButton>
      </DropdownTrigger>
      <DropdownContent align="end">
        <div role="group" aria-label={copy.chat.react} className="grid grid-cols-5 gap-1 p-1">
          {REACTIONS.map((r) => (
            <Menu.Item
              key={r.id}
              aria-label={r.label}
              onSelect={() => onPick(r.emoji)}
              className="flex size-11 cursor-pointer items-center justify-center rounded-full text-xl outline-none data-[highlighted]:bg-green-100"
            >
              {r.emoji}
            </Menu.Item>
          ))}
        </div>
      </DropdownContent>
    </DropdownMenu>
  );
}

export function ChatPanel({ room, meId, role }: { room: RoomDto; meId: string; role: RoomRole }) {
  const { confirm, showError } = useFeedback();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const chat = useQuery({
    queryKey: ["room-chat", room.slug],
    queryFn: () => roomApi.chat(room.slug),
  });
  const items = [...(chat.data?.items ?? [])].reverse();
  const mode = room.settings.chatMode;
  const privileged = canDo(role, "DELETE_MESSAGE");
  const closed = mode === "OFF" || (mode === "MODERATORS" && !privileged);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [items.length]);

  const send = useMutation({
    mutationFn: (body: string) => roomApi.say(room.slug, crypto.randomUUID(), body),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["room-chat", room.slug] }),
    onError: (e) => showError(fail(e)),
  });

  const react = useMutation({
    mutationFn: (v: { id: string; emoji: string }) => roomApi.react(room.slug, v.emoji, v.id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["room-chat", room.slug] }),
    onError: (e) => showError(fail(e)),
  });

  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const edit = useMutation({
    mutationFn: (v: { id: string; body: string }) => roomApi.editMessage(room.slug, v.id, v.body),
    onSuccess: () => {
      setEditing(null);
      void queryClient.invalidateQueries({ queryKey: ["room-chat", room.slug] });
    },
    onError: (e) => showError(fail(e)),
  });

  async function remove(m: RoomChatDto) {
    const ok = await confirm({
      title: copy.chat.deleteTitle,
      message: copy.chat.deleteBody,
      confirmLabel: copy.chat.delete,
      destructive: true,
    });
    if (!ok) return;
    try {
      await roomApi.deleteMessage(room.slug, m.id);
      void queryClient.invalidateQueries({ queryKey: ["room-chat", room.slug] });
    } catch (e) {
      showError(fail(e));
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ul
        role="log"
        aria-live="polite"
        aria-label={copy.panels.chat}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4"
      >
        {chat.isPending ? (
          <Skeleton className="h-12" />
        ) : chat.isError ? (
          <p className="text-text-muted">{copy.chat.loadError}</p>
        ) : items.length === 0 ? (
          <p className="text-text-muted">{copy.chat.empty}</p>
        ) : (
          items.map((m) => {
            const own = m.sender.id === meId;
            return (
              <li key={m.id} className="group flex items-start gap-2">
                <Avatar name={m.sender.name} src={m.sender.avatarUrl} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                    <span className="truncate font-semibold text-text">
                      {own ? copy.stage.you : m.sender.name}
                    </span>
                    <RoleBadge role={m.senderRole} />
                    <time
                      dateTime={m.createdAt}
                      title={formatFull(new Date(m.createdAt))}
                      className="tabular text-xs text-text-muted"
                    >
                      {formatClock(new Date(m.createdAt))}
                    </time>
                  </p>
                  {m.deleted ? (
                    <p className="italic text-text-muted">
                      {m.deleted === "BY_ME" ? copy.chat.youDeleted : copy.chat.wasDeleted}
                    </p>
                  ) : editing?.id === m.id ? (
                    <form
                      noValidate
                      onSubmit={(e) => {
                        e.preventDefault();
                        const body = editing.text.trim();
                        if (body) edit.mutate({ id: m.id, body });
                      }}
                      className="flex items-center gap-1"
                    >
                      <Input
                        aria-label={copy.chat.edit}
                        value={editing.text}
                        ref={(el) => el?.focus()}
                        onChange={(e) => setEditing({ id: m.id, text: e.target.value })}
                        className="rounded-full"
                      />
                      <Button type="submit" loading={edit.isPending} className="min-h-11 px-4">
                        {copy.chat.editSave}
                      </Button>
                      <Button
                        variant="secondary"
                        className="min-h-11 px-4"
                        onClick={() => setEditing(null)}
                      >
                        {copy.chat.editCancel}
                      </Button>
                    </form>
                  ) : (
                    <p className="whitespace-pre-wrap break-words text-text">
                      {m.body}
                      {m.editedAt ? (
                        <span
                          title={formatFull(new Date(m.editedAt))}
                          className="ml-2 text-xs text-text-muted"
                        >
                          {copy.chat.edited}
                        </span>
                      ) : null}
                    </p>
                  )}
                  {!m.deleted && m.reactions.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {m.reactions.map((r) => (
                        <button
                          type="button"
                          key={r.emoji}
                          aria-pressed={r.mine}
                          onClick={() => react.mutate({ id: m.id, emoji: r.emoji })}
                          className={cn(
                            "tabular inline-flex min-h-7 items-center gap-1 rounded-full border bg-surface px-2 text-sm text-text",
                            r.mine ? "border-2 border-green-600" : "border-border",
                          )}
                        >
                          <span>{r.emoji}</span>
                          {r.count > 1 ? <span>{r.count}</span> : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <span className="flex shrink-0 items-center">
                  {!m.deleted && room.settings.reactionsOn ? (
                    <ReactionPicker onPick={(emoji) => react.mutate({ id: m.id, emoji })} />
                  ) : null}
                  {own &&
                  !m.deleted &&
                  Date.now() - new Date(m.createdAt).getTime() <=
                    LIMITS.EDIT_WINDOW_MIN * 60_000 ? (
                    <IconButton
                      label={copy.chat.edit}
                      onClick={() => setEditing({ id: m.id, text: m.body })}
                      className="size-9"
                    >
                      <Pencil aria-hidden className="size-4" />
                    </IconButton>
                  ) : null}
                  {!m.deleted && (own || privileged) ? (
                    <IconButton
                      label={copy.chat.delete}
                      onClick={() => void remove(m)}
                      className="size-9"
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </IconButton>
                  ) : null}
                </span>
              </li>
            );
          })
        )}
        <div ref={end} />
      </ul>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const body = text.trim();
          if (!body || closed) return;
          setText("");
          send.mutate(body);
        }}
        className="border-t border-border p-3"
      >
        <p className="mb-2 text-xs text-text-muted">
          {mode === "OFF"
            ? copy.chat.closedOff
            : closed
              ? copy.chat.closedModerators
              : room.settings.slowModeSec > 0 && !privileged
                ? copy.chat.slow(room.settings.slowModeSec)
                : copy.chat.note}
        </p>
        <div className="flex items-center gap-1">
          <EmojiButton onPick={(emoji) => setText((t) => t + emoji)} />
          <Input
            aria-label={copy.chat.label}
            placeholder={copy.chat.placeholder}
            value={text}
            disabled={closed}
            onChange={(e) => setText(e.target.value)}
            className="rounded-full"
          />
          <IconButton
            type="submit"
            label={copy.chat.send}
            disabled={!text.trim() || closed}
            className="bg-green-600 text-white hover:bg-green-700"
          >
            <Send aria-hidden className="size-5" />
          </IconButton>
        </div>
      </form>
    </div>
  );
}
