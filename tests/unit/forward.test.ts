import { describe, expect, it } from "vitest";
import {
  FORWARD_MAX_DESTINATIONS,
  FORWARD_MAX_MESSAGES,
  forwardSchema,
} from "../../packages/shared/src";
import { forwardClientId, forwardable } from "../../apps/web/src/server/chat/forward";

const base = {
  type: "TEXT",
  deletedForEveryoneAt: null,
  hiddenForMe: false,
  createdAt: new Date("2026-11-01T10:00:00Z"),
  clearedAt: null,
};

describe("which messages may be forwarded", () => {
  it("allows text, photos, videos, voice notes and files", () => {
    for (const type of ["TEXT", "IMAGE", "VIDEO", "VOICE", "FILE"]) {
      expect(forwardable({ ...base, type })).toBe(true);
    }
  });
  it("keeps room invites, call records and system lines where they are", () => {
    for (const type of ["ROOM_INVITE", "SYSTEM"]) {
      expect(forwardable({ ...base, type })).toBe(false);
    }
  });
  it("refuses a message deleted for everyone or hidden by the person", () => {
    expect(forwardable({ ...base, deletedForEveryoneAt: new Date() })).toBe(false);
    expect(forwardable({ ...base, hiddenForMe: true })).toBe(false);
  });
  it("refuses a message from before the person cleared the chat", () => {
    expect(forwardable({ ...base, clearedAt: new Date("2026-11-01T11:00:00Z") })).toBe(false);
    expect(forwardable({ ...base, clearedAt: new Date("2026-11-01T09:00:00Z") })).toBe(true);
  });
});

describe("forward request shape", () => {
  const ok = { batchId: "batch_12345678", messageIds: ["m1"], userIds: ["u1"] };
  it("accepts a normal request", () => {
    expect(forwardSchema.safeParse(ok).success).toBe(true);
  });
  it("needs a batch id, at least one message and one person", () => {
    expect(forwardSchema.safeParse({ ...ok, batchId: "x" }).success).toBe(false);
    expect(forwardSchema.safeParse({ ...ok, batchId: "has space in it" }).success).toBe(false);
    expect(forwardSchema.safeParse({ ...ok, messageIds: [] }).success).toBe(false);
    expect(forwardSchema.safeParse({ ...ok, userIds: [] }).success).toBe(false);
  });
  it("caps messages and people and refuses duplicates", () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => `id${i}`);
    expect(
      forwardSchema.safeParse({ ...ok, messageIds: many(FORWARD_MAX_MESSAGES + 1) }).success,
    ).toBe(false);
    expect(
      forwardSchema.safeParse({ ...ok, userIds: many(FORWARD_MAX_DESTINATIONS + 1) }).success,
    ).toBe(false);
    expect(forwardSchema.safeParse({ ...ok, messageIds: ["a", "a"] }).success).toBe(false);
  });
  it("does not accept labels or sender fields from the client", () => {
    const parsed = forwardSchema.parse({ ...ok, forwarded: true, originalSender: "u9" });
    expect(Object.keys(parsed).sort()).toEqual(["batchId", "messageIds", "userIds"]);
  });
});

describe("forward client ids", () => {
  it("are the same on a retry and different for each person and message", () => {
    expect(forwardClientId("batch_1", 0, 0)).toBe(forwardClientId("batch_1", 0, 0));
    const ids = new Set([
      forwardClientId("batch_1", 0, 0),
      forwardClientId("batch_1", 0, 1),
      forwardClientId("batch_1", 1, 0),
      forwardClientId("batch_2", 0, 0),
    ]);
    expect(ids.size).toBe(4);
  });
  it("fit the message client id limit for the longest batch id", () => {
    expect(forwardClientId("b".repeat(40), 4, 9).length).toBeLessThanOrEqual(64);
  });
});
