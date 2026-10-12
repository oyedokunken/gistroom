"use client";

import { type CardIconName } from "@/components/public/card-icon";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BellRing,
  Camera,
  CameraOff,
  Lock,
  LockOpen,
  LogOut,
  MessageSquare,
  Mic,
  MicOff,
  NotebookPen,
  PhoneOff,
  ScrollText,
  Settings,
  ShieldAlert,
  SmilePlus,
  UserPlus,
  Users,
  VolumeX,
  X,
} from "lucide-react";
import {
  LANGUAGE_LABELS,
  REACTIONS,
  roomAvatarSrc,
  canDo,
  errors,
  type RoomJoin,
  type RoomRole,
} from "@gistroom/shared";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonStyles } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip } from "@/components/ui/tooltip";
import { roomCopy as copy } from "@/content/rooms";
import { ApiClientError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { roomApi } from "@/lib/rooms/api";
import { useRoomStore } from "@/lib/rooms/store";
import { stageColumns, stageRows } from "@/lib/rooms/grid";
import { useRoomLiveKit } from "@/lib/rooms/use-room-livekit";
import { formatFull } from "@/lib/time";
import { ParticipantTile } from "./participant-tile";
import { EndedRoom } from "./room-summary";
import { NotesPanel } from "@/components/notes/notes-panel";
import {
  ChatPanel,
  InvitePanel,
  LogPanel,
  PeoplePanel,
  SettingsPanel,
  type PersonState,
} from "./room-panels";

type Panel = "chat" | "people" | "notes" | "invite" | "settings" | "log" | null;
type Block = "FULL" | "LOCKED" | "NOT_INVITED" | "ENDED" | "NOT_STARTED" | null;

const LOCK_EXPLAINED_KEY = "gr_lock_explained";
const NO_REACTIONS: readonly never[] = [];

function blockFor(e: unknown): Block {
  if (!(e instanceof ApiClientError)) return null;
  if (e.message === errors.roomFull) return "FULL";
  if (e.message === errors.roomLocked) return "LOCKED";
  if (e.message === errors.roomEnded) return "ENDED";
  if (e.message === errors.roomNotStarted) return "NOT_STARTED";
  if (e.status === 403) return "NOT_INVITED";
  return null;
}

function Wall({ icon, title, body }: { icon: CardIconName; title: string; body?: string }) {
  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center px-6 text-center">
      <EmptyState icon={icon} title={title} body={body} />
      <Link href="/app/discover" className={buttonStyles("secondary")}>
        {copy.stage.browseLive}
      </Link>
    </div>
  );
}

