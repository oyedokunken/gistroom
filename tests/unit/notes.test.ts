import { describe, expect, it } from "vitest";
import {
  LIMITS,
  createNoteSchema,
  noteBodySchema,
  updateNoteSchema,
} from "../../packages/shared/src";

describe("notes", () => {
  it("belong to exactly one chat or one room", () => {
    expect(createNoteSchema.safeParse({ conversationId: "c1", body: "hi" }).success).toBe(true);
    expect(createNoteSchema.safeParse({ roomSlug: "abc", body: "hi" }).success).toBe(true);
    expect(createNoteSchema.safeParse({ body: "hi" }).success).toBe(false);
    expect(
      createNoteSchema.safeParse({ conversationId: "c1", roomSlug: "abc", body: "hi" }).success,
    ).toBe(false);
  });
  it("trim, need words and stop at the limit", () => {
    expect(noteBodySchema.parse("  Ask Chidi  ")).toBe("Ask Chidi");
    expect(noteBodySchema.safeParse("   ").success).toBe(false);
    expect(noteBodySchema.safeParse("x".repeat(LIMITS.NOTE_MAX_CHARS)).success).toBe(true);
    expect(noteBodySchema.safeParse("x".repeat(LIMITS.NOTE_MAX_CHARS + 1)).success).toBe(false);
    expect(updateNoteSchema.safeParse({ body: "" }).success).toBe(false);
  });
});
