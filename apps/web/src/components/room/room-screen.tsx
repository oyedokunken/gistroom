"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  CameraOff,
  Lock,
  LockOpen,
  MessageSquare,
  Mic,
  MicOff,
  PhoneOff,
  ScrollText,
  UserPlus,
  Users,
  VolumeX,
  X,
} from "lucide-react";
import { LANGUAGE_LABELS, canDo, errors, type RoomJoin, type RoomRole } from "@gistroom/shared";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { roomCopy as copy } from "@/content/rooms";
import { ApiClientError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { roomApi } from "@/lib/rooms/api";
import { useRoomStore } from "@/lib/rooms/store";
import { useRoomLiveKit } from "@/lib/rooms/use-room-livekit";
import { formatFull } from "@/lib/time";
import { ParticipantTile } from "./participant-tile";
import { ChatPanel, InvitePanel, LogPanel, PeoplePanel } from "./room-panels";

type Panel = "chat" | "people" | "invite" | "log" | null;
type Block = "FULL" | "LOCKED" | "NOT_INVITED" | "ENDED" | "NOT_STARTED" | null;

function blockFor(e: unknown): Block {
  if (!(e instanceof ApiClientError)) return null;
  if (e.message === errors.roomFull) return "FULL";
  if (e.message === errors.roomLocked) return "LOCKED";
  if (e.message === errors.roomEnded) return "ENDED";
  if (e.message === errors.roomNotStarted) return "NOT_STARTED";
  if (e.status === 403) return "NOT_INVITED";
  return null;
}

function Wall({ art, title, body }: { art: string; title: string; body?: string }) {
  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center px-6 text-center">
      <EmptyState artId={art} title={title} body={body} />
      <Link href="/app/rooms" className={buttonStyles("secondary")}>
        {copy.stage.backToRooms}
      </Link>
    </div>
  );
}