function lockWasExplained(): boolean {
  try {
    return window.localStorage.getItem(LOCK_EXPLAINED_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberLockExplained() {
  try {
    window.localStorage.setItem(LOCK_EXPLAINED_KEY, "1");
  } catch {
    // Without storage the explanation simply shows again next time.
  }
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
  const { confirm, showError, showInfo } = useFeedback();
  const view = useQuery({ queryKey: ["room", slug], queryFn: () => roomApi.view(slug, invite) });
  const [join, setJoin] = useState<RoomJoin | null>(null);
  const [joining, setJoining] = useState(false);
  const [reminding, setReminding] = useState(false);
  const [block, setBlock] = useState<Block>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [muteAllOpen, setMuteAllOpen] = useState(false);
  const [lockUnmute, setLockUnmute] = useState(false);
  const ended = useRoomStore((s) => s.ended[slug]);
  const kicked = useRoomStore((s) => s.kicked[slug]);
  const notice = useRoomStore((s) => s.notice[slug]);
  const floating = useRoomStore((s) => s.floating[slug]) ?? NO_REACTIONS;
  const setNotice = useRoomStore((s) => s.setNotice);
  const dropReaction = useRoomStore((s) => s.dropReaction);

  const room = view.data?.state === "OK" ? view.data.room : null;
  const inRoom = Boolean(join) && !ended && !kicked;

  const members = useQuery({
    queryKey: ["room-members", slug],
    queryFn: () => roomApi.members(slug),
    enabled: inRoom,
  });

  const lk = useRoomLiveKit({
    url: join?.url ?? null,
    token: join?.token ?? null,
    lowData: dataSaver,
    startMuted: Boolean(room?.settings.joinMuted) && (join?.role ?? "MEMBER") === "MEMBER",
  });

  const myMember = members.data?.members.find((m) => m.user.id === meId);
  const role: RoomRole =
    room?.host.id === meId ? "HOST" : (myMember?.role ?? join?.role ?? room?.myRole ?? "MEMBER");

  // A role change while inside is told once, in plain words.
  const lastRole = useRef<RoomRole | null>(null);
  useEffect(() => {
    if (!inRoom) {
      lastRole.current = null;
      return;
    }
    if (!members.data) return;
    if (lastRole.current && lastRole.current !== role) {
      if (role === "MODERATOR") showInfo(copy.stage.nowModerator, copy.stage.roleChangedTitle);
      else if (role === "MEMBER") showInfo(copy.stage.nowMember, copy.stage.roleChangedTitle);
    }
    lastRole.current = role;
  }, [role, inRoom, members.data, showInfo]);

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

  async function toggleGoing(next: boolean) {
    setReminding(true);
    try {
      await roomApi.session(slug, next ? "going" : "not-going");
      await queryClient.invalidateQueries({ queryKey: ["room", slug] });
    } catch (e) {
      showError(e instanceof ApiClientError ? e.message : copy.stage.failed);
    } finally {
      setReminding(false);
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

  async function finishLeaving() {
    lk.leave();
    await roomApi.session(slug, "leave").catch(() => undefined);
    router.push("/app/rooms");
  }

  async function leave() {
    if (role === "HOST") {
      setLeaveOpen(true);
      return;
    }
    const ok = await confirm({
      title: copy.stage.leaveTitle,
      message: copy.stage.leaveBody,
      confirmLabel: copy.stage.leave,
      destructive: true,
    });
    if (ok) await finishLeaving();
  }

  async function handOverAndLeave(userId: string) {
    setLeaveOpen(false);
    try {
      await roomApi.moderate(slug, "TRANSFER", userId);
      await finishLeaving();
    } catch (e) {
      showError(e instanceof ApiClientError ? e.message : copy.stage.failed);
    }
  }

  async function endForAll() {
    setLeaveOpen(false);
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

  async function submitMuteAll() {
    setMuteAllOpen(false);
    await roomApi
      .session(slug, "mute-all", { lockUnmute })
      .then(() => queryClient.invalidateQueries({ queryKey: ["room", slug] }))
      .catch((e) => showError(e instanceof ApiClientError ? e.message : copy.stage.failed));
    setLockUnmute(false);
  }

  async function toggleLock() {
    if (!room) return;
    if (!room.locked && !lockWasExplained()) {
      const ok = await confirm({
        title: copy.stage.lockFirstTitle,
        message: copy.stage.lockFirstBody,
        confirmLabel: copy.stage.lockConfirm,
      });
      if (!ok) return;
      rememberLockExplained();
    }
    try {
      await roomApi.session(slug, room.locked ? "unlock" : "lock");
      await queryClient.invalidateQueries({ queryKey: ["room", slug] });
    } catch (e) {
      showError(e instanceof ApiClientError ? e.message : copy.stage.failed);
    }
  }

  async function toggleCamera() {
    if (!lk.camOn && room && !room.settings.cameraAllowed && role === "MEMBER") {
      showError(copy.stage.cameraNotAllowed);
      return;
    }
    const result = await lk.setCamera(!lk.camOn);
    if (!lk.camOn && result === "blocked") showError(copy.stage.cameraBlocked);
  }

  async function toggleMic() {
    if (!lk.micOn && room?.settings.unmuteLocked && role === "MEMBER") {
      showError(copy.stage.micLockedBody, copy.stage.micLockedTitle);
      return;
    }
    await lk.toggleMic();
  }

  async function sendReaction(emoji: string) {
    try {
      await roomApi.react(slug, emoji);
    } catch (e) {
      showError(e instanceof ApiClientError ? e.message : copy.stage.failed);
    }
  }

  // Who each LiveKit tile belongs to, from the people list the server keeps.
  const byUser = useMemo(() => {
    const map = new Map<string, { role: RoomRole; avatarUrl: string | null }>();
    for (const m of members.data?.members ?? []) {
      map.set(m.user.id, {
        role: m.user.id === room?.host.id ? "HOST" : m.role,
        avatarUrl: m.user.avatarUrl,
      });
    }
    return map;
  }, [members.data, room?.host.id]);

  const people = useMemo(
    () =>
      lk.participants.map((p) => {
        const id = p.identity.replace(/^user_/, "");
        const known = byUser.get(id);
        return {
          p,
          id,
          role: id === meId ? role : (known?.role ?? (room?.host.id === id ? "HOST" : null)),
          avatarUrl: known?.avatarUrl ?? null,
        };
      }),
    [lk.participants, byUser, meId, role, room?.host.id],
  );

  const states = useMemo(() => {
    const out: Record<string, PersonState> = {};
    for (const { p, id } of people)
      out[id] = { mic: p.isMicrophoneEnabled, cam: p.isCameraEnabled };
    return out;
    // version bumps on every track change, which is when these flags move.
  }, [people, lk.version]);

  // The stage grid follows the screen and the number of people, so tiles are as big as they can be.
  const [viewportWidth, setViewportWidth] = useState(1024);
  useEffect(() => {
    const update = () => setViewportWidth(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // ----- Not in the room yet -----
  if (view.isPending) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <Skeleton className="h-40" />
      </div>
    );
  }
  if (view.data?.state === "LINK_INVALID") {
    return (
      <Wall
        icon="private-room"
        title={copy.stage.linkInvalidTitle}
        body={copy.stage.linkInvalidBody}
      />
    );
  }
  if (view.data?.state === "NOT_INVITED" || block === "NOT_INVITED") {
    return (
      <Wall
        icon="private-room"
        title={copy.stage.notInvitedTitle}
        body={copy.stage.notInvitedBody}
      />
    );
  }
  if (
    view.data?.state === "ENDED" ||
    view.data?.state === "MISSING" ||
    block === "ENDED" ||
    ended
  ) {
    return <EndedRoom slug={slug} />;
  }
  if (kicked) {
    return (
      <Wall
        icon="private-room"
        title={kicked === "BANNED" ? copy.stage.bannedTitle : copy.stage.removedTitle}
        body={kicked === "BANNED" ? copy.stage.bannedBody : copy.stage.removedBody}
      />
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
    return <Wall icon="friends" title={copy.stage.fullTitle} body={copy.stage.fullBody} />;
  if (block === "LOCKED")
    return <Wall icon="private-room" title={copy.stage.lockedTitle} body={copy.stage.lockedBody} />;

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
              {copy.create.private}
            </Badge>
          ) : null}
          {room.locked ? <Badge>{copy.stage.locked}</Badge> : null}
          <Badge>{room.media === "VIDEO" ? copy.create.video : copy.create.audio}</Badge>
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
          {copy.stage.peopleOf(room.joined, room.max)}
        </p>
        {room.settings.joinMuted ? (
          <p className="text-sm text-text-muted">{copy.stage.joinMutedNote}</p>
        ) : null}
        {scheduled && room.scheduledFor ? (
          <p className="text-text">
            {copy.stage.startingSoon(formatFull(new Date(room.scheduledFor)))}
          </p>
        ) : null}
        {scheduled && !host ? (
          <div className="flex flex-col items-center gap-2">
            {room.going ? (
              <p className="flex items-center gap-2 font-semibold text-green-700">
                <BellRing aria-hidden className="size-4" />
                {copy.stage.goingTitle}
              </p>
            ) : null}
            <p className="max-w-sm text-sm text-text-muted">
              {room.going ? copy.stage.goingBody : copy.stage.waitingNote}
            </p>
            <Button
              className="min-h-12 px-10"
              variant={room.going ? "secondary" : "primary"}
              loading={reminding}
              onClick={() => void toggleGoing(!room.going)}
            >
              {room.going ? copy.stage.notGoing : copy.stage.remindMe}
            </Button>
          </div>
        ) : (
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
  const moderators = (members.data?.members ?? []).filter(
    (m) => m.role === "MODERATOR" && m.user.id !== meId,
  );
  const panels: { id: Exclude<Panel, null>; label: string; icon: typeof Users; show: boolean }[] = [
    { id: "chat", label: copy.panels.chat, icon: MessageSquare, show: true },
    { id: "people", label: copy.panels.people, icon: Users, show: true },
    { id: "notes", label: copy.panels.notes, icon: NotebookPen, show: true },
    {
      id: "invite",
      label: copy.panels.invite,
      icon: UserPlus,
      show:
        canDo(role, "INVITE") || (room.visibility === "PUBLIC" && room.settings.membersCanShare),
    },
    {
      id: "settings",
      label: copy.panels.settings,
      icon: Settings,
      show: canDo(role, "SETTINGS"),
    },
    { id: "log", label: copy.panels.log, icon: ScrollText, show: canDo(role, "SEE_LOG") },
  ];
  const count = lk.participants.length || room.joined;
  const noticeText =
    notice === "all"
      ? copy.stage.mutedAllByModerator
      : notice === "video"
        ? copy.stage.cameraMutedByModerator
        : copy.stage.mutedByModerator;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-ink-950 text-white">
      <div ref={lk.audioHost} className="sr-only" aria-hidden />
      <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <Avatar name={room.title} src={roomAvatarSrc(room.topicSlug)} size={44} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold">{room.title}</h1>
          <p className="tabular flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/70">
            <span>{copy.stage.people(count)}</span>
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
            <Tooltip content={room.locked ? copy.stage.unlock : copy.stage.lockHint}>
              <button
                type="button"
                onClick={() => void toggleLock()}
                aria-label={room.locked ? copy.stage.unlock : copy.stage.lock}
                className="flex size-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
              >
                {room.locked ? (
                  <LockOpen aria-hidden className="size-5" />
                ) : (
                  <Lock aria-hidden className="size-5" />
                )}
              </button>
            </Tooltip>
            <Tooltip content={copy.stage.muteAll}>
              <button
                type="button"
                onClick={() => setMuteAllOpen(true)}
                aria-label={copy.stage.muteAll}
                className="flex size-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
              >
                <VolumeX aria-hidden className="size-5" />
              </button>
            </Tooltip>
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
            "grid min-h-0 flex-1 gap-3 overflow-y-auto p-3 sm:p-4",
            people.length <= 1 && "mx-auto w-full max-w-4xl",
          )}
          style={{
            gridTemplateColumns: `repeat(${stageColumns(people.length, viewportWidth)}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${stageRows(people.length, stageColumns(people.length, viewportWidth))}, minmax(10rem, 1fr))`,
          }}
        >
          {people.map(({ p, id, role: r, avatarUrl }) => (
            <ParticipantTile
              key={p.identity}
              participant={p}
              speaking={lk.speaking.has(p.identity)}
              roleLabel={
                r === "HOST" ? copy.stage.host : r === "MODERATOR" ? copy.stage.moderator : null
              }
              version={lk.version}
              avatarUrl={avatarUrl}
              reactions={floating.filter((f) => f.userId === id)}
              onReactionDone={(rid) => dropReaction(slug, rid)}
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
            {panel === "people" ? (
              <PeoplePanel room={room} meId={meId} role={role} states={states} count={count} />
            ) : null}
            {panel === "notes" ? <NotesPanel scope={{ roomSlug: room.slug }} /> : null}
            {panel === "invite" ? <InvitePanel room={room} role={role} /> : null}
            {panel === "settings" ? <SettingsPanel room={room} /> : null}
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
          onClick={() => void toggleMic()}
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
        {room.settings.reactionsOn ? (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={copy.stage.reactions}
                title={copy.stage.reactions}
                className="flex size-14 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25"
              >
                <SmilePlus aria-hidden className="size-6" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" align="center" className="p-2">
              <div
                role="group"
                aria-label={copy.stage.reactions}
                className="grid grid-cols-5 gap-1 text-text"
              >
                {REACTIONS.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    aria-label={r.label}
                    onClick={() => void sendReaction(r.emoji)}
                    className="flex size-11 items-center justify-center rounded-full text-2xl hover:bg-green-100"
                  >
                    {r.emoji}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        ) : null}
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

      <Modal
        open={Boolean(notice)}
        onOpenChange={(o) => {
          if (!o) setNotice(slug, undefined);
        }}
        icon={ShieldAlert}
        title={noticeText}
        footer={<Button onClick={() => setNotice(slug, undefined)}>{copy.stage.gotIt}</Button>}
      />

      <Modal
        open={muteAllOpen}
        onOpenChange={setMuteAllOpen}
        icon={VolumeX}
        title={copy.stage.muteAllTitle}
        description={copy.stage.muteAllBody}
        footer={
          <>
            <Button variant="secondary" onClick={() => setMuteAllOpen(false)}>
              {copy.mod.done}
            </Button>
            <Button onClick={() => void submitMuteAll()}>{copy.stage.muteAll}</Button>
          </>
        }
      >
        <div className="flex flex-col gap-1">
          <Checkbox
            label={copy.stage.muteAllLock}
            checked={lockUnmute}
            onChange={(e) => setLockUnmute(e.target.checked)}
          />
          <p className="pl-8 text-sm text-text-muted">{copy.stage.muteAllLockHelp}</p>
        </div>
      </Modal>

      <Modal
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        icon={LogOut}
        title={copy.stage.leaveHostTitle}
        description={copy.stage.leaveHostBody}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setLeaveOpen(false);
                void finishLeaving();
              }}
            >
              {copy.stage.leaveJustLeave}
            </Button>
            <Button variant="danger" onClick={() => void endForAll()}>
              {copy.stage.leaveEndInstead}
            </Button>
          </>
        }
      >
        {moderators.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {moderators.map((m) => (
              <li key={m.user.id}>
                <Button
                  variant="secondary"
                  className="w-full justify-start"
                  onClick={() => void handOverAndLeave(m.user.id)}
                >
                  {copy.stage.leaveHandOver}: {m.user.name}
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-muted">{copy.stage.leaveNoModerators}</p>
        )}
      </Modal>
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
