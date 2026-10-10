"use client";

import * as Menu from "@radix-ui/react-dropdown-menu";
import { motion } from "motion/react";
import { Copy, CornerUpLeft, Pencil, Star, Trash2, Trash } from "lucide-react";
import type { ReceiptStatus } from "@gistroom/shared";
import {
  DropdownContent,
  DropdownItem,
  DropdownMenu,
  DropdownSeparator,
  DropdownTrigger,
} from "@/components/ui/dropdown-menu";
import { ReceiptTicks } from "./receipt-ticks";
import { chat, QUICK_REACTIONS } from "@/content/chat";
import { cn } from "@/lib/cn";
import { formatClock, formatFull } from "@/lib/time";
import type { Row } from "@/lib/chat/rows";

/** How far a bubble is dragged to the right before it counts as a reply. */
export const SWIPE_REPLY_PX = 56;

export interface BubbleActions {
  onReply: () => void;
  onCopy: () => void;
  onStar: () => void;
  onReact: (emoji: string) => void;
  onEdit: () => void;
  onDeleteMe: () => void;
  onDeleteEveryone: () => void;
  onRetry: () => void;
}

export interface ChatBubbleProps {
  row: Extract<Row, { kind: "message" }>;
  receipt: ReceiptStatus | null;
  peerName: string;
  canDeleteEveryone: boolean;
  canEdit: boolean;
  actions: BubbleActions;
}

export function ChatBubble({
  row,
  receipt,
  peerName,
  canDeleteEveryone,
  canEdit,
  actions,
}: ChatBubbleProps) {
  const { message, mine, groupStart, groupEnd, pending } = row;
  const date = new Date(message.createdAt);
  const failed = pending?.status === "failed";
  const local = pending !== null;
  const status: ReceiptStatus | null = failed ? "FAILED" : local ? "SENDING" : receipt;

  const bubbleClass = cn(
    "relative max-w-[min(78%,34rem)] min-h-11 whitespace-pre-wrap break-words rounded-bubble px-3.5 py-2 text-left text-[0.9375rem] leading-snug",
    mine ? "bg-green-600 text-white" : "bg-surface-2 text-text",
    mine && groupEnd && "rounded-br-[4px]",
    !mine && groupEnd && "rounded-bl-[4px]",
    failed && "ring-2 ring-danger-600",
    message.deletedForEveryone && "italic opacity-80",
  );

  const body = message.deletedForEveryone ? chat.deletedMessage : (message.body ?? "");

  const content = (
    <>
      {message.replyPreview ? (
        <span
          className={cn(
            "mb-1.5 block rounded-lg border-l-4 px-2 py-1 text-sm",
            mine ? "border-white/60 bg-white/15" : "border-green-600 bg-surface",
          )}
        >
          <span className="block font-semibold">
            {message.replyPreview.senderId === message.senderId ? chat.you : peerName}
          </span>
          <span className="line-clamp-2 opacity-90">
            {message.replyPreview.body ?? chat.deletedMessage}
          </span>
        </span>
      ) : null}
      <span>{body}</span>
      <span className="mt-1 flex items-center justify-end gap-1.5 text-[0.6875rem] leading-none opacity-80">
        {message.editedAt ? <span>{chat.edit.label}</span> : null}
        {message.starred ? (
          <Star aria-label={chat.starredBadge} className="size-3 fill-current" />
        ) : null}
        <time dateTime={message.createdAt} title={formatFull(date)} className="tabular">
          {formatClock(date)}
        </time>
        {mine && status ? <ReceiptTicks status={status} /> : null}
      </span>
    </>
  );

  const swipeable = !failed && !local && !message.deletedForEveryone;

  return (
    <div className="relative">
      {swipeable ? (
        <CornerUpLeft
          aria-hidden
          className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-text-muted"
        />
      ) : null}
      <motion.div
        drag={swipeable ? "x" : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0, right: 0.4 }}
        dragSnapToOrigin
        onDragEnd={(_, info) => {
          if (info.offset.x > SWIPE_REPLY_PX) actions.onReply();
        }}
        aria-description={swipeable ? chat.swipeReply : undefined}
        className={cn(
          "relative flex w-full flex-col bg-transparent",
          mine ? "items-end" : "items-start",
          groupStart ? "mt-3" : "mt-0.5",
        )}
      >
        {failed ? (
          <button
            type="button"
            onClick={actions.onRetry}
            aria-label={chat.retryAria}
            className={bubbleClass}
          >
            {content}
            <span className="mt-1 block text-xs font-semibold">
              {chat.failedSend}. {chat.retrySend}
            </span>
          </button>
        ) : local || message.deletedForEveryone ? (
          <div className={bubbleClass}>{content}</div>
        ) : (
          <DropdownMenu>
            <DropdownTrigger asChild>
              <button
                type="button"
                aria-haspopup="menu"
                className={cn(bubbleClass, "cursor-pointer")}
              >
                {content}
              </button>
            </DropdownTrigger>
            <DropdownContent align={mine ? "end" : "start"}>
              <div
                role="group"
                aria-label={chat.reactionQuick}
                className="flex justify-between gap-1 px-1 py-1"
              >
                {QUICK_REACTIONS.map((emoji) => (
                  <Menu.Item
                    key={emoji}
                    onSelect={() => actions.onReact(emoji)}
                    className="flex size-11 cursor-pointer items-center justify-center rounded-full text-xl outline-none data-[highlighted]:bg-green-100"
                  >
                    {emoji}
                  </Menu.Item>
                ))}
              </div>
              <DropdownSeparator />
              <DropdownItem icon={CornerUpLeft} onSelect={actions.onReply}>
                {chat.actions.reply}
              </DropdownItem>
              {canEdit ? (
                <DropdownItem icon={Pencil} onSelect={actions.onEdit}>
                  {chat.edit.action}
                </DropdownItem>
              ) : null}
              <DropdownItem icon={Copy} onSelect={actions.onCopy}>
                {chat.actions.copy}
              </DropdownItem>
              <DropdownItem icon={Star} onSelect={actions.onStar}>
                {message.starred ? chat.actions.unstar : chat.actions.star}
              </DropdownItem>
              <DropdownSeparator />
              <DropdownItem icon={Trash} onSelect={actions.onDeleteMe} danger>
                {chat.actions.deleteForMe}
              </DropdownItem>
              {canDeleteEveryone ? (
                <DropdownItem icon={Trash2} onSelect={actions.onDeleteEveryone} danger>
                  {chat.actions.deleteForEveryone}
                </DropdownItem>
              ) : null}
            </DropdownContent>
          </DropdownMenu>
        )}
        {message.reactions.length > 0 && !message.deletedForEveryone ? (
          <div className={cn("-mt-1.5 flex gap-1", mine ? "mr-2" : "ml-2")}>
            {message.reactions.map((r) => (
              <button
                type="button"
                key={r.emoji}
                aria-pressed={r.mine}
                aria-label={chat.reactedBy(r.emoji, r.count)}
                onClick={() => actions.onReact(r.emoji)}
                className={cn(
                  "tabular inline-flex min-h-7 cursor-pointer items-center gap-1 rounded-full border px-2 text-sm",
                  r.mine
                    ? "border-green-600 bg-green-100 text-green-700"
                    : "border-border bg-surface text-text",
                )}
              >
                <span aria-hidden>{r.emoji}</span>
                {r.count}
              </button>
            ))}
          </div>
        ) : null}
      </motion.div>
    </div>
  );
}
