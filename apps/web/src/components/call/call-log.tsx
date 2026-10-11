"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  MessageCircle,
  Phone,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  Search,
  Video,
} from "lucide-react";
import { LIMITS, type CallLogDto } from "@gistroom/shared";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/field";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { pages } from "@/content/app";
import { callCopy as copy } from "@/content/calls";
import { ApiClientError, apiFetch } from "@/lib/api";
import { startCallRequest } from "@/lib/calls/api";
import { formatDuration } from "@/lib/chat/voice";
import { cn } from "@/lib/cn";
import { formatClock, formatDayLabel } from "@/lib/time";

interface LogPage {
  items: CallLogDto[];
  nextCursor: string | null;
  total: number;
}

const outcomeLabel: Record<CallLogDto["outcome"], string> = {
  ANSWERED: copy.logs.answered,
  MISSED: copy.logs.missed,
  DECLINED: copy.logs.declined,
  CANCELLED: copy.logs.cancelled,
  BUSY: copy.logs.busy,
};

function Row({ entry }: { entry: CallLogDto }) {
  const router = useRouter();
  const { showError } = useFeedback();
  const [busy, setBusy] = useState(false);
  const missed = entry.outcome === "MISSED" || entry.outcome === "BUSY";
  const DirIcon = missed
    ? PhoneMissed
    : entry.direction === "INCOMING"
      ? PhoneIncoming
      : PhoneOutgoing;
  const date = new Date(entry.startedAt);

  async function callBack() {
    if (!entry.conversationId) return;
    setBusy(true);
    try {
      const started = await startCallRequest(
        entry.conversationId,
        entry.media === "VIDEO" ? "VIDEO" : "AUDIO",
      );
      router.push(`/app/call/${started.call.id}`);
    } catch (e) {
      showError(e instanceof ApiClientError ? e.message : copy.loadError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex items-center gap-3 px-4 py-3 md:px-6">
      <Avatar name={entry.title} src={entry.peer?.avatarUrl} size={48} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-text">{entry.title}</p>
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-text-muted">
          <span className={cn("inline-flex items-center gap-1", missed && "text-danger-600")}>
            <DirIcon aria-hidden className="size-4" />
            {entry.direction === "INCOMING" ? copy.logs.incoming : copy.logs.outgoing}
            {" · "}
            {outcomeLabel[entry.outcome]}
          </span>
          <span className="inline-flex items-center gap-1">
            {entry.media === "VIDEO" ? (
              <Video aria-hidden className="size-4" />
            ) : (
              <Phone aria-hidden className="size-4" />
            )}
            {entry.media === "VIDEO" ? copy.video : copy.audio}
          </span>
          {entry.durationSec > 0 ? (
            <span className="tabular">{formatDuration(entry.durationSec * 1000)}</span>
          ) : null}
        </p>
      </div>
      <div className="hidden text-right text-sm text-text-muted sm:block">
        <p>{formatDayLabel(date)}</p>
        <p className="tabular">{formatClock(date)}</p>
      </div>
      {entry.conversationId ? (
        <div className="flex shrink-0">
          <button
            type="button"
            aria-label={`${copy.callBack}: ${entry.title}`}
            disabled={busy}
            onClick={() => void callBack()}
            className="flex size-11 items-center justify-center rounded-full text-green-700 hover:bg-green-100 disabled:opacity-50"
          >
            <Phone aria-hidden className="size-5" />
          </button>
          <Link
            href={`/app/chats/${entry.conversationId}`}
            aria-label={`${copy.backToChat}: ${entry.title}`}
            className="flex size-11 items-center justify-center rounded-full text-text hover:bg-surface-2"
          >
            <MessageCircle aria-hidden className="size-5" />
          </Link>
        </div>
      ) : null}
    </li>
  );
}

/** The call log: filters, name search, cursor pagination with Previous and Next, page size and a total. */
export function CallLog() {
  const [media, setMedia] = useState("all");
  const [outcome, setOutcome] = useState("all");
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [limit, setLimit] = useState(String(LIMITS.PAGE_SIZE_DEFAULT));
  // Cursors of the pages we have been through. The last one is the page on screen.
  const [trail, setTrail] = useState<(string | null)[]>([null]);
  const cursor = trail[trail.length - 1] ?? null;

  useEffect(() => {
    const id = window.setTimeout(() => setTerm(q.trim()), 250);
    return () => window.clearTimeout(id);
  }, [q]);
  // Any filter change goes back to the first page.
  useEffect(() => setTrail([null]), [media, outcome, term, limit]);

  const query = useQuery({
    queryKey: ["calls", media, outcome, term, limit, cursor],
    queryFn: () => {
      const p = new URLSearchParams({ limit });
      if (media !== "all") p.set("media", media);
      if (outcome !== "all") p.set("outcome", outcome);
      if (term) p.set("q", term);
      if (cursor) p.set("cursor", cursor);
      return apiFetch<LogPage>(`/api/calls?${p.toString()}`);
    },
    placeholderData: (prev) => prev,
  });

  const filtered = media !== "all" || outcome !== "all" || term !== "";
  const data = query.data;

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-4 md:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedTabs
            label={copy.logs.title}
            value={media}
            onChange={setMedia}
            options={[
              { value: "all", label: copy.logs.all },
              { value: "AUDIO", label: copy.logs.audio },
              { value: "VIDEO", label: copy.logs.video },
            ]}
          />
          <SegmentedTabs
            label={copy.logs.outcomeAll}
            value={outcome}
            onChange={setOutcome}
            options={[
              { value: "all", label: copy.logs.outcomeAll },
              { value: "ANSWERED", label: copy.logs.answered },
              { value: "MISSED", label: copy.logs.missed },
              { value: "DECLINED", label: copy.logs.declined },
            ]}
          />
        </div>
        <div className="relative max-w-md">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
          />
          <Input
            type="search"
            inputMode="search"
            aria-label={copy.logs.searchLabel}
            placeholder={copy.logs.searchPlaceholder}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="rounded-full pl-9"
          />
        </div>
      </div>

      {query.isPending ? (
        <div className="flex flex-col gap-3 p-4">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-12 rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : query.isError && !data ? (
        <div className="flex flex-col items-center gap-3 p-8 text-center">
          <p className="text-text-muted">{copy.logs.loadError}</p>
          <Button variant="secondary" onClick={() => void query.refetch()}>
            {copy.logs.retry}
          </Button>
        </div>
      ) : data && data.items.length === 0 ? (
        filtered ? (
          <div className="flex flex-col items-center gap-3 p-10 text-center">
            <p className="text-text-muted">{copy.logs.emptyFiltered}</p>
            <Button
              variant="secondary"
              onClick={() => {
                setMedia("all");
                setOutcome("all");
                setQ("");
              }}
            >
              {copy.logs.clear}
            </Button>
          </div>
        ) : (
          <EmptyState icon="voice" title={pages.calls.emptyTitle} body={pages.calls.emptyBody} />
        )
      ) : data ? (
        <>
          <ul className={cn("divide-y divide-border", query.isFetching && "opacity-70")}>
            {data.items.map((entry) => (
              <Row key={entry.id} entry={entry} />
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-4 md:px-6">
            <p role="status" className="tabular text-sm text-text-muted">
              {copy.logs.total(data.total)}
            </p>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-text-muted">
                <span>{copy.logs.perPage}</span>
                <Select
                  value={limit}
                  onValueChange={setLimit}
                  options={LIMITS.PAGE_SIZE_OPTIONS.map((n) => ({
                    value: String(n),
                    label: String(n),
                  }))}
                  className="w-20"
                />
              </label>
              <Button
                variant="secondary"
                disabled={trail.length <= 1}
                onClick={() => setTrail((t) => t.slice(0, -1))}
              >
                {copy.logs.previous}
              </Button>
              <Button
                variant="secondary"
                disabled={!data.nextCursor}
                onClick={() => data.nextCursor && setTrail((t) => [...t, data.nextCursor])}
              >
                {copy.logs.next}
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
