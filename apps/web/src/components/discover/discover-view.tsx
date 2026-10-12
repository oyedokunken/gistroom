"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Compass, Mic, Pencil, RefreshCw, Search, SearchX } from "lucide-react";
import {
  LANGUAGES,
  LANGUAGE_LABELS,
  TOPICS,
  type DiscoverFeed,
  type DiscoverRoom,
  type DiscoverSort,
} from "@gistroom/shared";
import { PersonActions } from "@/components/friends/person-actions";
import { Avatar } from "@/components/ui/avatar";
import { Button, buttonStyles } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { discover as copy } from "@/content/discover";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/cn";
import { RoomTile } from "./room-tile";

interface Filters {
  topic: string;
  language: string;
  q: string;
  sort: DiscoverSort;
}

const NONE: Filters = { topic: "", language: "all", q: "", sort: "active" };

function queryString(f: Filters): string {
  const p = new URLSearchParams();
  if (f.topic) p.set("topic", f.topic);
  if (f.language !== "all") p.set("language", f.language);
  if (f.q) p.set("q", f.q);
  if (f.sort !== "active") p.set("sort", f.sort);
  const s = p.toString();
  return s ? `?${s}` : "";
}

function Section({
  id,
  title,
  lead,
  children,
}: {
  id: string;
  title: string;
  lead?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <div>
        <h2 id={id} className="text-xl font-bold text-text">
          {title}
        </h2>
        {lead ? <p className="text-text-muted">{lead}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Grid({ rooms }: { rooms: DiscoverRoom[] }) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {rooms.map((r) => (
        <RoomTile key={r.slug} room={r} />
      ))}
    </ul>
  );
}

function Skeletons() {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-hidden>
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i}>
          <Skeleton className="h-60 rounded-card" />
        </li>
      ))}
    </ul>
  );
}

/**
 * The page people land on: what is live, what starts soon, what fits their interests, and every topic. Filters sit
 * at the top and the results change as you type. No pictures, only the rooms and the people in them.
 */
