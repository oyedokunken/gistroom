import { describe, expect, it } from "vitest";
import type { MessageDto } from "../../packages/shared/src";
import { buildRows } from "../../apps/web/src/lib/chat/rows";
import type { OutboxItem } from "../../apps/web/src/lib/chat/outbox";

const m = (id: string, senderId: string, at: string): MessageDto => ({
  id,
  conversationId: "c1",
  senderId,
  clientId: `k-${id}`,
  type: "TEXT",
  body: id,
  replyToId: null,
  replyPreview: null,
  meta: null,
  createdAt: at,
  deletedForEveryone: false,
  editedAt: null,
  attachments: [],
  reactions: [],
  starred: false,
});

const messageRows = (rows: ReturnType<typeof buildRows>) =>
  rows.filter((r): r is Extract<typeof r, { kind: "message" }> => r.kind === "message");

describe("buildRows", () => {
  it("adds a day separator when the day changes", () => {
    const rows = buildRows({
      messages: [m("1", "a", "2026-10-09T10:00:00"), m("2", "a", "2026-10-10T10:00:00")],
      outbox: [],
      viewerId: "a",
    });
    expect(rows.map((r) => r.kind)).toEqual(["day", "message", "day", "message"]);
  });

  it("groups consecutive bubbles from one sender within five minutes", () => {
    const rows = messageRows(
      buildRows({
        messages: [
          m("1", "a", "2026-10-10T10:00:00"),
          m("2", "a", "2026-10-10T10:02:00"),
          m("3", "a", "2026-10-10T10:20:00"),
          m("4", "b", "2026-10-10T10:21:00"),
        ],
        outbox: [],
        viewerId: "a",
      }),
    );
    expect(rows.map((r) => [r.groupStart, r.groupEnd])).toEqual([
      [true, false],
      [false, true],
      [true, true],
      [true, true],
    ]);
    expect(rows.map((r) => r.mine)).toEqual([true, true, true, false]);
  });

  it("appends unsent messages and hides one the server already confirmed", () => {
    const item = (clientId: string, at: string): OutboxItem => ({
      clientId,
      conversationId: "c1",
      body: clientId,
      replyToId: null,
      createdAt: at,
      status: "queued",
      attempts: 0,
    });
    const rows = messageRows(
      buildRows({
        messages: [m("1", "a", "2026-10-10T10:00:00")],
        outbox: [item("k-1", "2026-10-10T10:00:00"), item("new", "2026-10-10T10:05:00")],
        viewerId: "a",
      }),
    );
    expect(rows).toHaveLength(2);
    expect(rows[1]?.pending?.clientId).toBe("new");
    expect(rows[1]?.message.id).toBe("local-new");
  });

  it("returns nothing for an empty chat", () => {
    expect(buildRows({ messages: [], outbox: [], viewerId: "a" })).toEqual([]);
  });
});
