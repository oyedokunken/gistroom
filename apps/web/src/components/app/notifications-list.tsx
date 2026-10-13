"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, MailOpen, Trash2, Undo2 } from "lucide-react";
import { type NotificationDto, type Page } from "@gistroom/shared";
import {
  DetailActions,
  DetailExtras,
  DetailPanel,
  ICONS,
  isGone,
  str,
  titleOf,
  useNotificationDetail,
} from "@/components/app/notification-detail";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { notices } from "@/content/app";
import { ApiClientError, apiFetch } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useMediaQuery } from "@/lib/use-media-query";
import { formatClock, formatDayLabel } from "@/lib/time";

type Tab = "all" | "unread" | "activity";

function TypeMark({ n }: { n: NotificationDto }) {
  const avatar = str(n, "avatarUrl");
  const name = str(n, "fromName") ?? str(n, "name");
  if (avatar && name) return <Avatar name={name} src={avatar} size={40} />;
  const Icon = ICONS[n.type];
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">
      <Icon aria-hidden className="size-5" />
    </span>
  );
}

/** Below 768 px one column stays, and the detail opens in a modal like before. */
function PhoneDetail({
  id,
  onClose,
  onChange,
}: {
  id: string;
  onClose: () => void;
  onChange: () => void;
}) {
  const q = useNotificationDetail(id);
  const data = q.data;
  const gone = q.isError && isGone(q.error);
  const { title, body } = data ? titleOf(data.notification) : { title: "", body: "" };
  return (
    <Modal
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      icon={data ? ICONS[data.notification.type] : Bell}
      title={data ? title : gone ? notices.gone : notices.detailTitle}
      description={data ? body || undefined : gone ? notices.goneBody : undefined}
      footer={data ? <DetailActions data={data} onChange={onChange} onNavigate={onClose} /> : null}
    >
      {data ? <DetailExtras data={data} /> : q.isPending ? <Skeleton className="h-16" /> : null}
    </Modal>
  );
}