export function RoomScreen({
  slug,
  invite,
  meId,
  dataSaver,
}: {
  slug: string;
  invite: string | null;
  meId: string;
  dataSaver: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { confirm, showError } = useFeedback();
  const view = useQuery({ queryKey: ["room", slug], queryFn: () => roomApi.view(slug, invite) });
  const [join, setJoin] = useState<RoomJoin | null>(null);
  const [joining, setJoining] = useState(false);
  const [block, setBlock] = useState<Block>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const ended = useRoomStore((s) => s.ended[slug]);
  const kicked = useRoomStore((s) => s.kicked[slug]);

  const lk = useRoomLiveKit({
    url: join?.url ?? null,
    token: join?.token ?? null,
    lowData: dataSaver,
  });

  const room = view.data?.state === "OK" ? view.data.room : null;
  const role: RoomRole = join?.role ?? room?.myRole ?? "MEMBER";
  const inRoom = Boolean(join) && !ended && !kicked;

  // Closed or moved out: drop the connection.
  useEffect(() => {
    if (ended || kicked) lk.leave();
    // lk.leave is stable. Only the two flags matter.
  }, [ended, kicked]);

  // One seat per person: a newer connection replaced this one.
  useEffect(() => {
    if (lk.replaced) {
      showError(copy.stage.replacedBody, copy.stage.replacedTitle);
      setJoin(null);
    }
  }, [lk.replaced, showError]);

  async function enter() {
    setJoining(true);
    try {
      setJoin(await roomApi.join(slug, invite));
      setBlock(null);
    } catch (e) {
      const b = blockFor(e);
      if (b) setBlock(b);
      else showError(e instanceof ApiClientError ? e.message : copy.stage.failed);
    } finally {
      setJoining(false);
    }
  }

  async function startNow() {
    try {
      await roomApi.session(slug, "start");
      await queryClient.invalidateQueries({ queryKey: ["room", slug] });
      await enter();
    } catch (e) {
      showError(e instanceof ApiClientError ? e.message : copy.stage.failed);
    }
  }

  async function leave() {
    const ok = await confirm({
      title: copy.stage.leaveTitle,
      message: copy.stage.leaveBody,
      confirmLabel: copy.stage.leave,
      destructive: true,
    });
    if (!ok) return;
    lk.leave();
    await roomApi.session(slug, "leave").catch(() => undefined);
    router.push("/app/rooms");
  }

  async function endForAll() {
    const ok = await confirm({
      title: copy.stage.endTitle,
      message: copy.stage.endBody,
      confirmLabel: copy.stage.end,
      destructive: true,
    });
    if (!ok) return;
    try {
      await roomApi.session(slug, "end");
      lk.leave();
      router.push("/app/rooms");
    } catch (e) {
      showError(e instanceof ApiClientError ? e.message : copy.stage.failed);
    }
  }

  async function muteEveryone() {
    const ok = await confirm({
      title: copy.stage.muteAllTitle,
      message: copy.stage.muteAllBody,
      confirmLabel: copy.stage.muteAll,
    });
    if (!ok) return;
    await roomApi
      .session(slug, "mute-all")
      .catch((e) => showError(e instanceof ApiClientError ? e.message : copy.stage.failed));
  }

  async function toggleLock() {
    if (!room) return;
    try {
      await roomApi.session(slug, room.locked ? "unlock" : "lock");
      await queryClient.invalidateQueries({ queryKey: ["room", slug] });
    } catch (e) {
      showError(e instanceof ApiClientError ? e.message : copy.stage.failed);
    }
  }

  async function toggleCamera() {
    const result = await lk.setCamera(!lk.camOn);
    if (!lk.camOn && result === "blocked") showError(copy.stage.cameraBlocked);
  }

  const people = useMemo(() => {
    const roles = new Map<string, RoomRole>();
    if (room) roles.set(room.host.id, "HOST");
    return lk.participants.map((p) => {
      const id = p.identity.replace(/^user_/, "");
      const r = id === meId ? role : (roles.get(id) ?? null);
      return { p, role: r };
    });
  }, [lk.participants, room, meId, role]);

  // ----- Not in the room yet -----
  if (view.isPending) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <Skeleton className="h-40" />
      </div>
    );
  }
  if (view.data?.state === "NOT_INVITED" || block === "NOT_INVITED") {
    return (
      <Wall art="not-invited" title={copy.stage.notInvitedTitle} body={copy.stage.notInvitedBody} />
    );
  }
  if (
    view.data?.state === "ENDED" ||
    view.data?.state === "MISSING" ||
    block === "ENDED" ||
    ended
  ) {
    return <Wall art="room-ended" title={copy.stage.endedTitle} body={copy.stage.endedBody} />;
  }
  if (kicked) {
    return (
      <Wall art="not-invited" title={copy.stage.notInvitedTitle} body={copy.stage.notInvitedBody} />
    );
  }
  if (view.isError || !room) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 p-8 text-center">
        <p className="text-text-muted">{copy.stage.failed}</p>
        <Button variant="secondary" onClick={() => void view.refetch()}>
          {copy.stage.retry}
        </Button>
      </div>
    );
  }
  if (block === "FULL")
    return <Wall art="room-full" title={copy.stage.fullTitle} body={copy.stage.fullBody} />;
  if (block === "LOCKED")
    return <Wall art="not-invited" title={copy.stage.lockedTitle} body={copy.stage.lockedBody} />;

  if (!inRoom) {
    const scheduled = room.status === "SCHEDULED";
    const host = room.myRole === "HOST";
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-5 px-6 py-16 text-center">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {room.status === "LIVE" ? (
            <Badge tone="yellow">{copy.live}</Badge>
          ) : (
            <Badge>{copy.upcoming}</Badge>
          )}
          {room.visibility === "PRIVATE" ? (
            <Badge>
              <Lock aria-hidden className="mr-1 size-3" />
              Private
            </Badge>
          ) : null}
          {room.locked ? <Badge>{copy.stage.locked}</Badge> : null}
          <span className="text-sm text-text-muted">{LANGUAGE_LABELS[room.language]}</span>
        </div>
        <h1 className="text-3xl font-black tracking-tight text-text">{room.title}</h1>
        {room.description ? (
          <p className="max-w-prose text-text-muted">{room.description}</p>
        ) : null}
        <p className="flex items-center gap-2 text-text-muted">
          <Avatar name={room.host.name} src={room.host.avatarUrl} size={28} />
          {room.host.name}
        </p>
        <p className="tabular text-sm text-text-muted">
          {copy.stage.people(room.joined, room.max)}
        </p>
        {scheduled && room.scheduledFor ? (
          <p className="text-text">
            {copy.stage.startingSoon(formatFull(new Date(room.scheduledFor)))}
          </p>
        ) : null}
        {scheduled && !host ? null : (
          <Button
            className="min-h-12 px-10"
            loading={joining}
            onClick={() => void (scheduled ? startNow() : enter())}
          >
            {joining ? copy.stage.joining : scheduled ? copy.stage.start : copy.stage.join}
          </Button>
        )}
      </div>
    );
  }

  // ----- On the stage -----
  const canMod = canDo(role, "LOCK");
  const panels: { id: Exclude<Panel, null>; label: string; icon: typeof Users; show: boolean }[] = [
    { id: "chat", label: copy.panels.chat, icon: MessageSquare, show: true },
    { id: "people", label: copy.panels.people, icon: Users, show: true },
    { id: "invite", label: copy.panels.invite, icon: UserPlus, show: canDo(role, "INVITE") },
    { id: "log", label: copy.panels.log, icon: ScrollText, show: canDo(role, "SEE_LOG") },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-ink-950 text-white">
      <div ref={lk.audioHost} className="sr-only" aria-hidden />
      <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold">{room.title}</h1>
          <p className="tabular flex items-center gap-2 text-sm text-white/70">
            {copy.stage.people(lk.participants.length, room.max)}
            {room.locked ? (
              <span className="inline-flex items-center gap-1">
                <Lock aria-hidden className="size-3.5" />
                {copy.stage.locked}
              </span>
            ) : null}
          </p>
        </div>
        {canMod ? (
          <>
            <button
              type="button"
              onClick={() => void toggleLock()}
              aria-label={room.locked ? copy.stage.unlock : copy.stage.lock}
              title={room.locked ? copy.stage.unlock : copy.stage.lock}
              className="flex size-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
            >
              {room.locked ? (
                <LockOpen aria-hidden className="size-5" />
              ) : (
                <Lock aria-hidden className="size-5" />
              )}
            </button>
            <button
              type="button"
              onClick={() => void muteEveryone()}
              aria-label={copy.stage.muteAll}
              title={copy.stage.muteAll}
              className="flex size-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
            >
              <VolumeX aria-hidden className="size-5" />
            </button>
          </>
        ) : null}
        {role === "HOST" ? (
          <Button variant="danger" onClick={() => void endForAll()}>
            {copy.stage.end}
          </Button>
        ) : null}
      </header>

      {lk.reconnecting ? (
        <p
          role="status"
          className="bg-yellow-400 px-4 py-2 text-center text-sm font-semibold text-ink-950"
        >
          {copy.stage.reconnecting}
        </p>
      ) : null}
      {lk.failed ? (
        <p role="alert" className="bg-danger-600 px-4 py-2 text-center text-sm font-semibold">
          {copy.stage.failed}
        </p>
      ) : null}
      {lk.micBlocked ? (
        <p
          role="alert"
          className="bg-yellow-400 px-4 py-2 text-center text-sm font-semibold text-ink-950"
        >
          {copy.stage.micBlocked}
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <ul
          className={cn(
            "grid min-h-0 flex-1 auto-rows-min content-center gap-3 overflow-y-auto p-4",
            people.length <= 1
              ? "grid-cols-1 sm:mx-auto sm:max-w-xl"
              : "grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
          )}
        >
          {people.map(({ p, role: r }) => (
            <ParticipantTile
              key={p.identity}
              participant={p}
              speaking={lk.speaking.has(p.identity)}
              roleLabel={
                r === "HOST" ? copy.stage.host : r === "MODERATOR" ? copy.stage.moderator : null
              }
              version={lk.version}
            />
          ))}
        </ul>

        {panel ? (
          <aside
            aria-label={copy.stage.panels}
            className="absolute inset-y-0 right-0 z-10 flex w-full flex-col bg-surface text-text shadow-lift sm:w-96 md:static md:shadow-none"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-lg font-bold">{panels.find((x) => x.id === panel)?.label}</h2>
              <button
                type="button"
                onClick={() => setPanel(null)}
                aria-label={copy.panels.close}
                className="flex size-11 items-center justify-center rounded-full hover:bg-surface-2"
              >
                <X aria-hidden className="size-5" />
              </button>
            </div>
            {panel === "chat" ? <ChatPanel room={room} meId={meId} role={role} /> : null}
            {panel === "people" ? <PeoplePanel room={room} meId={meId} role={role} /> : null}
            {panel === "invite" ? <InvitePanel room={room} /> : null}
            {panel === "log" ? <LogPanel room={room} /> : null}
          </aside>
        ) : null}
      </div>

      <nav
        aria-label={copy.stage.panels}
        className="flex flex-wrap items-center justify-center gap-3 border-t border-white/10 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        <Round
          label={lk.micOn ? copy.stage.mute : copy.stage.unmute}
          pressed={!lk.micOn}
          onClick={() => void lk.toggleMic()}
          disabled={!lk.connected}
        >
          {lk.micOn ? (
            <Mic aria-hidden className="size-6" />
          ) : (
            <MicOff aria-hidden className="size-6" />
          )}
        </Round>
        <Round
          label={lk.camOn ? copy.stage.cameraOff : copy.stage.cameraOn}
          pressed={lk.camOn}
          onClick={() => void toggleCamera()}
          disabled={!lk.connected}
        >
          {lk.camOn ? (
            <Camera aria-hidden className="size-6" />
          ) : (
            <CameraOff aria-hidden className="size-6" />
          )}
        </Round>
        {panels
          .filter((x) => x.show)
          .map((x) => (
            <Round
              key={x.id}
              label={x.label}
              pressed={panel === x.id}
              onClick={() => setPanel(panel === x.id ? null : x.id)}
            >
              <x.icon aria-hidden className="size-6" />
            </Round>
          ))}
        <Round label={copy.stage.leave} tone="danger" onClick={() => void leave()}>
          <PhoneOff aria-hidden className="size-6" />
        </Round>
      </nav>
    </div>
  );
}

function Round({
  label,
  children,
  onClick,
  pressed,
  disabled,
  tone,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  pressed?: boolean;
  disabled?: boolean;
  tone?: "danger";
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex size-14 items-center justify-center rounded-full transition-colors disabled:opacity-50",
        tone === "danger"
          ? "bg-danger-600 text-white"
          : pressed
            ? "bg-yellow-400 text-ink-950"
            : "bg-white/15 text-white hover:bg-white/25",
      )}
    >
      {children}
    </button>
  );
}
