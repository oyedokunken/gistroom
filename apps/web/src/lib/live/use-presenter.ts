"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  canCaptureScreen,
  noPresentation,
  presentQuality,
  presentationFromDto,
  presentationRules,
  type PresentAction,
  type PresentDenied,
  type PresentRole,
  type PresentRules,
  type PresentScope,
  type PresentationDto,
  type PresentationState,
  type RoomMemberState,
} from "@gistroom/shared";
import { presentCopy as copy } from "@/content/present";
import { ApiClientError, apiFetch } from "@/lib/api";
import { live, onLiveEvent, useLive, type ScreenCapture } from "@/lib/live/live-session";
import { pushChip } from "@/lib/session/chips";

/**
 * The tab's view of screen sharing for one call or room (D100 to D104). The server decides who may present and holds
 * the one presenter. LiveKit carries the track, and the browser track is the truth for what is on screen. This hook
 * turns both into controls, dialogs and inline notices, and never picks a source for the person: the browser's own
 * picker always opens first. It never falls back to the camera or to audio.
 */

const WARNED_KEY = "gr_present_warned";

export const presentKey = (scope: PresentScope, refId: string) =>
  ["presentation", scope, refId] as const;

const path = (scope: PresentScope, refId: string) =>
  scope === "call"
    ? `/api/calls/${encodeURIComponent(refId)}/present`
    : `/api/rooms/${encodeURIComponent(refId)}/present`;

export const presentApi = {
  read: (scope: PresentScope, refId: string) => apiFetch<PresentationDto>(path(scope, refId)),
  act: (scope: PresentScope, refId: string, action: PresentAction) =>
    apiFetch<PresentationDto>(path(scope, refId), { body: { action } }),
};

/** A per-viewer convenience only, so every read and write is wrapped. */
function warnedBefore(): boolean {
  try {
    return window.localStorage.getItem(WARNED_KEY) === "1";
  } catch {
    return false;
  }
}
function rememberWarned() {
  try {
    window.localStorage.setItem(WARNED_KEY, "1");
  } catch {
    // Without storage the warning simply shows again next time.
  }
}

export type PresentNotice = { tone: "info" | "error"; text: string } | null;
export type PrepareReason = "data-saver" | "weak" | null;

export interface PrepareState {
  reason: PrepareReason;
  resolve: (ok: boolean, remember: boolean) => void;
}

export interface Presenter {
  scope: PresentScope;
  dto: PresentationDto | null;
  rules: PresentRules;
  /** Someone else's screen is on the stage. */
  remoteSharer: string | null;
  /** You are publishing your screen. */
  sharing: boolean;
  starting: boolean;
  presenterName: string | null;
  notice: PresentNotice;
  dismissNotice: () => void;
  /** Dialog state, drawn by `PresentDialogs`. */
  prepare: PrepareState | null;
  busyOpen: boolean;
  setBusyOpen: (open: boolean) => void;
  forceStopOpen: boolean;
  setForceStopOpen: (open: boolean) => void;
  handoffToMe: boolean;
  dismissHandoff: () => void;
  /** Seconds left to answer a request or to start after a handoff. */
  secondsLeft: number | null;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  ask: () => Promise<void>;
  cancelAsk: () => Promise<void>;
  answer: (accept: boolean) => Promise<void>;
  takeOver: () => Promise<void>;
  forceStop: () => Promise<void>;
  /** I asked and am waiting for an answer. */
  waitingFor: string | null;
}

