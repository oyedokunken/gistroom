"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Clock,
  Flag,
  Hash,
  Lightbulb,
  PawPrint,
  Plane,
  Search,
  Smile,
  Trophy,
  Users,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import { chat } from "@/content/chat";
import { cn } from "@/lib/cn";

interface CompactEmoji {
  hexcode: string;
  label: string;
  unicode: string;
  group?: number;
  tags?: string[];
}

/** Group ids from emojibase. Group 2 holds skin tone components, which are not emoji to pick on their own. */
const GROUPS: { id: number | "recent"; label: string; icon: LucideIcon }[] = [
  { id: "recent", label: chat.emojiGroups.recent, icon: Clock },
  { id: 0, label: chat.emojiGroups.smileys, icon: Smile },
  { id: 1, label: chat.emojiGroups.people, icon: Users },
  { id: 3, label: chat.emojiGroups.animals, icon: PawPrint },
  { id: 4, label: chat.emojiGroups.food, icon: Utensils },
  { id: 5, label: chat.emojiGroups.travel, icon: Plane },
  { id: 6, label: chat.emojiGroups.activities, icon: Trophy },
  { id: 7, label: chat.emojiGroups.objects, icon: Lightbulb },
  { id: 8, label: chat.emojiGroups.symbols, icon: Hash },
  { id: 9, label: chat.emojiGroups.flags, icon: Flag },
];

const RECENT_KEY = "gr_recent_emoji";

function loadRecent(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string").slice(0, 24)
      : [];
  } catch {
    return [];
  }
}

function saveRecent(list: string[]) {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 24)));
  } catch {
    // Storage blocked: recents only last for this visit.
  }
}

/**
 * Small emoji picker. The data comes from emojibase at runtime and loads only when this opens, so no emoji
 * character lives in our source (R1). It adds no inline styles, which keeps the strict CSP intact.
 */
export function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [data, setData] = useState<CompactEmoji[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [group, setGroup] = useState<number | "recent">("recent");
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    const stored = loadRecent();
    setRecent(stored);
    if (stored.length === 0) setGroup(0);
    let cancelled = false;
    import("emojibase-data/en/compact.json")
      .then((m) => {
        if (!cancelled)
          setData(
            (m.default as CompactEmoji[]).filter((e) => e.group !== undefined && e.group !== 2),
          );
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const shown = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (q.length >= 2) {
      return data
        .filter(
          (e) =>
            e.label.toLowerCase().includes(q) || e.tags?.some((t) => t.toLowerCase().includes(q)),
        )
        .slice(0, 120);
    }
    if (group === "recent")
      return recent
        .map((u) => data.find((e) => e.unicode === u))
        .filter((e): e is CompactEmoji => Boolean(e));
    return data.filter((e) => e.group === group);
  }, [data, group, query, recent]);

  function pick(emoji: string) {
    const next = [emoji, ...recent.filter((r) => r !== emoji)].slice(0, 24);
    setRecent(next);
    saveRecent(next);
    onPick(emoji);
  }

  return (
    <div className="flex w-[min(20rem,calc(100vw-1.5rem))] flex-col">
      <div className="relative border-b border-border p-2">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-5 top-1/2 size-4 -translate-y-1/2 text-text-muted"
        />
        <input
          type="search"
          aria-label={chat.emojiSearch}
          placeholder={chat.emojiSearch}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="min-h-11 w-full rounded-full bg-surface-2 pl-9 pr-3 text-base text-text placeholder:text-text-muted"
        />
      </div>
      <div
        role="tablist"
        aria-label={chat.emojiGroupsLabel}
        className="flex justify-between border-b border-border px-1"
      >
        {GROUPS.map(({ id, label, icon: Icon }) => (
          <button
            key={String(id)}
            type="button"
            role="tab"
            aria-selected={group === id && query.trim().length < 2}
            aria-label={label}
            onClick={() => {
              setGroup(id);
              setQuery("");
            }}
            className={cn(
              "flex size-8 min-h-11 min-w-8 items-center justify-center rounded-lg",
              group === id && query.trim().length < 2
                ? "text-green-700"
                : "text-text-muted hover:text-text",
            )}
          >
            <Icon aria-hidden className="size-4" />
          </button>
        ))}
      </div>
      <div className="h-64 overflow-y-auto p-1">
        {failed ? (
          <p className="p-4 text-center text-sm text-text-muted">{chat.loadError}</p>
        ) : !data ? (
          <p role="status" className="p-4 text-center text-sm text-text-muted">
            {chat.emojiLoading}
          </p>
        ) : shown.length === 0 ? (
          <p className="p-4 text-center text-sm text-text-muted">
            {group === "recent" && !query ? chat.emojiNoRecent : chat.emojiNone}
          </p>
        ) : (
          <ul className="grid grid-cols-7">
            {shown.map((e) => (
              <li key={e.hexcode}>
                <button
                  type="button"
                  onClick={() => pick(e.unicode)}
                  aria-label={e.label}
                  className="flex size-11 items-center justify-center rounded-lg text-2xl hover:bg-surface-2"
                >
                  {e.unicode}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
