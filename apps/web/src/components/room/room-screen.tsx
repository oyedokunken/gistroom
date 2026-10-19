"use client";

import { useRouter } from "next/navigation";
import { useEmbedded } from "@/components/call-window/embed";
import { closeWindow } from "@/lib/call-window/store";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, NotebookPen, ScrollText, Settings, UserPlus, Users } from "lucide-react";
import { canDo, type RoomJoin, type RoomRole } from "@gistroom/shared";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { roomCopy as copy } from "@/content/rooms";
import { ApiClientError } from "@/lib/api";
import { roomApi } from "@/lib/rooms/api";
import { useRoomStore } from "@/lib/rooms/store";
import { useRoomLiveKit } from "@/lib/rooms/use-room-livekit";
import { showRoomEnded } from "@/lib/live/room-outcomes";
import { loadPrejoin, type PrejoinPrefs } from "@/lib/session/prefs";
import { useLive } from "@/lib/live/live-session";
import { EndedRoom } from "./room-summary";
import { ControlsBar } from "./screen/controls-bar";
import { LeaveDialog, MuteAllDialog } from "./screen/dialogs";
import { RoomLobby } from "./screen/lobby";
import { SidePanel } from "./screen/side-panel";
import { StageGrid } from "./screen/stage-grid";
import { ModeratorNotice, StageHeader } from "./screen/stage-header";
import {
  type Block,
  type Panel,
  type StagePanel,
  NO_REACTIONS,
  TILES_PER_PAGE,
  Wall,
  blockFor,
  lockWasExplained,
  rememberLockExplained,
} from "./screen/shared";
import { useJoinNotices } from "./screen/use-join-notices";
import { useRoomShortcuts, useViewportWidth } from "./screen/use-stage-input";
import { useStagePeople } from "./screen/use-stage-people";