export function DiscoverView({ initial }: { initial: DiscoverFeed }) {
  const [filters, setFilters] = useState<Filters>(NONE);
  const [text, setText] = useState("");
  useEffect(() => {
    const id = window.setTimeout(() => setFilters((f) => ({ ...f, q: text.trim() })), 300);
    return () => window.clearTimeout(id);
  }, [text]);

  const isDefault =
    filters.topic === "" &&
    filters.language === "all" &&
    filters.q === "" &&
    filters.sort === "active";
  const feed = useQuery({
    queryKey: ["discover", filters],
    queryFn: () => apiFetch<DiscoverFeed>(`/api/discover${queryString(filters)}`),
    initialData: isDefault ? initial : undefined,
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
  const data = feed.data;

  const topicChips = useMemo(
    () => [
      { slug: "", name: copy.filters.allTopics },
      ...TOPICS.map((t) => ({ slug: t.slug, name: t.name })),
    ],
    [],
  );
  const counts = useMemo(() => new Map((data?.topics ?? []).map((t) => [t.slug, t.rooms])), [data]);

  const filtered = !isDefault;
  const nothing = data && data.live.length === 0 && data.soon.length === 0;
  const clear = () => {
    setText("");
    setFilters(NONE);
  };

  return (
    <div className="flex flex-col gap-10">
      <div role="search" aria-label={copy.filters.label} className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-text-muted"
            />
            <Input
              type="text"
              inputMode="search"
              aria-label={copy.filters.search}
              placeholder={copy.filters.searchPlaceholder}
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoComplete="off"
              className="rounded-full pl-11"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-44">
              <Select
                value={filters.language}
                onValueChange={(language) => setFilters((f) => ({ ...f, language }))}
                placeholder={copy.filters.language}
                options={[
                  { value: "all", label: copy.filters.allLanguages },
                  ...LANGUAGES.map((l) => ({ value: l.toLowerCase(), label: LANGUAGE_LABELS[l] })),
                ]}
              />
            </div>
            <SegmentedTabs
              label={copy.filters.sort}
              value={filters.sort}
              onChange={(v) => setFilters((f) => ({ ...f, sort: v as DiscoverSort }))}
              options={[
                { value: "active", label: copy.filters.active },
                { value: "newest", label: copy.filters.newest },
              ]}
            />
          </div>
        </div>
        <ul
          aria-label={copy.filters.topicsLabel}
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0"
        >
          {topicChips.map((t) => {
            const on = filters.topic === t.slug;
            return (
              <li key={t.slug || "all"} className="shrink-0">
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => setFilters((f) => ({ ...f, topic: t.slug }))}
                  className={cn(
                    "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold transition-colors",
                    on
                      ? "border-green-600 bg-green-600 text-white"
                      : "border-border bg-surface text-text hover:bg-green-100",
                  )}
                >
                  {t.name}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {feed.isError && !data ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <RefreshCw aria-hidden className="size-8 text-green-600" />
          <h2 className="text-xl font-bold text-text">{copy.problem.title}</h2>
          <p className="text-text-muted">{copy.problem.body}</p>
          <Button variant="secondary" onClick={() => void feed.refetch()}>
            {copy.problem.retry}
          </Button>
        </div>
      ) : !data ? (
        <Skeletons />
      ) : (
        <>
          {nothing ? (
            <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-border px-6 py-12 text-center">
              {filtered ? (
                <SearchX aria-hidden className="size-10 text-text-muted" />
              ) : (
                <Compass aria-hidden className="size-10 text-green-600" />
              )}
              <h2 className="text-xl font-bold text-text">
                {filtered ? copy.empty.filteredTitle : copy.empty.title}
              </h2>
              <p className="max-w-md text-text-muted">
                {filtered ? copy.empty.filteredBody : copy.empty.body}
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Link href="/app/rooms?new=1" className={buttonStyles("primary", "gap-2")}>
                  <Mic aria-hidden className="size-4" />
                  {copy.empty.start}
                </Link>
                {filtered ? (
                  <Button variant="secondary" onClick={clear}>
                    {copy.filters.clear}
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}

          {data.live.length > 0 ? (
            <Section id="live-h" title={copy.sections.live} lead={copy.sections.liveLead}>
              <Grid rooms={data.live} />
            </Section>
          ) : null}

          {data.soon.length > 0 ? (
            <Section id="soon-h" title={copy.sections.soon} lead={copy.sections.soonLead}>
              <Grid rooms={data.soon} />
            </Section>
          ) : null}

          {data.interests.length === 0 ? (
            <Section id="foryou-h" title={copy.sections.forYou}>
              <div className="flex flex-col items-start gap-3 rounded-card bg-surface-2 p-5">
                <p className="font-semibold text-text">{copy.empty.noInterestsTitle}</p>
                <p className="text-text-muted">{copy.empty.noInterestsBody}</p>
                <Link href="/app/settings/interests" className={buttonStyles("secondary")}>
                  {copy.empty.pick}
                </Link>
              </div>
            </Section>
          ) : data.forYou.length > 0 ? (
            <Section id="foryou-h" title={copy.sections.forYou} lead={copy.sections.forYouLead}>
              <Grid rooms={data.forYou} />
              <Link
                href="/app/settings/interests"
                className="inline-flex min-h-11 w-fit items-center gap-1.5 text-sm font-semibold text-green-700 underline-offset-4 hover:underline"
              >
                <Pencil aria-hidden className="size-4" />
                {copy.empty.editInterests}
              </Link>
            </Section>
          ) : null}

          <Section id="topics-h" title={copy.sections.topics} lead={copy.sections.topicsLead}>
            <ul className="flex flex-wrap gap-2">
              {TOPICS.map((t) => {
                const n = counts.get(t.slug) ?? 0;
                return (
                  <li key={t.slug}>
                    <button
                      type="button"
                      onClick={() => {
                        setFilters((f) => ({ ...f, topic: t.slug }));
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="flex min-h-11 items-center gap-2 rounded-full border border-border bg-surface px-4 text-sm font-semibold text-text transition-colors hover:bg-green-100"
                    >
                      {t.name}
                      <span
                        className={cn(
                          "tabular rounded-full px-2 py-0.5 text-xs font-bold",
                          n > 0 ? "bg-yellow-400 text-ink-950" : "bg-surface-2 text-text-muted",
                        )}
                      >
                        {copy.topicCount(n)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Section>

          {data.people.length > 0 ? (
            <Section id="people-h" title={copy.sections.people} lead={copy.sections.peopleLead}>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {data.people.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 rounded-card border border-border bg-surface p-4"
                  >
                    <Link href={`/app/u/${p.username}`} className="shrink-0">
                      <Avatar name={p.name} src={p.avatarUrl} size={52} />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/app/u/${p.username}`}
                        className="block truncate font-semibold text-text hover:underline"
                      >
                        {p.name}
                      </Link>
                      <p className="truncate text-sm text-text-muted">@{p.username}</p>
                      <p className="truncate text-sm text-green-700">
                        {copy.people.shared(p.sharedTopics.join(", "))}
                      </p>
                    </div>
                    <PersonActions user={p} relationship={p.relationship} />
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
        </>
      )}
    </div>
  );
}
