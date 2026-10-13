"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LIMITS } from "@gistroom/shared";
import { session as copy } from "@/content/session";
import { apiFetch } from "@/lib/api";
import { openCall, openRoom } from "@/lib/call-window/store";
import { useCallStore } from "@/lib/calls/store";
import { showCallOutcome } from "@/lib/live/call-outcomes";
import { live, onLiveEvent, useLive } from "@/lib/live/live-session";
import { showRoomEnded } from "@/lib/live/room-outcomes";
import { permissionSteps } from "@/lib/session/browser";
import { NET, NETWORK_WEAK_AS_MODAL } from "@/lib/session/config";
import { useConnection } from "@/lib/session/connection";
import { clearSessionModal, showSessionModal, type SessionAction } from "@/lib/session/modals";
import { reportSessionEvent } from "@/lib/session/report";
import { useHeld, useNow } from "@/lib/session/use-held";
import { useRoomStore } from "@/lib/rooms/store";

const MINUTE = 60_000;

/**
 * Watches the live connection and the line, and says so in the right way: a quiet banner for what may fix itself, a
 * dialog for what stops or changes the session. One dialog at a time (the manager sorts them), nothing flickers
 * (every condition has to hold for 3 seconds and clear for 2), and every dialog closes by itself when the cause is
 * gone. Each time one appears the server logs its reason code.
 */
