"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useInView } from "motion/react";
import { ArrowUpRight, Search } from "lucide-react";
import { TOPICS, type TopicInfo } from "@gistroom/shared";
import { CardIcon, type CardIconName } from "@/components/public/card-icon";
import { homeCopy as copy } from "@/content/home";
import { roomsSearch } from "@/content/marketing";
import { useCalm } from "@/lib/calm";
import { cn } from "@/lib/cn";

// ---------- Topics strip ----------

/** Two drifting rows of topic chips moving in opposite directions. Pauses on hover and off screen, and holds still for reduced motion. */
export function TopicsStrip() {
  const calm = useCalm();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref);
  const [hover, setHover] = useState(false);
  const run = inView && !hover && !calm;
  const mid = Math.ceil(TOPICS.length / 2);
  const rows = [TOPICS.slice(0, mid), TOPICS.slice(mid)];
  const row = (topics: readonly TopicInfo[], hidden: boolean) =>
    topics.map((t) => (
      <Link
        key={`${hidden}-${t.slug}`}
        href={`/topics/${t.slug}`}
        tabIndex={hidden ? -1 : undefined}
        aria-hidden={hidden || undefined}
        className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-border bg-surface px-5 text-base font-semibold text-text hover:border-green-600 hover:text-green-700"
      >
        {t.name}
      </Link>
    ));
  return (
    <div
      ref={ref}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      className="relative left-1/2 flex w-screen -translate-x-1/2 flex-col gap-3 overflow-hidden"
      aria-label={copy.topics.label}
    >
      {rows.map((topics, i) => (
        <motion.div
          key={i}
          className="flex w-max gap-3"
          animate={run ? { x: i === 0 ? ["0%", "-50%"] : ["-50%", "0%"] } : undefined}
          transition={{ duration: 70, ease: "linear", repeat: Infinity }}
        >
          <div className="flex shrink-0 gap-3">{row(topics, false)}</div>
          <div className="flex shrink-0 gap-3" aria-hidden>
            {row(topics, true)}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ---------- Live topic cards ----------

/** A fresh custom icon for every topic, drawn by scripts/graphics/icons.mjs. */
const TOPIC_CARD_ICONS: Record<string, CardIconName> = Object.fromEntries(
  TOPICS.map((t) => [t.slug, t.icon as CardIconName]),
);

/**
 * Two drifting rows of demo topic cards moving in opposite directions, edge to edge.
 * Each card has a custom icon and a button into its topic page. Pauses on hover and off screen.
 */
export function TopicCardsMarquee() {
  const calm = useCalm();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref);
  const [hover, setHover] = useState(false);
  const run = inView && !hover && !calm;
  const mid = Math.ceil(TOPICS.length / 2);
  const rows = [TOPICS.slice(0, mid), TOPICS.slice(mid)];
  const card = (t: TopicInfo, hidden: boolean) => {
    return (
      <div
        key={`${hidden}-${t.slug}`}
        className="group w-72 shrink-0 rounded-card bg-surface p-5 shadow-soft transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lift"
      >
        <CardIcon name={TOPIC_CARD_ICONS[t.slug] ?? "open-gist"} className="size-12" />
        <p className="mt-4 font-bold">{t.name}</p>
        <p className="mt-1 line-clamp-2 min-h-10 text-sm text-text-muted">{t.description}</p>
        <Link
          href={`/topics/${t.slug}`}
          tabIndex={hidden ? -1 : undefined}
          aria-hidden={hidden || undefined}
          className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-green-600 px-5 text-sm font-semibold text-white transition-colors group-hover:bg-yellow-400 group-hover:text-ink-950"
        >
          {copy.discover.open}
          <ArrowUpRight
            aria-hidden
            className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
          />
        </Link>
      </div>
    );
  };
  return (
    <div
      ref={ref}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      className="relative left-1/2 flex w-screen -translate-x-1/2 flex-col gap-4 overflow-hidden py-4"
      aria-label={copy.discover.label}
    >
      {rows.map((topics, i) => (
        <motion.div
          key={i}
          className="flex w-max gap-4 px-4"
          animate={run ? { x: i === 0 ? ["0%", "-50%"] : ["-50%", "0%"] } : undefined}
          transition={{ duration: 90, ease: "linear", repeat: Infinity }}
        >
          <div className="flex shrink-0 gap-4">{topics.map((t) => card(t, false))}</div>
          <div className="flex shrink-0 gap-4" aria-hidden>
            {topics.map((t) => card(t, true))}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/** The same big search box as /rooms. From the landing page it carries the query over to the rooms page. */
export function RoomSearchBox({ className }: { className?: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <form
      role="search"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const term = q.trim();
        router.push(term ? `/rooms?q=${encodeURIComponent(term)}` : "/rooms");
      }}
      className={cn("relative", className)}
    >
      <label htmlFor="topics-search" className="sr-only">
        {roomsSearch.label}
      </label>
      <Search
        aria-hidden
        className="pointer-events-none absolute left-5 top-1/2 size-6 -translate-y-1/2 text-text-muted"
      />
      <input
        id="topics-search"
        type="search"
        inputMode="search"
        autoComplete="off"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={roomsSearch.placeholder}
        className="min-h-16 w-full rounded-full border-2 border-border bg-surface pl-14 pr-6 text-lg text-text shadow-soft placeholder:text-text-muted focus-visible:border-green-600"
      />
    </form>
  );
}
