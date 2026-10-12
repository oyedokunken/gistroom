"use client";

import * as Menu from "@radix-ui/react-dropdown-menu";
import { motion } from "motion/react";
import {
  ChevronDown,
  Copy,
  CornerUpLeft,
  Pencil,
  SmilePlus,
  Star,
  Trash2,
  Trash,
} from "lucide-react";
import { useState } from "react";
import type { ReceiptStatus } from "@gistroom/shared";
import {
  DropdownContent,
  DropdownItem,
  DropdownMenu,
  DropdownSeparator,
  DropdownTrigger,
} from "@/components/ui/dropdown-menu";
import { AttachmentView } from "./attachment-views";
import { RoomInviteCard } from "./room-invite-card";
import { MoreReactions } from "./more-reactions";
import { ReactionChips } from "./reaction-chips";
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
  /** Throw away a message that never went out. */
  onDiscard: () => void;
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
  const [moreOpen, setMoreOpen] = useState(false);
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
    // The actions chevron sits in the top corner, so a voice note leaves room above it.
    message.type === "VOICE" && !message.deletedForEveryone && "pt-8",
  );

  const body = message.deletedForEveryone
    ? mine
      ? chat.youDeletedMessage
      : chat.deletedMessage
    : (message.body ?? "");
  const hasMedia = !message.deletedForEveryone && message.attachments.length > 0;

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
      {message.type === "ROOM_INVITE" && !message.deletedForEveryone ? (
        <RoomInviteCard message={message} mine={mine} />
      ) : null}
      {hasMedia ? <AttachmentView message={message} mine={mine} /> : null}
      {message.type === "ROOM_INVITE" && !message.deletedForEveryone ? null : !hasMedia || body ? (
        <span className={cn(hasMedia && "mt-1.5 block")}>{body}</span>
      ) : null}
      <span className="mt-1 flex items-center justify-end gap-1.5 text-[0.6875rem] leading-none opacity-80">
        {message.editedAt ? (
          <span title={chat.edit.labelTitle(formatFull(new Date(message.editedAt)))}>
            {chat.edit.labelAt(formatClock(new Date(message.editedAt)))}
          </span>
        ) : null}
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
          <>
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
            <button
              type="button"
              onClick={actions.onDiscard}
              className="min-h-11 rounded-full px-3 text-sm font-semibold text-danger-600"
            >
              {chat.discardUnsent}
            </button>
          </>
        ) : local || message.deletedForEveryone ? (
          <div className={bubbleClass}>{content}</div>
        ) : (
          <DropdownMenu>
            {hasMedia ? (
              <div className={bubbleClass}>
                {content}
                <DropdownTrigger asChild>
                  <button
                    type="button"
                    aria-label={chat.messageActions}
                    className={cn(
                      "absolute right-1 top-1 flex size-8 items-center justify-center rounded-full bg-ink-950/45 text-white",
                      message.type === "VOICE" && "size-6",
                    )}
                  >
                    <ChevronDown aria-hidden className="size-4" />
                  </button>
                </DropdownTrigger>
              </div>
            ) : (
              <DropdownTrigger asChild>
                <button
                  type="button"
                  aria-haspopup="menu"
                  className={cn(bubbleClass, "cursor-pointer")}
                >
                  {content}
                </button>
              </DropdownTrigger>
            )}
            <DropdownContent align={mine ? "end" : "start"}>
              <div
                role="group"
                aria-label={chat.reactionQuick}
                className="grid grid-cols-5 gap-1 px-1 py-1"
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
              <DropdownItem icon={SmilePlus} onSelect={() => setMoreOpen(true)}>
                {chat.reactionMore}
              </DropdownItem>
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
        {!message.deletedForEveryone ? (
          <ReactionChips
            reactions={message.reactions}
            onToggle={actions.onReact}
            className={cn("-mt-1.5", mine ? "mr-2 justify-end" : "ml-2")}
          />
        ) : null}
        <MoreReactions open={moreOpen} onOpenChange={setMoreOpen} onPick={actions.onReact} />
      </motion.div>
    </div>
  );
}