export function NotificationsList() {
  const queryClient = useQueryClient();
  const { confirm, showError, showSuccess } = useFeedback();
  const [tab, setTab] = useState<Tab>("all");
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const wide = useMediaQuery("(min-width: 768px)");
  const selectedId = search.get("n");
  const listRef = useRef<HTMLDivElement>(null);

  /** The selection lives in the address, so a refresh and the back button both work. */
  const select = useCallback(
    (id: string | null, mode: "push" | "replace" = "push") => {
      const next = id ? `${pathname}?n=${encodeURIComponent(id)}` : pathname;
      if (mode === "push") router.push(next, { scroll: false });
      else router.replace(next, { scroll: false });
    },
    [pathname, router],
  );

  const q = useInfiniteQuery({
    queryKey: ["notifications", tab],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      apiFetch<Page<NotificationDto>>(
        `/api/notifications?${tab === "unread" ? "unread=1&" : ""}${tab === "activity" ? "tab=activity&" : ""}${pageParam ? `cursor=${encodeURIComponent(pageParam)}` : ""}`,
      ),
    getNextPageParam: (last) => last.nextCursor,
  });
  const items = useMemo(() => q.data?.pages.flatMap((p) => p.items) ?? [], [q.data]);
  const groups = useMemo(() => {
    const out: { label: string; rows: NotificationDto[] }[] = [];
    for (const n of items) {
      const label = formatDayLabel(new Date(n.createdAt));
      const last = out[out.length - 1];
      if (last?.label === label) last.rows.push(n);
      else out.push({ label, rows: [n] });
    }
    return out;
  }, [items]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    void queryClient.invalidateQueries({ queryKey: ["notification"] });
    void queryClient.invalidateQueries({ queryKey: ["unread"] });
  };

  const fail = (e: unknown) =>
    showError(e instanceof ApiClientError ? e.message : notices.actionFailed);

  function exitSelect() {
    setSelecting(false);
    setPicked(new Set());
  }

  async function markPicked(read: boolean) {
    try {
      await apiFetch(read ? "/api/notifications/read" : "/api/notifications/unread", {
        body: { ids: [...picked] },
      });
      refresh();
      exitSelect();
    } catch (e) {
      fail(e);
    }
  }

  async function deletePicked() {
    const ids = [...picked];
    const ok = await confirm({
      title: notices.deleteTitle(ids.length),
      message: notices.deleteBody(ids.length),
      confirmLabel: notices.deleteConfirm,
      destructive: true,
    });
    if (!ok) return;
    try {
      await apiFetch(`/api/notifications?ids=${ids.map(encodeURIComponent).join(",")}`, {
        method: "DELETE",
        body: {},
      });
      // The one on screen is gone: move to the next one, or the one before it, or the empty state.
      if (selectedId && ids.includes(selectedId)) {
        const at = items.findIndex((n) => n.id === selectedId);
        const ok = (n: NotificationDto) => !ids.includes(n.id) && n.type !== "ACTIVITY";
        const next =
          items.slice(at + 1).find(ok) ?? items.slice(0, Math.max(at, 0)).reverse().find(ok);
        select(wide ? (next?.id ?? null) : null, "replace");
      }
      refresh();
      exitSelect();
    } catch (e) {
      fail(e);
    }
  }

  async function clearAll() {
    const ok = await confirm({
      title: notices.clearTitle,
      message: notices.clearBody,
      confirmLabel: notices.clearConfirm,
      destructive: true,
    });
    if (!ok) return;
    if (selectedId) select(null, "replace");
    await apiFetch(`/api/notifications${tab === "activity" ? "?tab=activity" : ""}`, {
      method: "DELETE",
      body: {},
    }).catch(fail);
    refresh();
  }

  async function undo(n: NotificationDto) {
    try {
      await apiFetch(`/api/notifications/${n.id}/undo`, { body: {} });
      showSuccess(notices.undone);
      refresh();
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    } catch (e) {
      fail(e);
    }
  }

  function openItem(n: NotificationDto) {
    if (n.type === "ACTIVITY") return;
    select(n.id);
  }

  // Opening one marks it read after a second, so skimming past does not clear a list.
  const selectedRow = items.find((n) => n.id === selectedId);
  const selectedUnread = selectedRow ? selectedRow.readAt === null : false;
  useEffect(() => {
    if (!selectedId || !selectedUnread) return;
    const timer = window.setTimeout(() => {
      void apiFetch("/api/notifications/read", { body: { ids: [selectedId] } })
        .then(refresh)
        .catch(() => undefined);
    }, 1000);
    return () => window.clearTimeout(timer);
    // refresh only invalidates queries.
  }, [selectedId, selectedUnread]);

  /** Up and down move through the list, Enter opens what has focus. */
  function onListKey(e: KeyboardEvent) {
    if (!wide || selecting) return;
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const rows = [
      ...(listRef.current?.querySelectorAll<HTMLButtonElement>("button[data-nid]") ?? []),
    ];
    if (rows.length === 0) return;
    const at = rows.findIndex((r) => r === document.activeElement);
    const target =
      rows[Math.min(rows.length - 1, Math.max(0, at + (e.key === "ArrowDown" ? 1 : -1)))];
    if (!target) return;
    e.preventDefault();
    target.focus();
    if (target.dataset.nid) select(target.dataset.nid, "replace");
  }

  // Bound on the element itself: the wrapper is a plain region, not a control.
  const keyRef = useRef(onListKey);
  keyRef.current = onListKey;
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const handler = (e: KeyboardEvent) => keyRef.current(e);
    el.addEventListener("keydown", handler);
    return () => el.removeEventListener("keydown", handler);
  }, []);

  const allPicked = items.length > 0 && picked.size === items.length;

  return (
    <div className="md:grid md:grid-cols-[minmax(340px,400px)_minmax(0,1fr)] md:items-start md:gap-4">
      <div
        ref={listRef}
        role="group"
        aria-label={notices.listLabel}
        data-notifications-list
        className="flex flex-col md:max-h-[calc(100dvh-9rem)] md:overflow-y-auto md:rounded-3xl md:border md:border-border"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <SegmentedTabs
            label={notices.filterLabel}
            value={tab}
            onChange={(v) => {
              setTab(v as Tab);
              exitSelect();
            }}
            options={[
              { value: "all", label: notices.all },
              { value: "unread", label: notices.unread },
              { value: "activity", label: notices.activity },
            ]}
          />
          <div className="flex flex-wrap gap-2">
            {tab !== "activity" ? (
              <Button
                variant="ghost"
                className="border border-border"
                onClick={() => (selecting ? exitSelect() : setSelecting(true))}
              >
                {selecting ? notices.selectDone : notices.select}
              </Button>
            ) : null}
            {tab !== "activity" && !selecting ? (
              <Button
                variant="ghost"
                className="border border-border"
                icon={<CheckCheck aria-hidden className="size-4" />}
                onClick={async () => {
                  await apiFetch("/api/notifications/read", { body: { all: true } }).catch(fail);
                  refresh();
                }}
              >
                {notices.markAllRead}
              </Button>
            ) : null}
            {!selecting ? (
              <Button
                variant="ghost"
                className="border border-border"
                onClick={() => void clearAll()}
              >
                {notices.clearAll}
              </Button>
            ) : null}
          </div>
        </div>

        {selecting ? (
          <div className="flex flex-wrap items-center gap-2 border-y border-border bg-surface-2 px-4 py-2">
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium text-text">
              <input
                type="checkbox"
                checked={allPicked}
                onChange={() => setPicked(allPicked ? new Set() : new Set(items.map((n) => n.id)))}
                className="size-5 accent-green-600"
              />
              {notices.selectAll}
            </label>
            <span className="tabular text-sm text-text-muted">{notices.selected(picked.size)}</span>
            <span className="ml-auto flex flex-wrap gap-2">
              <Button
                variant="secondary"
                disabled={picked.size === 0}
                icon={<MailOpen aria-hidden className="size-4" />}
                onClick={() => void markPicked(true)}
              >
                {notices.markRead}
              </Button>
              <Button
                variant="secondary"
                disabled={picked.size === 0}
                icon={<Bell aria-hidden className="size-4" />}
                onClick={() => void markPicked(false)}
              >
                {notices.markUnread}
              </Button>
              <Button
                variant="danger"
                disabled={picked.size === 0}
                icon={<Trash2 aria-hidden className="size-4" />}
                onClick={() => void deletePicked()}
              >
                {notices.remove}
              </Button>
            </span>
          </div>
        ) : null}

        {tab === "activity" ? (
          <p className="px-4 pb-2 text-sm text-text-muted">{notices.activityNote}</p>
        ) : null}

        {q.isPending ? (
          <div className="flex flex-col gap-3 p-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : q.isError ? (
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-text-muted">{notices.loadError}</p>
            <Button variant="secondary" onClick={() => void q.refetch()}>
              {notices.retry}
            </Button>
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon="alerts"
            title={
              tab === "unread"
                ? notices.emptyUnread
                : tab === "activity"
                  ? notices.emptyActivity
                  : notices.emptyAll
            }
          />
        ) : (
          <>
            {groups.map((g) => (
              <section key={g.label} aria-label={g.label}>
                <h2 className="bg-surface-2 px-4 py-1.5 text-sm font-semibold text-text-muted">
                  {g.label}
                </h2>
                <ul className="divide-y divide-border">
                  {g.rows.map((n) => {
                    const unread = n.readAt === null && n.type !== "ACTIVITY";
                    const { title, body } = titleOf(n);
                    const canUndo =
                      n.type === "ACTIVITY" &&
                      typeof n.payload.undo === "object" &&
                      n.payload.undo !== null;
                    return (
                      <li
                        key={n.id}
                        className={cn(
                          "flex items-center gap-1 px-2 py-1",
                          unread && "bg-green-100/60",
                          wide && n.id === selectedId && "bg-green-100",
                        )}
                      >
                        {selecting ? (
                          <input
                            type="checkbox"
                            aria-label={notices.rowCheck(title)}
                            checked={picked.has(n.id)}
                            onChange={() =>
                              setPicked((s) => {
                                const next = new Set(s);
                                if (next.has(n.id)) next.delete(n.id);
                                else next.add(n.id);
                                return next;
                              })
                            }
                            className="ml-2 size-5 shrink-0 accent-green-600"
                          />
                        ) : null}
                        <button
                          type="button"
                          data-nid={n.type === "ACTIVITY" ? undefined : n.id}
                          aria-current={n.id === selectedId ? "true" : undefined}
                          onClick={() =>
                            selecting
                              ? setPicked((s) => {
                                  const next = new Set(s);
                                  if (next.has(n.id)) next.delete(n.id);
                                  else next.add(n.id);
                                  return next;
                                })
                              : openItem(n)
                          }
                          className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-2xl px-2 py-2 text-left hover:bg-surface-2"
                        >
                          <TypeMark n={n} />
                          <span className="flex min-w-0 flex-col">
                            <span className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "truncate text-text",
                                  unread ? "font-bold" : "font-semibold",
                                )}
                              >
                                {title}
                              </span>
                              {unread ? (
                                <span className="size-2 shrink-0 rounded-full bg-green-600">
                                  <span className="sr-only">{notices.unreadDot}</span>
                                </span>
                              ) : null}
                            </span>
                            {body ? (
                              <span className="line-clamp-2 text-sm text-text-muted">{body}</span>
                            ) : null}
                            <time
                              dateTime={n.createdAt}
                              className="tabular mt-0.5 text-xs text-text-muted"
                            >
                              {formatClock(new Date(n.createdAt))}
                            </time>
                          </span>
                        </button>
                        {canUndo && !selecting ? (
                          <Button
                            variant="ghost"
                            icon={<Undo2 aria-hidden className="size-4" />}
                            onClick={() => void undo(n)}
                          >
                            {notices.undo}
                          </Button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
            {q.hasNextPage ? (
              <div className="flex justify-center p-4">
                <Button
                  variant="secondary"
                  loading={q.isFetchingNextPage}
                  onClick={() => void q.fetchNextPage()}
                >
                  {notices.loadMore}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
      {wide ? (
        <aside
          aria-label={notices.detailLabel}
          data-notification-detail
          className="sticky top-4 max-h-[calc(100dvh-9rem)] overflow-y-auto rounded-3xl border border-border bg-surface"
        >
          {selectedId ? (
            <DetailPanel key={selectedId} id={selectedId} onChange={refresh} />
          ) : (
            <EmptyState icon="alerts" title={notices.pickTitle} body={notices.pickBody} />
          )}
        </aside>
      ) : selectedId ? (
        <PhoneDetail id={selectedId} onClose={() => select(null, "replace")} onChange={refresh} />
      ) : null}
    </div>
  );
}
