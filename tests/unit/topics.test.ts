import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  MAX_INTERESTS,
  MIN_INTERESTS,
  TOPICS,
  TOPIC_ALIASES,
  canonicalTopicSlug,
  interestsSchema,
  topicBySlug,
  topicsByGroup,
} from "../../packages/shared/src";

describe("topics", () => {
  it("has unique slugs and names", () => {
    expect(new Set(TOPICS.map((t) => t.slug)).size).toBe(TOPICS.length);
    expect(new Set(TOPICS.map((t) => t.name)).size).toBe(TOPICS.length);
  });

  it("gives every topic a group, a description and a real icon file", () => {
    for (const t of TOPICS) {
      expect(t.description.length).toBeGreaterThan(10);
      const file = path.join(process.cwd(), "apps/web/public/images/icons", `${t.icon}.png`);
      expect(existsSync(file), `${t.slug} icon ${t.icon}`).toBe(true);
    }
    const grouped = topicsByGroup().flatMap((g) => g.topics);
    expect(grouped.length).toBe(TOPICS.length);
  });

  it("keeps old slugs working", () => {
    expect(canonicalTopicSlug("faith-and-life")).toBe("religion-and-spirituality");
    expect(topicBySlug("faith-and-life")?.name).toBe("Religion and Spirituality");
    for (const to of Object.values(TOPIC_ALIASES)) expect(topicBySlug(to)).toBeDefined();
    expect(TOPICS.some((t) => t.slug === "faith-and-life")).toBe(false);
  });

  it("accepts three to eight interests, maps old slugs and drops duplicates", () => {
    const some = (n: number) => TOPICS.slice(0, n).map((t) => t.slug);
    expect(interestsSchema.safeParse({ topics: some(MIN_INTERESTS - 1) }).success).toBe(false);
    expect(interestsSchema.safeParse({ topics: some(MIN_INTERESTS) }).success).toBe(true);
    expect(interestsSchema.safeParse({ topics: some(MAX_INTERESTS) }).success).toBe(true);
    expect(interestsSchema.safeParse({ topics: some(MAX_INTERESTS + 1) }).success).toBe(false);
    const mapped = interestsSchema.parse({
      topics: ["faith-and-life", "football", "comedy", "football"],
    });
    expect(mapped.topics).toEqual(["religion-and-spirituality", "football", "comedy"]);
  });
});
