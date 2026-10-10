"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { SendHorizontal, X } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { chat } from "@/content/chat";
import { LIMITS, validation } from "@gistroom/shared";
import { useDrafts } from "@/lib/chat/drafts";
import { useRealtime } from "@/lib/realtime/provider";
import { cn } from "@/lib/cn";
import { EmojiButton } from "./emoji-button";

export interface ComposerProps {
  conversationId: string;
  disabled?: boolean;
  disabledReason?: string;
  replyingTo: { id: string; name: string; text: string } | null;
  onCancelReply: () => void;
  onSend: (text: string) => void;
}

const TYPING_REFRESH_MS = 2500;
const TYPING_IDLE_MS = 3000;

export function Composer({
  conversationId,
  disabled,
  disabledReason,
  replyingTo,
  onCancelReply,
  onSend,
}: ComposerProps) {
  const realtime = useRealtime();
  const draft = useDrafts((s) => s.drafts[conversationId] ?? "");
  const setDraft = useDrafts((s) => s.set);
  const [text, setText] = useState(draft);
  const ref = useRef<HTMLTextAreaElement>(null);
  const lastTyping = useRef(0);
  const idle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Switching chats swaps the text for that chat's draft.
  useEffect(() => {
    setText(useDrafts.getState().drafts[conversationId] ?? "");
  }, [conversationId]);

  // Grow with the text, up to a few lines.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  useEffect(() => {
    return () => {
      clearTimeout(idle.current);
      realtime.typing(conversationId, false);
    };
  }, [conversationId, realtime]);

  function change(value: string) {
    setText(value);
    setDraft(conversationId, value);
    const now = Date.now();
    if (value && now - lastTyping.current > TYPING_REFRESH_MS) {
      lastTyping.current = now;
      realtime.typing(conversationId, true);
    }
    clearTimeout(idle.current);
    idle.current = setTimeout(() => {
      lastTyping.current = 0;
      realtime.typing(conversationId, false);
    }, TYPING_IDLE_MS);
  }

  function submit() {
    const value = text.trim();
    if (!value || disabled) return;
    onSend(value);
    setText("");
    useDrafts.getState().clear(conversationId);
    clearTimeout(idle.current);
    lastTyping.current = 0;
    realtime.typing(conversationId, false);
    ref.current?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  function insert(emoji: string) {
    const el = ref.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    change(text.slice(0, start) + emoji + text.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  }

  if (disabled) {
    return (
      <p className="border-t border-border bg-surface-2 px-4 py-4 text-center text-sm text-text-muted">
        {disabledReason ?? chat.cannotMessage}
      </p>
    );
  }

  const over = text.length > LIMITS.MESSAGE_MAX_CHARS;

  return (
    <div className="border-t border-border bg-surface px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 md:px-4">
      {replyingTo ? (
        <div className="mb-2 flex items-start justify-between gap-2 rounded-lg border-l-4 border-green-600 bg-surface-2 px-3 py-2 text-sm">
          <div className="min-w-0">
            <p className="font-semibold text-green-700">{chat.replyingTo(replyingTo.name)}</p>
            <p className="line-clamp-1 text-text-muted">{replyingTo.text}</p>
          </div>
          <IconButton label={chat.cancelReply} onClick={onCancelReply} className="-my-2 -mr-2">
            <X aria-hidden className="size-4" />
          </IconButton>
        </div>
      ) : null}
      <div className="flex items-end gap-1">
        <EmojiButton onPick={insert} />
        <textarea
          ref={ref}
          value={text}
          rows={1}
          aria-label={chat.composerLabel}
          placeholder={chat.composerPlaceholder}
          onChange={(e) => change(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => realtime.typing(conversationId, false)}
          enterKeyHint="send"
          className={cn(
            "max-h-40 min-h-11 flex-1 resize-none rounded-[1.375rem] border bg-surface-2 px-4 py-2.5 text-base text-text placeholder:text-text-muted",
            over ? "border-danger-600" : "border-transparent focus-visible:border-green-600",
          )}
        />
        <IconButton
          label={chat.send}
          onClick={submit}
          disabled={!text.trim() || over}
          className="bg-green-600 text-white hover:bg-green-700"
        >
          <SendHorizontal aria-hidden className="size-5" />
        </IconButton>
      </div>
      {over ? (
        <p role="alert" className="px-2 pt-1 text-sm font-medium text-danger-600">
          {validation.messageTooLong(LIMITS.MESSAGE_MAX_CHARS)}
        </p>
      ) : null}
    </div>
  );
}