export function RoomScreen({
  slug,
  invite,
  meId,
  meName,
  meAvatar,
  dataSaver,
}: {
  slug: string;
  invite: string | null;
  meId: string;
  meName: string;
  meAvatar: string | null;
  dataSaver: boolean;
}) {
  const router = useRouter();
  const embedded = useEmbedded();
  /** Back to the room list. In the window the window just closes and the page behind stays where it is. */
  const toRooms = () => {
    if (embedded) closeWindow();
    else router.push("/app/rooms");
  };
  const queryClient = useQueryClient();
  const { confirm, showError, showInfo } = useFeedback();
  const view = useQuery({ queryKey: ["room", slug], queryFn: () => roomApi.view(slug, invite) });
  // The join details live in the room store, so leaving this screen and coming back keeps you in the room.
  const join = useRoomStore((s) => s.joins[slug]) ?? null;
  const setJoin = (value: RoomJoin | null) => useRoomStore.getState().setJoin(slug, value);
  const [joining, setJoining] = useState(false);
  // What was chosen on the check screen, or last time. Read when the connection starts.
  const [prejoin, setPrejoin] = useState<PrejoinPrefs>(() => loadPrejoin());
  const autoTried = useRef(false);
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
    slug,
    title: room?.title ?? "",
    hangUp: async () => {
      await roomApi.session(slug, "leave").catch(() => undefined);
    },
    heartbeat: () => void roomApi.heartbeat(slug),
    beacon: () => {
      navigator.sendBeacon(
        `/api/rooms/${encodeURIComponent(slug)}/session`,
        new Blob([JSON.stringify({ action: "leave" })], { type: "application/json" }),
      );
    },
    url: join?.url ?? null,
    token: join?.token ?? null,
    lowData: dataSaver,
    startMuted:
      (Boolean(room?.settings.joinMuted) && (join?.role ?? "MEMBER") === "MEMBER") || prejoin.muted,
    startWithVideo: !prejoin.cameraOff && (room?.settings.cameraAllowed ?? true),
    micId: prejoin.micId,
    camId: prejoin.camId,
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

  // The live session needs to know who the host is, so a dropped host is noticed.
  useEffect(() => {
    if (room?.host.id && inRoom) useLive.setState({ hostIdentity: `user_${room.host.id}` });
  }, [room?.host.id, inRoom]);

  // After a reload or a short drop the seat is still yours, so the screen takes it back by itself.
  useEffect(() => {
    if (autoTried.current || join || joining || !room?.rejoin || block) return;
    autoTried.current = true;
    void enter();
    // Tried once per visit.
  }, [room?.rejoin, join, joining, block]);

  // People who said "do not ask again" go straight in when the browser already allows the microphone.
  useEffect(() => {
    if (autoTried.current || join || joining || block || !room || room.status !== "LIVE") return;
    if (!prejoin.skip) return;
    autoTried.current = true;
    void (async () => {
      try {
        const status = await navigator.permissions.query({ name: "microphone" as PermissionName });
        if (status.state === "granted") await enter(prejoin);
        else autoTried.current = false;
      } catch {
        autoTried.current = false;
      }
    })();
  }, [prejoin.skip, room?.status, join, joining, block]);

  useJoinNotices({ slug, viewData: view.data, block, join, room, router, embedded });

  // One seat per person: a newer connection replaced this one.
  useEffect(() => {
    if (lk.replaced) setJoin(null);
    // setJoin only writes to the store
  }, [lk.replaced]);

  async function enter(prefs?: PrejoinPrefs) {
    if (prefs) setPrejoin(prefs);
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
    setJoin(null);
    await roomApi.session(slug, "leave").catch(() => undefined);
    toRooms();
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
      message: `${copy.stage.endBody} ${copy.stage.endPeople(lk.participants.length || room?.joined || 0)}`,
      confirmLabel: copy.stage.end,
      destructive: true,
    });
    if (!ok) return;
    try {
      useRoomStore.getState().markSelfEnded(slug);
      await roomApi.session(slug, "end");
      lk.leave();
      setJoin(null);
      void showRoomEnded(slug, { push: (p) => router.push(p) });
      toRooms();
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

  const { people, states } = useStagePeople({ lk, members, room, meId, role });

  // Big rooms show a page of people at a time. The people speaking come first, so they are never on a hidden page.
  const [page, setPage] = useState(0);
  const [mirror, setMirror] = useState(true);
  const quality = useLive((s) => s.quality);
  const localQuality = useLive((s) => s.localQuality);
  const ordered = useMemo(() => {
    const rank = (identity: string, local: boolean) =>
      local ? 0 : lk.speaking.has(identity) ? 1 : 2;
    return [...people].sort(
      (a, b) => rank(a.p.identity, a.p.isLocal) - rank(b.p.identity, b.p.isLocal),
    );
  }, [people, lk.speaking]);
  const pages = Math.max(1, Math.ceil(ordered.length / TILES_PER_PAGE));
  const safePage = Math.min(page, pages - 1);
  const visible = ordered.slice(safePage * TILES_PER_PAGE, (safePage + 1) * TILES_PER_PAGE);

  useRoomShortcuts({ inRoom, toggleMic, toggleCamera });

  // The stage grid follows the screen and the number of people, so tiles are as big as they can be.
  const viewportWidth = useViewportWidth();

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
    return (
      <RoomLobby
        room={room}
        role={role}
        embedded={embedded}
        joining={joining}
        reminding={reminding}
        meName={meName}
        meAvatar={meAvatar}
        onToggleGoing={toggleGoing}
        onStartNow={startNow}
        onJoin={enter}
      />
    );
  }

  // ----- On the stage -----
  const canMod = canDo(role, "LOCK");
  const moderators = (members.data?.members ?? []).filter(
    (m) => m.role === "MODERATOR" && m.user.id !== meId,
  );
  const panels: StagePanel[] = [
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
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-ink-950 text-white">
      <div ref={lk.audioHost} className="sr-only" aria-hidden />
      <StageHeader
        room={room}
        role={role}
        count={count}
        localQuality={localQuality}
        canMod={canMod}
        onToggleLock={toggleLock}
        onMuteAll={() => setMuteAllOpen(true)}
        onEnd={endForAll}
      />
      <ModeratorNotice
        room={room}
        notice={notice}
        onUnmute={() => {
          setNotice(slug, undefined);
          void toggleMic();
        }}
        onDismiss={() => setNotice(slug, undefined)}
      />

      <div className="flex min-h-0 flex-1">
        <StageGrid
          peopleCount={people.length}
          visible={visible}
          viewportWidth={viewportWidth}
          quality={quality}
          mirror={mirror}
          lk={lk}
          floating={floating}
          slug={slug}
          dropReaction={dropReaction}
          page={page}
          pages={pages}
          setPage={setPage}
        />
        {panel ? (
          <SidePanel
            panel={panel}
            label={panels.find((x) => x.id === panel)?.label}
            room={room}
            meId={meId}
            role={role}
            states={states}
            count={count}
            onClose={() => setPanel(null)}
          />
        ) : null}
      </div>

      <ControlsBar
        lk={lk}
        room={room}
        panels={panels}
        panel={panel}
        setPanel={setPanel}
        mirror={mirror}
        setMirror={setMirror}
        toggleMic={toggleMic}
        toggleCamera={toggleCamera}
        sendReaction={sendReaction}
        leave={leave}
      />

      <MuteAllDialog
        open={muteAllOpen}
        onOpenChange={setMuteAllOpen}
        lockUnmute={lockUnmute}
        onLockUnmute={setLockUnmute}
        onSubmit={submitMuteAll}
      />
      <LeaveDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        moderators={moderators}
        onJustLeave={finishLeaving}
        onEnd={endForAll}
        onHandOver={handOverAndLeave}
      />
    </div>
  );
}
