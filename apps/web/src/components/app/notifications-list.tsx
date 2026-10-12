"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CheckCheck,
  Clock,
  DoorOpen,
  MailOpen,
  MessageSquare,
  PhoneMissed,
  ShieldCheck,
  Trash2,
  UserPlus,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import {
  notificationCopy,
  pushCopy,
  type FriendRequestDto,
  type NotificationDto,
  type NotificationType,
  type Page,
} from "@gistroom/shared";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { Avatar } from "@/components/ui/avatar";
import { Button, buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { notices } from "@/content/app";
import { ApiClientError, apiFetch } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatClock, formatDayLabel, formatFull } from "@/lib/time";

type Tab = "all" | "unread" | "activity";

const ICONS: Record<NotificationType, LucideIcon> = {
  FRIEND_REQUEST_RECEIVED: UserPlus,
  FRIEND_REQUEST_ACCEPTED: UserPlus,
  DM_MESSAGE: MessageSquare,
  CALL_MISSED: PhoneMissed,
  ROOM_INVITE: DoorOpen,
  ROOM_STARTING: Clock,
  ROOM_ROLE_CHANGED: ShieldCheck,
  ROOM_ENDED: DoorOpen,
  SECURITY_NEW_DEVICE: ShieldCheck,
  REPORT_UPDATE: Bell,
  SYSTEM: Bell,
  ACTIVITY: CheckCheck,
};

const str = (n: NotificationDto, k: string): string | null =>
  typeof n.payload[k] === "string" ? (n.payload[k] as string) : null;

function titleOf(n: NotificationDto): { title: string; body: string } {
  if (n.type === "ACTIVITY") return { title: str(n, "text") ?? pushCopy.activityTitle, body: "" };
  const copy = notificationCopy(n.type, n.payload, n.id);
  return { title: copy.title || pushCopy.genericTitle, body: copy.body };
}

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

async function post(path: string, body: unknown) {
  await apiFetch(path, { body });
}

function Detail({
  n,
  onClose,
  onChange,
}: {
  n: NotificationDto | null;
  onClose: () => void;
  onChange: () => void;
}) {
  const { showError } = useFeedback();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const requestId = n && n.type === "FRIEND_REQUEST_RECEIVED" ? str(n, "requestId") : null;
  // The request itself, not the notification: it knows whether you already answered it.
  const request = useQuery({
    queryKey: ["friend-request", requestId],
    queryFn: () => apiFetch<{ request: FriendRequestDto }>(`/api/friends/requests/${requestId}`),
    enabled: Boolean(requestId),
  });
  if (!n) return null;
  const { title, body } = titleOf(n);
  const roomSlug = str(n, "roomSlug");
  const req = request.data?.request;
  const answered = req ? req.status !== "PENDING" : false;

  async function answer(kind: "accept" | "reject") {
    setBusy(true);
    try {
      await post(`/api/friends/requests/${requestId}/${kind}`, {});
      await queryClient.invalidateQueries({ queryKey: ["friend-request", requestId] });
      onChange();
      void queryClient.invalidateQueries({ queryKey: ["friends"] });
      void queryClient.invalidateQueries({ queryKey: ["requests"] });
    } catch (e) {
      showError(e instanceof ApiClientError ? e.message : notices.actionFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      icon={ICONS[n.type]}
      title={title}
      description={body || undefined}
      footer={
        <>
          {n.type === "FRIEND_REQUEST_RECEIVED" && requestId ? (
            answered ? (
              <Button disabled>
                {req?.status === "ACCEPTED" ? notices.accepted : notices.requestGone}
              </Button>
            ) : (
              <>
                <Button
                  variant="secondary"
                  loading={busy}
                  disabled={!req}
                  onClick={() => void answer("reject")}
                >
                  {notices.decline}
                </Button>
                <Button loading={busy} disabled={!req} onClick={() => void answer("accept")}>
                  {notices.accept}
                </Button>
              </>
            )
          ) : null}
          {n.type === "ROOM_INVITE" || n.type === "ROOM_STARTING" ? (
            <Link href={n.href} onClick={onClose} className={buttonStyles("primary")}>
              {notices.join}
            </Link>
          ) : null}
          {n.type === "ROOM_ENDED" && roomSlug ? (
            <Link href={n.href} onClick={onClose} className={buttonStyles("primary")}>
              {notices.summary}
            </Link>
          ) : null}
          {n.type !== "FRIEND_REQUEST_RECEIVED" &&
          n.type !== "ROOM_INVITE" &&
          n.type !== "ROOM_STARTING" &&
          n.type !== "ROOM_ENDED" ? (
            <Link href={n.href} onClick={onClose} className={buttonStyles("primary")}>
              {notices.open}
            </Link>
          ) : null}
        </>
      }
    >
      {req ? (
        <div className="mb-3 flex items-center gap-3 rounded-2xl bg-surface-2 p-3 text-left">
          <Avatar name={req.user.name} src={req.user.avatarUrl} size={56} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-text">{req.user.name}</p>
            <p className="truncate text-sm text-text-muted">@{req.user.username}</p>
            {req.user.bio ? (
              <p className="mt-1 line-clamp-3 text-sm text-text">{req.user.bio}</p>
            ) : null}
            <Link
              href={`/app/u/${req.user.username}`}
              onClick={onClose}
              className="mt-1 inline-block text-sm font-semibold text-green-700 underline-offset-4 hover:underline"
            >
              {notices.viewProfile}
            </Link>
          </div>
        </div>
      ) : null}
      <time dateTime={n.createdAt} className="tabular block text-center text-sm text-text-muted">
        {formatFull(new Date(n.createdAt))}
      </time>
    </Modal>
  );
}

export function NotificationsList() {
  const queryClient = useQueryClient();
  const { confirm, showError, showSuccess } = useFeedback();
  const [tab, setTab] = useState<Tab>("all");
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<NotificationDto | null>(null);

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
    setOpen(n);
    if (n.readAt === null) {
      void apiFetch("/api/notifications/read", { body: { ids: [n.id] } })
        .then(refresh)
        .catch(() => undefined);
    }
  }

  const allPicked = items.length > 0 && picked.size === items.length;

  return (
    <div className="flex flex-col">
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
      <Detail n={open} onClose={() => setOpen(null)} onChange={refresh} />
    </div>
  );
}
