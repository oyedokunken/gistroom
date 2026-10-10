"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import type { PublicRoomCard } from "@gistroom/shared";
import { RoomCard } from "@/components/public/room-card";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { roomsSearch as copy } from "@/content/marketing";
import { roomsPage } from "@/content/pages";
import { cn } from "@/lib/cn";

const DEBOUNCE_MS = 250;

/** One big search box that updates as you type, plus a few common keywords to tap. */
export function RoomsExplorer({
  initialRooms,
  initialQuery,
  initialFailed,
  hrefBase,
  bare,
}: {
  initialRooms: PublicRoomCard[];
  initialQuery: string;
  initialFailed: boolean;
  hrefBase?: string;
  /** Drop the wide page padding when it sits inside the app. */
  bare?: boolean;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [rooms, setRooms] = useState(initialRooms);
  const [failed, setFailed] = useState(initialFailed);
  const [loading, setLoading] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const first = useRef(true);

  useEffect(() => {
    // The server already rendered the first results for the first query.
    if (first.current && retryTick === 0) {
      first.current = false;
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/public/rooms?q=${encodeURIComponent(query.trim())}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("bad status");
        const data = (await res.json()) as { rooms: PublicRoomCard[]; failed: boolean };
        setRooms(data.rooms);
        setFailed(data.failed);
        const url = new URL(window.location.href);
        if (query.trim()) url.searchParams.set("q", query.trim());
        else url.searchParams.delete("q");
        window.history.replaceState(null, "", url);
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError")) setFailed(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, retryTick]);

  // A failed request is retried quietly: once after 5 seconds, and again when the tab is focused.
  useEffect(() => {
    if (!failed) return;
    const timer = window.setTimeout(() => setRetryTick((n) => n + 1), 5000);
    const onFocus = () => setRetryTick((n) => n + 1);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [failed]);

  const live = rooms.filter((r) => r.status === "LIVE");
  const soon = rooms.filter((r) => r.status === "SCHEDULED");
  const term = query.trim();

  return (
    <div
      className={cn(
        "mx-auto w-full",
        bare ? "px-4 py-6 md:px-6" : "max-w-[1200px] px-6 py-12 md:py-16",
      )}
    >
      <form role="search" noValidate onSubmit={(e) => e.preventDefault()} className="relative">
        <label htmlFor="rooms-search" className="sr-only">
          {copy.label}
        </label>
        <Search
          aria-hidden
          className="pointer-events-none absolute left-5 top-1/2 size-6 -translate-y-1/2 text-text-muted"
        />
        <input
          id="rooms-search"
          type="search"
          inputMode="search"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={copy.placeholder}
          className="min-h-16 w-full rounded-full border-2 border-border bg-surface pl-14 pr-14 text-lg text-text shadow-soft placeholder:text-text-muted focus-visible:border-green-600"
        />
        <span className="absolute right-3 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center">
          {loading ? (
            <Loader2 aria-hidden className="size-5 animate-spin text-text-muted" />
          ) : term ? (
            <button
              type="button"
              aria-label={copy.clear}
              onClick={() => setQuery("")}
              className="flex size-11 items-center justify-center rounded-full hover:bg-surface-2"
            >
              <X aria-hidden className="size-5" />
            </button>
          ) : null}
        </span>
      </form>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm font-semibold text-text-muted">{copy.trySearching}</span>
        {copy.keywords.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={term.toLowerCase() === k}
            onClick={() => setQuery(term.toLowerCase() === k ? "" : k)}
            className={cn(
              "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold",
              term.toLowerCase() === k
                ? "border-green-600 bg-green-600 text-white"
                : "border-border text-text hover:bg-surface-2",
            )}
          >
            {k}
          </button>
        ))}
      </div>

      <p role="status" aria-live="polite" className="mt-8 text-sm font-medium text-text-muted">
        {loading ? copy.searching : failed || rooms.length === 0 ? "" : copy.results(rooms.length)}
      </p>

      {rooms.length === 0 && !loading ? (
        <EmptyState
          artId="empty-rooms"
          title={term ? copy.noResultsTitle(term) : roomsPage.emptyTitle}
          body={term ? copy.noResultsBody : roomsPage.emptyBody}
          action={
            <div className="flex flex-col items-center gap-2">
              <Link href="/app/rooms?new=1" className={buttonStyles("primary")}>
                {roomsPage.start}
              </Link>
              {bare ? (
                <button
                  type="button"
                  onClick={() => setRetryTick((n) => n + 1)}
                  className="min-h-11 px-3 text-sm font-semibold text-green-700 underline-offset-4 hover:underline"
                >
                  {roomsPage.refresh}
                </button>
              ) : null}
            </div>
          }
        />
      ) : (
        <div className={cn("transition-opacity", loading && "opacity-60")}>
          {live.length > 0 ? (
            <section className="mt-6" aria-labelledby="live-h">
              <h2 id="live-h" className="text-2xl font-bold text-text">
                {roomsPage.liveHeading}
              </h2>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {live.map((r) => (
                  <RoomCard key={r.slug} room={r} hrefBase={hrefBase} />
                ))}
              </ul>
            </section>
          ) : null}
          {soon.length > 0 ? (
            <section className="mt-10" aria-labelledby="soon-h">
              <h2 id="soon-h" className="text-2xl font-bold text-text">
                {roomsPage.soonHeading}
              </h2>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {soon.map((r) => (
                  <RoomCard key={r.slug} room={r} hrefBase={hrefBase} />
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
