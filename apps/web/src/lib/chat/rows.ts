import type { MessageDto } from "@gistroom/shared";
import type { OutboxItem } from "./outbox";

export type Row =
  | { kind: "day"; key: string; date: Date }
  | {
      kind: "message";
      key: string;
      message: MessageDto;
      mine: boolean;
      /** First bubble of a run from one sender, so it gets the larger gap above it. */
      groupStart: boolean;
      /** Last bubble of a run, which shows the tail and the time. */
      groupEnd: boolean;
      pending: OutboxItem | null;
    };

const GROUP_GAP_MS = 5 * 60_000;

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** Local copy of an unsent message, shaped like a real one so the same bubble draws it. */
export function pendingToMessage(item: OutboxItem, senderId: string): MessageDto {
  return {
    id: `local-${item.clientId}`,
    conversationId: item.conversationId,
    senderId,
    clientId: item.clientId,
    type: "TEXT",
    body: item.body,
    replyToId: item.replyToId,
    replyPreview: null,
    meta: null,
    createdAt: item.createdAt,
    deletedForEveryone: false,
    attachments: [],
    reactions: [],
    starred: false,
  };
}

/**
 * Rows for the thread: messages oldest first with day separators and grouping.
 * Unsent items from the outbox join the end, unless the server copy already arrived.
 */
export function buildRows(input: {
  messages: readonly MessageDto[];
  outbox: readonly OutboxItem[];
  viewerId: string;
}): Row[] {
  const known = new Set(input.messages.map((m) => `${m.senderId}:${m.clientId}`));
  const pending = input.outbox
    .filter((o) => !known.has(`${input.viewerId}:${o.clientId}`))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const items: { message: MessageDto; pending: OutboxItem | null }[] = [
    ...input.messages.map((message) => ({ message, pending: null })),
    ...pending.map((p) => ({ message: pendingToMessage(p, input.viewerId), pending: p })),
  ];

  const rows: Row[] = [];
  let lastDay = "";
  items.forEach((entry, i) => {
    const date = new Date(entry.message.createdAt);
    const dk = dayKey(date);
    if (dk !== lastDay) {
      rows.push({ kind: "day", key: `day-${dk}`, date });
      lastDay = dk;
    }
    const prev = items[i - 1]?.message;
    const next = items[i + 1]?.message;
    const sameAsPrev =
      prev !== undefined &&
      prev.senderId === entry.message.senderId &&
      dayKey(new Date(prev.createdAt)) === dk &&
      date.getTime() - new Date(prev.createdAt).getTime() < GROUP_GAP_MS;
    const sameAsNext =
      next !== undefined &&
      next.senderId === entry.message.senderId &&
      dayKey(new Date(next.createdAt)) === dk &&
      new Date(next.createdAt).getTime() - date.getTime() < GROUP_GAP_MS;
    rows.push({
      kind: "message",
      key: entry.message.id,
      message: entry.message,
      mine: entry.message.senderId === input.viewerId,
      groupStart: !sameAsPrev,
      groupEnd: !sameAsNext,
      pending: entry.pending,
    });
  });
  return rows;
}