export function LiveWatcher() {
  const conn = useConnection();
  const s = useLive();
  const router = useRouter();
  const pathname = usePathname();
  const kicked = useRoomStore((r) => r.kicked);
  const ended = useRoomStore((r) => r.ended);
  const updates = useCallStore((c) => c.updates);
  const screenId = useCallStore((c) => c.screenId);

  const active = s.kind !== null && s.status !== "idle";
  const inCall = s.kind === "call";
  const now = useNow(active);
  const nav = { push: (path: string) => router.push(path) };
  const navRef = useRef(nav);
  navRef.current = nav;

  const show = (spec: Parameters<typeof showSessionModal>[0]) => {
    showSessionModal(spec);
    reportSessionEvent(spec.id, s.kind ?? undefined);
  };
  const leaveAction = (label: string = copy.modal.leave): SessionAction => ({
    id: "leave",
    label,
    kind: "secondary",
    run: async () => {
      await live().hangUp();
    },
  });
  const rejoin = () => {
    const kind = s.kind;
    const ref = s.refId;
    const slug = kind === "room" ? ref : null;
    live().leave();
    if (slug) useRoomStore.getState().setJoin(slug, null);
    // The same call or room opens again in the window, on whatever page this is.
    if (kind === "call" && ref) openCall(ref);
    else if (slug) openRoom(slug);
  };

  // ----- Offline during a call or room, then disconnected after a minute -----
  const heldOffline = useHeld(active && conn.state === "OFFLINE");
  const offlineFor = heldOffline ? now - conn.since : 0;
  const offlineLong = heldOffline && offlineFor >= NET.offlineToDisconnectedMs;
  useEffect(() => {
    if (heldOffline && !offlineLong) {
      show({
        id: "net-offline",
        priority: "offline",
        icon: "wifi-off",
        title: copy.net.offlineTitle,
        body: copy.net.offlineBody,
        counter: { since: conn.since, label: copy.net.trying },
        actions: [leaveAction()],
      });
    } else {
      clearSessionModal("net-offline", { back: heldOffline ? undefined : copy.back });
    }
  }, [heldOffline, offlineLong, conn.since]);

  // ----- Reconnecting -----
  const heldReconnect = useHeld(active && s.status === "reconnecting" && !heldOffline);
  useEffect(() => {
    if (heldReconnect) {
      show({
        id: "net-reconnecting",
        priority: "offline",
        icon: "refresh",
        title: copy.net.reconnectingTitle,
        body: copy.net.reconnectingBody,
        actions: [leaveAction()],
      });
    } else {
      clearSessionModal("net-reconnecting", { back: copy.back });
    }
  }, [heldReconnect]);

  // ----- Disconnected for good: the line was gone too long, or LiveKit dropped us -----
  const dropped = active && s.status === "disconnected" && s.disconnectReason === "other";
  useEffect(() => {
    if (dropped || offlineLong) {
      show({
        id: "net-disconnected",
        priority: "disconnected",
        icon: "unplug",
        title: copy.net.disconnectedTitle,
        body: copy.net.disconnectedBody,
        actions: [{ id: "rejoin", label: copy.modal.rejoin, run: rejoin }, leaveAction()],
      });
    } else {
      clearSessionModal("net-disconnected");
    }
  }, [dropped, offlineLong]);

  // ----- Could not connect at all, or this browser cannot -----
  const failed = active && s.status === "failed" && !s.unsupported;
  useEffect(() => {
    if (failed) {
      show({
        id: "net-cant-connect",
        priority: "disconnected",
        icon: "alert",
        title: copy.net.cantConnectTitle,
        body: copy.net.cantConnectBody,
        actions: [
          { id: "retry", label: copy.modal.tryAgain, closes: true, run: () => live().retry() },
          { id: "close", label: copy.modal.close, kind: "secondary", run: () => live().leave() },
        ],
      });
    } else {
      clearSessionModal("net-cant-connect");
    }
  }, [failed]);

  const unsupported = active && s.unsupported;
  useEffect(() => {
    if (unsupported) {
      show({
        id: "unsupported-browser",
        priority: "blocked",
        icon: "external",
        title: copy.unsupported.title,
        body: copy.unsupported.body,
        steps: copy.unsupported.steps,
        actions: [
          {
            id: "copy",
            label: copy.unsupported.copy,
            closes: false,
            run: async () => {
              await navigator.clipboard?.writeText(window.location.href).catch(() => undefined);
            },
          },
          {
            id: "open",
            label: copy.unsupported.open,
            closes: false,
            run: () => {
              window.open(window.location.href, "_blank", "noopener");
            },
          },
          { id: "close", label: copy.modal.close, kind: "secondary", run: () => live().leave() },
        ],
      });
    } else {
      clearSessionModal("unsupported-browser");
    }
  }, [unsupported]);

  // ----- Our server cannot be reached while the device is online -----
  const heldServer = useHeld(active && conn.serverError && conn.state !== "OFFLINE");
  useEffect(() => {
    if (heldServer) {
      show({
        id: "net-server",
        priority: "offline",
        icon: "alert",
        title: copy.net.serverTitle,
        body: copy.net.serverBody,
        actions: [{ id: "close", label: copy.modal.close, kind: "secondary" }],
      });
    } else {
      clearSessionModal("net-server", { back: copy.back });
    }
  }, [heldServer]);

  // ----- The sign in is gone while on a call or in a room -----
  useEffect(() => {
    if (!active) return;
    const onUnauthorized = async () => {
      // Make sure, the way the chat connection does, before telling anyone they are signed out.
      const res = await fetch("/api/auth/session", { credentials: "same-origin" }).catch(
        () => null,
      );
      if (!res || res.status !== 401) return;
      show({
        id: "session-expired",
        priority: "disconnected",
        icon: "lock",
        title: copy.account.expiredTitle,
        body: copy.account.expiredBody,
        actions: [
          {
            id: "signin",
            label: copy.modal.signIn,
            run: () => router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`),
          },
          leaveAction(),
        ],
      });
    };
    window.addEventListener("gr:unauthorized", onUnauthorized);
    return () => window.removeEventListener("gr:unauthorized", onUnauthorized);
  }, [active, s.refId]);

  // ----- Joined from another device -----
  const duplicate = s.disconnectReason === "duplicate";
  useEffect(() => {
    if (duplicate) {
      show({
        id: "duplicate-session",
        priority: "disconnected",
        icon: "smartphone",
        title: copy.account.duplicateTitle,
        body: copy.account.duplicateBody,
        actions: [
          { id: "close", label: copy.modal.close, kind: "secondary", run: () => live().leave() },
        ],
      });
    }
  }, [duplicate]);

  // ----- Audio blocked by the browser: one tap fixes it -----
  const audioBlocked = active && s.audioBlocked && s.status === "connected";
  useEffect(() => {
    if (audioBlocked) {
      show({
        id: "audio-blocked",
        priority: "blocked",
        icon: "volume",
        title: copy.devices.audioTitle,
        body: copy.devices.audioBody,
        actions: [
          { id: "enable", label: copy.devices.enableAudio, run: () => live().enableAudio() },
        ],
      });
    } else {
      clearSessionModal("audio-blocked");
    }
  }, [audioBlocked]);

  // ----- Microphone and camera -----
  const micIssue = active ? s.micIssue : null;
  useEffect(() => {
    if (micIssue) {
      const body =
        micIssue === "denied"
          ? copy.devices.micDenied
          : micIssue === "busy"
            ? copy.devices.micBusy
            : copy.devices.micMissing;
      show({
        id: "mic-blocked",
        priority: "blocked",
        icon: "mic-off",
        title: copy.devices.micTitle,
        body,
        steps: micIssue === "denied" ? permissionSteps(navigator.userAgent) : undefined,
        actions: [
          { id: "retry", label: copy.modal.tryAgain, run: () => live().resumeMic() },
          s.kind === "room"
            ? {
                id: "listen",
                label: copy.devices.continueListening,
                kind: "secondary",
                run: () => useLive.setState({ micIssue: null }),
              }
            : leaveAction(),
        ],
      });
    } else {
      clearSessionModal("mic-blocked");
    }
  }, [micIssue]);

  const camIssue = active ? s.camIssue : null;
  useEffect(() => {
    if (camIssue) {
      const detail =
        camIssue === "denied"
          ? copy.devices.camDenied
          : camIssue === "busy"
            ? copy.devices.camBusy
            : copy.devices.camMissing;
      show({
        id: "cam-blocked",
        priority: "blocked",
        icon: "video-off",
        title: copy.devices.camTitle,
        body: `${copy.devices.camBody} ${detail}`,
        steps: camIssue === "denied" ? permissionSteps(navigator.userAgent) : undefined,
        actions: [
          {
            id: "retry",
            label: copy.modal.tryAgain,
            run: async () => void (await live().setCamera(true)),
          },
          {
            id: "close",
            label: copy.modal.close,
            kind: "secondary",
            run: () => useLive.setState({ camIssue: null }),
          },
        ],
      });
    } else {
      clearSessionModal("cam-blocked");
    }
  }, [camIssue]);

  // ----- A phone paused the microphone while the tab was hidden -----
  const paused = active && s.micPausedInBackground;
  useEffect(() => {
    if (paused) {
      show({
        id: "tab-backgrounded",
        priority: "info",
        icon: "mic-off",
        title: copy.devices.pausedTitle,
        body: copy.devices.pausedBody,
        actions: [
          { id: "unmute", label: copy.devices.unmute, run: () => live().resumeMic() },
          {
            id: "close",
            label: copy.modal.close,
            kind: "secondary",
            run: () => live().dismissMicPause(),
          },
        ],
      });
    } else {
      clearSessionModal("tab-backgrounded");
    }
  }, [paused]);

  // ----- The other person in a 1:1 call dropped -----
  const peerLostSince = inCall ? s.peerLostSince : null;
  const peerGone =
    peerLostSince !== null && now - peerLostSince >= LIMITS.CALL_PEER_GONE_SEC * 1000;
  useEffect(() => {
    if (peerLostSince !== null && !peerGone) {
      show({
        id: "net-peer-lost",
        priority: "offline",
        icon: "unplug",
        title: copy.net.peerLostTitle(s.title),
        body: copy.net.peerLostBody,
        counter: { since: peerLostSince, label: (t) => t },
        actions: [
          { id: "hangup", label: copy.modal.hangUp, kind: "danger", run: () => live().hangUp() },
        ],
      });
    } else {
      clearSessionModal("net-peer-lost", { back: peerGone ? undefined : copy.back });
    }
  }, [peerLostSince !== null, peerGone]);
  useEffect(() => {
    if (!peerGone) return;
    const name = s.title;
    void live().hangUp();
    show({
      id: "call-peer-gone",
      priority: "ended",
      icon: "unplug",
      title: copy.net.peerGoneTitle(name),
      body: copy.net.peerGoneBody,
      actions: [{ id: "close", label: copy.modal.close, kind: "secondary" }],
    });
  }, [peerGone]);

  // ----- Weak line, when it is asked to be a dialog -----
  const weakModal = NETWORK_WEAK_AS_MODAL && active && s.poorFor10s;
  useEffect(() => {
    if (weakModal) {
      show({
        id: "net-weak",
        priority: "info",
        icon: "wifi-off",
        title: copy.net.reconnectingTitle,
        body: inCall ? copy.net.weak : copy.net.weakRoom,
        actions: [
          {
            id: "audio",
            label: copy.net.switchAudio,
            run: async () => void (await live().setCamera(false)),
          },
          { id: "dismiss", label: copy.modal.dismiss, kind: "secondary" },
        ],
      });
    } else {
      clearSessionModal("net-weak");
    }
  }, [weakModal]);

  // ----- The call or room ended or I was removed while the screen is somewhere else -----
  useEffect(() => {
    return onLiveEvent((e) => {
      if (e.type !== "disconnected") return;
      const slug = useLive.getState().refId;
      if (useLive.getState().kind !== "room" || !slug) return;
      if (e.reason === "removed") {
        const banned = useRoomStore.getState().kicked[slug] === "BANNED";
        show({
          id: `room-removed:${slug}`,
          priority: "removed",
          icon: "log-out",
          title: banned ? copy.room.bannedTitle : copy.room.removedTitle,
          body: banned ? copy.room.bannedBody : copy.room.removedBody,
          actions: [
            {
              id: "browse",
              label: copy.modal.browseRooms,
              run: () => router.push("/app/rooms"),
            },
            { id: "close", label: copy.modal.close, kind: "secondary" },
          ],
        });
      } else if (e.reason === "ended") {
        void showRoomEnded(slug, navRef.current);
      }
    });
  }, []);

  // The host ended the room and the socket said so.
  useEffect(() => {
    for (const slug of Object.keys(ended)) {
      if (s.refId === slug || pathname === `/app/rooms/${slug}`) {
        void showRoomEnded(slug, navRef.current);
        if (s.refId === slug) live().leave();
      }
    }
  }, [ended]);

  // A removal told over the socket, so a ban reads as a ban.
  useEffect(() => {
    for (const [slug, state] of Object.entries(kicked)) {
      if (s.refId !== slug && pathname !== `/app/rooms/${slug}`) continue;
      show({
        id: `room-removed:${slug}`,
        priority: "removed",
        icon: "log-out",
        title: state === "BANNED" ? copy.room.bannedTitle : copy.room.removedTitle,
        body: state === "BANNED" ? copy.room.bannedBody : copy.room.removedBody,
        actions: [
          { id: "browse", label: copy.modal.browseRooms, run: () => router.push("/app/rooms") },
          { id: "close", label: copy.modal.close, kind: "secondary" },
        ],
      });
      if (s.refId === slug) live().leave();
    }
  }, [kicked]);

  // The other person ended or left the call I am in, and the call screen is not the one open.
  useEffect(() => {
    for (const call of Object.values(updates)) {
      if (call.status === "RINGING" || call.status === "ACTIVE") continue;
      const mine = (s.kind === "call" && s.refId === call.id) || screenId === call.id;
      if (!mine) continue;
      showCallOutcome(call, navRef.current);
      if (s.kind === "call" && s.refId === call.id) live().leave();
    }
  }, [updates]);

  // The long room warning for the host and moderators.
  useEffect(() => {
    if (s.kind !== "room" || !s.refId) return;
    const slug = s.refId;
    const check = async () => {
      try {
        const view = await apiFetch<{
          state: string;
          room?: { startedAt: string | null; myRole: string | null };
        }>(`/api/rooms/${encodeURIComponent(slug)}`);
        const room = view.room;
        if (!room?.startedAt || (room.myRole !== "HOST" && room.myRole !== "MODERATOR")) return;
        const left =
          LIMITS.ROOM_MAX_DURATION_HOURS * 3_600_000 -
          (Date.now() - new Date(room.startedAt).getTime());
        if (left > 0 && left <= 15 * MINUTE) {
          show({
            id: `room-long:${slug}`,
            priority: "info",
            icon: "clock",
            title: copy.room.longTitle,
            body: copy.room.longBody,
            actions: [{ id: "ok", label: copy.modal.close, kind: "secondary" }],
          });
        }
      } catch {
        // The warning is a kindness. Missing it once is fine.
      }
    };
    void check();
    const id = window.setInterval(() => void check(), 5 * MINUTE);
    return () => window.clearInterval(id);
  }, [s.kind, s.refId]);

  return null;
}
