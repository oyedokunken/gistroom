"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CheckCheck,
  Clock,
  DoorOpen,
  MessageSquare,
  PhoneMissed,
  ShieldCheck,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import {
  notificationCopy,
  pushCopy,
  type NotificationDetailDto,
  type NotificationDto,
  type NotificationType,
} from "@gistroom/shared";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { Avatar } from "@/components/ui/avatar";
import { Button, buttonStyles } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { notices } from "@/content/app";
import { ApiClientError, apiFetch } from "@/lib/api";
import { formatFull } from "@/lib/time";

export const ICONS: Record<NotificationType, LucideIcon> = {
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

export const str = (n: NotificationDto, k: string): string | null =>
  typeof n.payload[k] === "string" ? (n.payload[k] as string) : null;

export function titleOf(n: NotificationDto): { title: string; body: string } {
  if (n.type === "ACTIVITY") return { title: str(n, "text") ?? pushCopy.activityTitle, body: "" };
  const copy = notificationCopy(n.type, n.payload, n.id);
  return { title: copy.title || pushCopy.genericTitle, body: copy.body };
}

/** One notification and what is true behind it now. A missing one is a state, not an error. */
export function useNotificationDetail(id: string | null) {
  return useQuery({
    queryKey: ["notification", id],
    queryFn: () => apiFetch<NotificationDetailDto>(`/api/notifications/${id}`),
    enabled: Boolean(id),
    retry: (count, error) =>
      !(error instanceof ApiClientError && error.status === 404) && count < 2,
  });
}

export function isGone(error: unknown): boolean {
  return error instanceof ApiClientError && error.status === 404;
}

/** The person card, the room line and the time. Shared by the side panel and the phone modal. */
export function DetailExtras({ data }: { data: NotificationDetailDto }) {
  const { notification: n, state } = data;
  const req = state.friendRequest;
  return (
    <>
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
              className="mt-1 inline-block text-sm font-semibold text-green-700 underline-offset-4 hover:underline"
            >
              {notices.viewProfile}
            </Link>
          </div>
        </div>
      ) : null}
      {state.room ? (
        <p className="mb-3 text-sm text-text-muted">
          {state.room.status === "LIVE"
            ? notices.roomLive
            : state.room.status === "ENDED"
              ? notices.roomEnded
              : notices.roomScheduled}
        </p>
      ) : null}
      <time dateTime={n.createdAt} className="tabular block text-sm text-text-muted">
        {formatFull(new Date(n.createdAt))}
      </time>
    </>
  );
}

/** The buttons, worked out from the current server state and never from the payload that was saved. */
export function DetailActions({
  data,
  onChange,
  onNavigate,
}: {
  data: NotificationDetailDto;
  onChange: () => void;
  onNavigate?: () => void;
}) {
  const { showError } = useFeedback();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const { notification: n, state } = data;
  const requestId = str(n, "requestId");
  const req = state.friendRequest;

  async function answer(kind: "accept" | "reject") {
    setBusy(true);
    try {
      await apiFetch(`/api/friends/requests/${requestId}/${kind}`, { body: {} });
      onChange();
      void queryClient.invalidateQueries({ queryKey: ["friends"] });
      void queryClient.invalidateQueries({ queryKey: ["requests"] });
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    } catch (e) {
      showError(e instanceof ApiClientError ? e.message : notices.actionFailed);
    } finally {
      setBusy(false);
    }
  }

  if (n.type === "FRIEND_REQUEST_RECEIVED") {
    if (!req) return <p className="text-sm text-text-muted">{notices.requestGone}</p>;
    if (req.status === "ACCEPTED") {
      return (
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-semibold text-text">{notices.nowFriends}</p>
          {req.conversationId ? (
            <Link
              href={`/app/chats/${req.conversationId}`}
              onClick={onNavigate}
              className={buttonStyles("primary")}
            >
              {notices.message}
            </Link>
          ) : null}
        </div>
      );
    }
    if (req.status !== "PENDING")
      return <p className="text-sm text-text-muted">{notices.requestGone}</p>;
    return (
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" loading={busy} onClick={() => void answer("reject")}>
          {notices.decline}
        </Button>
        <Button loading={busy} onClick={() => void answer("accept")}>
          {notices.accept}
        </Button>
      </div>
    );
  }
  if (n.type === "ROOM_INVITE" || n.type === "ROOM_STARTING") {
    // A room that already ended has nothing to join. Its summary is the useful door.
    const ended = state.room?.status === "ENDED";
    return (
      <Link href={n.href} onClick={onNavigate} className={buttonStyles("primary")}>
        {ended ? notices.summary : notices.join}
      </Link>
    );
  }
  if (n.type === "ROOM_ENDED") {
    return (
      <Link href={n.href} onClick={onNavigate} className={buttonStyles("primary")}>
        {notices.summary}
      </Link>
    );
  }
  return (
    <Link href={n.href} onClick={onNavigate} className={buttonStyles("primary")}>
      {notices.open}
    </Link>
  );
}

/** The right column on a wide screen. It scrolls on its own, so it stays in view while the list moves. */
export function DetailPanel({ id, onChange }: { id: string; onChange: () => void }) {
  const q = useNotificationDetail(id);
  if (q.isPending) {
    return (
      <div className="flex flex-col gap-3 p-6" aria-busy="true">
        <Skeleton className="h-12 w-12 rounded-full" />
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-20" />
      </div>
    );
  }
  if (q.isError) {
    if (isGone(q.error)) {
      return (
        <div className="flex flex-col gap-1 p-6" role="status">
          <h2 className="text-lg font-bold text-text">{notices.gone}</h2>
          <p className="text-text-muted">{notices.goneBody}</p>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-start gap-3 p-6">
        <p className="text-text-muted">{notices.loadError}</p>
        <Button variant="secondary" onClick={() => void q.refetch()}>
          {notices.retry}
        </Button>
      </div>
    );
  }
  const data = q.data;
  const { title, body } = titleOf(data.notification);
  const Icon = ICONS[data.notification.type];
  return (
    <article className="flex flex-col gap-4 p-6" aria-labelledby="notification-detail-title">
      <span className="flex size-12 items-center justify-center rounded-full bg-green-100 text-green-700">
        <Icon aria-hidden className="size-6" />
      </span>
      <div>
        <h2 id="notification-detail-title" className="text-xl font-bold text-text">
          {title}
        </h2>
        {body ? <p className="mt-1 text-text-muted">{body}</p> : null}
      </div>
      <DetailExtras data={data} />
      <DetailActions data={data} onChange={onChange} />
    </article>
  );
}
