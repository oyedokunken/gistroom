"use client";

import { useMemo, useState } from "react";
import type { MessageDto } from "@gistroom/shared";
import { ChatBubble } from "@/components/chat/chat-bubble";
import { Composer } from "@/components/chat/composer";
import { MessageList } from "@/components/chat/message-list";
import { Avatar } from "@/components/ui/avatar";
import { buildRows } from "@/lib/chat/rows";
import { RealtimeStubProvider } from "@/lib/realtime/provider";

const iso = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString();

const make = (
  id: string,
  senderId: string,
  body: string,
  minutesAgo: number,
  over: Partial<MessageDto> = {},
): MessageDto => ({
  id,
  conversationId: "c1",
  senderId,
  clientId: `k-${id}`,
  type: "TEXT",
  body,
  replyToId: null,
  replyPreview: null,
  meta: null,
  createdAt: iso(minutesAgo),
  deletedForEveryone: false,
  attachments: [],
  reactions: [],
  starred: false,
  ...over,
});

const SAMPLE: MessageDto[] = [
  make("1", "ada", "Abeg, are you watching the match tonight?", 60 * 26),
  make("2", "me", "Of course. Viewing centre at 8?", 60 * 26 - 2),
  make("3", "ada", "Oya, I will bring my cousin.", 60 * 25),
  make("4", "ada", "He talks too much though.", 60 * 25 - 1),
  make("5", "me", "No wahala. More gist for us.", 12, {
    reactions: [{ emoji: "\u{1F602}", count: 1, mine: false }],
  }),
  make("6", "ada", "Say that again and I will tell him.", 10, {
    replyPreview: { id: "5", senderId: "me", body: "No wahala. More gist for us.", type: "TEXT" },
  }),
  make("7", "me", "This one was sent in error", 8, { deletedForEveryone: true, body: null }),
  make("8", "me", "Starred for later", 5, { starred: true }),
  make(
    "9",
    "ada",
    "A longer message to check wrapping across several lines on a small phone screen, with a Yoruba name like Adebayo, Ọlá and Ṣade, and the naira sign ₦ 5,000.",
    2,
  ),
];

/** Sample thread for eyeballing bubbles, receipts, grouping and the composer at 360, 768 and 1440 widths. */
export function ChatPreview() {
  const [extra, setExtra] = useState<MessageDto[]>([]);
  const rows = useMemo(
    () => buildRows({ messages: [...SAMPLE, ...extra], outbox: [], viewerId: "me" }),
    [extra],
  );
  const noop = () => undefined;
  return (
    <RealtimeStubProvider>
      <div className="mx-auto flex h-dvh max-w-3xl flex-col border-x border-border">
        <header className="flex items-center gap-3 border-b border-border p-3">
          <Avatar name="Ada Bello" size={40} online />
          <div>
            <p className="font-semibold">Ada Bello</p>
            <p className="text-sm text-text-muted">Online</p>
          </div>
        </header>
        <MessageList
          scrollKey="preview"
          rows={rows}
          hasOlder={false}
          loadingOlder={false}
          onLoadOlder={noop}
          renderMessage={(row) => (
            <ChatBubble
              row={row}
              peerName="Ada"
              canDeleteEveryone={row.mine}
              receipt={
                row.mine
                  ? row.message.id === "5"
                    ? "DELIVERED"
                    : row.message.id === "8"
                      ? "READ"
                      : "SENT"
                  : null
              }
              actions={{
                onReply: noop,
                onCopy: noop,
                onStar: noop,
                onReact: noop,
                onDeleteMe: noop,
                onDeleteEveryone: noop,
                onRetry: noop,
              }}
            />
          )}
        />
        <Composer
          conversationId="preview"
          replyingTo={null}
          onCancelReply={noop}
          onSend={(text) => setExtra((e) => [...e, make(`x${e.length}`, "me", text, 0)])}
        />
      </div>
    </RealtimeStubProvider>
  );
}