export function useScreenPresenter(args: {
  scope: PresentScope;
  refId: string;
  role: PresentRole | null;
  memberState?: RoomMemberState | null;
  locked?: boolean;
  /** You are inside a live call or room. The state is read from the server from now on. */
  joined: boolean;
  /** The LiveKit connection is up, so a screen can be published. */
  active: boolean;
  dataSaver: boolean;
  /** The role of the person presenting, for the host and moderator rules. Calls leave it out. */
  roleOf?: (userId: string) => PresentRole | null;
}): Presenter {
  const { scope, refId, role, joined, active, dataSaver } = args;
  const queryClient = useQueryClient();
  const key = presentKey(scope, refId);

  const query = useQuery({
    queryKey: key,
    queryFn: () => presentApi.read(scope, refId),
    enabled: joined && Boolean(refId),
    staleTime: 0,
    refetchInterval: (q) => (q.state.data?.requester || q.state.data?.handoffTo ? 3000 : false),
  });
  const dto = query.data ?? null;
  const refetch = query.refetch;
  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: key });
    // The key array is rebuilt each render, so depend on its parts.
  }, [queryClient, scope, refId]);

  const sharer = useLive((s) => s.screenSharer);
  const sharing = useLive((s) => s.localSharing);
  const connected = useLive((s) => s.status === "connected");
  const poor = useLive((s) => s.poorFor10s);
  const peopleCount = useLive((s) => s.participants.length);

  // The server clock gap, so a countdown is right on a device with a wrong clock.
  const [now, setNow] = useState(() => Date.now());
  const state: PresentationState = useMemo(
    () =>
      dto
        ? presentationFromDto(dto, Date.now() - new Date(dto.serverNow).getTime())
        : noPresentation,
    [dto],
  );
  const timed = state.requestExpiresAt !== null || state.handoffExpiresAt !== null;
  useEffect(() => {
    if (!timed) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    setNow(Date.now());
    return () => window.clearInterval(id);
  }, [timed]);

  const meId = dto?.meId ?? "";
  const rules = useMemo(
    () =>
      presentationRules({
        scope,
        role,
        memberState: args.memberState ?? null,
        session: joined ? "LIVE" : "NOT_STARTED",
        locked: args.locked ?? false,
        viewerId: meId,
        state,
        presenterRole: state.presenterId ? (args.roleOf?.(state.presenterId) ?? null) : null,
        now,
      }),
    // roleOf changes identity each render, the people list is what matters and it rerenders this anyway.
    [scope, role, args.memberState, args.locked, joined, meId, state, now],
  );

  const [notice, setNotice] = useState<PresentNotice>(null);
  const [prepare, setPrepare] = useState<PrepareState | null>(null);
  const [busyOpen, setBusyOpen] = useState(false);
  const [forceStopOpen, setForceStopOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [handoffDismissed, setHandoffDismissed] = useState(false);
  const startingRef = useRef(false);
  const lastAction = useRef<{ kind: "accept"; name: string } | null>(null);

  const say = (tone: "info" | "error", text: string) => setNotice({ tone, text });

  const errorText = (e: unknown): string =>
    e instanceof ApiClientError && e.message ? e.message : copy.notice.failed;

  // ----- Hints and LiveKit changes ask for a fresh look -----
  useEffect(() => {
    if (joined) refresh();
  }, [sharer, peopleCount, joined, refresh]);

  // ----- A presentation that I did not end myself -----
  useEffect(() => {
    return onLiveEvent((event) => {
      if (event.type === "participant-left") refresh();
      if (event.type !== "screen-ended") return;
      if (event.cause === "browser") {
        // The browser's own stop button. Tell the server so every participant sees it end.
        void presentApi.act(scope, refId, "stop").catch(() => undefined);
        say("info", copy.notice.browserEnded);
        pushChip({ text: copy.chips.youStopped, kind: "info" });
        refresh();
        return;
      }
      // The server took the turn away. Read why, so the words are right.
      void refetch().then(({ data }) => {
        const handed = lastAction.current;
        lastAction.current = null;
        if (handed) say("info", copy.notice.handedOver(handed.name));
        else if (data?.presenter && data.presenter.id !== data.meId)
          say("info", copy.notice.tookOver(data.presenter.name));
        else say("info", copy.notice.stoppedByMod);
      });
    });
  }, [scope, refId, refetch, refresh]);

  // ----- A presenter row with no track behind it is stale (a reload, a crashed publish). Clear it. -----
  useEffect(() => {
    if (!dto || !active || !connected) return;
    if (dto.presenter?.id !== dto.meId || sharing || startingRef.current) return;
    const id = window.setTimeout(() => {
      if (startingRef.current || live().current === null) return;
      void presentApi
        .act(scope, refId, "stop")
        .catch(() => undefined)
        .finally(refresh);
    }, 4000);
    return () => window.clearTimeout(id);
  }, [dto, active, connected, sharing, scope, refId, refresh]);

  // ----- Chips: who started or stopped, never my own name -----
  const lastPresenter = useRef<string | null>(null);
  const lastName = useRef<string>("");
  useEffect(() => {
    if (!dto) return;
    const now = dto.presenter?.id ?? null;
    const before = lastPresenter.current;
    if (before !== now) {
      if (now && now !== dto.meId && dto.presenter) {
        pushChip({ text: copy.chips.started(dto.presenter.name), kind: "info" });
      } else if (!now && before && before !== dto.meId && lastName.current) {
        pushChip({ text: copy.chips.stopped(lastName.current), kind: "info" });
      }
      lastPresenter.current = now;
    }
    if (dto.presenter) lastName.current = dto.presenter.name;
  }, [dto]);

  // ----- What happened to my request -----
  const asked = useRef<{ name: string; expires: number } | null>(null);
  useEffect(() => {
    if (!dto) return;
    if (dto.requester?.id === dto.meId && dto.presenter) {
      asked.current = {
        name: dto.presenter.name,
        expires: dto.requestExpiresAt ? new Date(dto.requestExpiresAt).getTime() : 0,
      };
      return;
    }
    const was = asked.current;
    if (!was) return;
    asked.current = null;
    if (dto.handoffTo?.id === dto.meId) {
      setHandoffDismissed(false);
      return;
    }
    if (dto.presenter?.id === dto.meId) return;
    const lapsed = Date.now() >= was.expires - 1500;
    say("info", lapsed ? copy.request.expired(was.name) : copy.request.denied(was.name));
  }, [dto]);

  // ----- Actions -----

  const supportNotice = (): boolean => {
    if (typeof navigator === "undefined") return false;
    const support = canCaptureScreen({
      hasGetDisplayMedia: typeof navigator.mediaDevices?.getDisplayMedia === "function",
      isSecureContext: window.isSecureContext,
      coarsePointer: window.matchMedia("(pointer: coarse)").matches,
    });
    if (support.ok) return true;
    say(
      "error",
      support.reason === "MOBILE"
        ? copy.notice.mobile
        : support.reason === "INSECURE"
          ? copy.notice.insecure
          : copy.notice.unsupported,
    );
    return false;
  };

  const deniedNotice = (reason: PresentDenied | null) => {
    if (reason === "ENDED") say("error", copy.notice.ended);
    else if (reason === "HANDOFF_RESERVED") say("info", copy.notice.reserved);
    else say("error", copy.notice.notAllowed);
  };

  const askPrepare = (reason: PrepareReason): Promise<boolean> => {
    // The first-time warning is skipped once chosen. Reduced quality is always explained.
    if (!reason && warnedBefore()) return Promise.resolve(true);
    return new Promise((resolve) => {
      setPrepare({
        reason,
        resolve: (ok, remember) => {
          setPrepare(null);
          if (ok && remember && !reason) rememberWarned();
          resolve(ok);
        },
      });
    });
  };

  const captureText = (outcome: ScreenCapture): string =>
    outcome === "denied"
      ? copy.notice.denied
      : outcome === "unsupported"
        ? copy.notice.unsupported
        : copy.notice.failedBrowser;

  /** Starts a presentation, or takes over one. The browser's picker opens before the server hears anything. */
  const begin = async (action: "start" | "take-over") => {
    if (startingRef.current || sharing) return;
    setNotice(null);
    if (!supportNotice()) return;
    if (action === "start" && !rules.canStart) {
      if (rules.denied === "BUSY") setBusyOpen(true);
      else deniedNotice(rules.denied);
      return;
    }
    if (action === "take-over" && !rules.canTakeOver) return;
    if (!active) {
      say("info", copy.notice.connecting);
      return;
    }

    const reason: PrepareReason = dataSaver ? "data-saver" : poor ? "weak" : null;
    if (!(await askPrepare(reason))) return;

    startingRef.current = true;
    setStarting(true);
    try {
      const outcome = await live().captureScreen(presentQuality(reason !== null));
      if (outcome === "cancelled") return;
      if (outcome !== "ok") {
        say("error", captureText(outcome));
        return;
      }
      try {
        await presentApi.act(scope, refId, action);
      } catch (e) {
        live().discardScreen();
        await refetch();
        if (e instanceof ApiClientError && e.status === 409) setBusyOpen(true);
        else say("error", errorText(e));
        return;
      }
      if (!(await live().publishScreen())) {
        await presentApi.act(scope, refId, "stop").catch(() => undefined);
        say("error", copy.notice.failed);
      }
      refresh();
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  };

  const stop = async () => {
    await live().stopScreen();
    pushChip({ text: copy.chips.youStopped, kind: "info" });
    try {
      await presentApi.act(scope, refId, "stop");
    } catch (e) {
      say("error", errorText(e));
    }
    refresh();
  };

  const ask = async () => {
    setBusyOpen(false);
    try {
      await presentApi.act(scope, refId, "request");
      say("info", copy.request.sent);
    } catch (e) {
      say("error", errorText(e));
    }
    refresh();
  };

  const cancelAsk = async () => {
    await presentApi.act(scope, refId, "cancel-request").catch(() => undefined);
    asked.current = null;
    refresh();
  };

  const answer = async (accept: boolean) => {
    const asker = dto?.requester?.name ?? "";
    try {
      if (accept) {
        lastAction.current = { kind: "accept", name: asker };
        await live().stopScreen();
      }
      await presentApi.act(scope, refId, accept ? "accept" : "decline");
      if (accept) say("info", copy.notice.handedOver(asker));
    } catch (e) {
      lastAction.current = null;
      say("error", errorText(e));
    }
    refresh();
  };

  const forceStop = async () => {
    const who = dto?.presenter?.name ?? "";
    setForceStopOpen(false);
    try {
      await presentApi.act(scope, refId, "force-stop");
      pushChip({ text: copy.chips.forced(who), kind: "mod" });
    } catch (e) {
      say("error", errorText(e));
    }
    refresh();
  };

  const handoffToMe =
    dto?.handoffTo?.id === dto?.meId && Boolean(dto?.handoffTo) && !handoffDismissed && !sharing;
  const waitingFor =
    dto?.requester?.id === dto?.meId && dto?.requester && dto.presenter ? dto.presenter.name : null;

  const target = state.requestExpiresAt ?? state.handoffExpiresAt;
  const secondsLeft = target ? Math.max(0, Math.ceil((target - now) / 1000)) : null;

  return {
    scope,
    dto,
    rules,
    remoteSharer: sharer && !sharing ? sharer : null,
    sharing,
    starting,
    presenterName: dto?.presenter?.name ?? null,
    notice,
    dismissNotice: () => setNotice(null),
    prepare,
    busyOpen,
    setBusyOpen,
    forceStopOpen,
    setForceStopOpen,
    handoffToMe,
    dismissHandoff: () => setHandoffDismissed(true),
    secondsLeft,
    start: () => begin("start"),
    stop,
    ask,
    cancelAsk,
    answer,
    takeOver: async () => {
      setBusyOpen(false);
      await begin("take-over");
    },
    forceStop,
    waitingFor,
  };
}
