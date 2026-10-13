"use client";

import type { CallDto } from "@gistroom/shared";
import { session as copy } from "@/content/session";
import { ApiClientError } from "@/lib/api";
import { startCallRequest } from "@/lib/calls/api";
import { formatDuration } from "@/lib/chat/voice";
import { clearSessionModal, showSessionModal, type SessionAction } from "@/lib/session/modals";

export interface Nav {
  push: (path: string) => void;
}

/** Calls whose ending was already told, so the same ending is never shown twice. */
const told = new Set<string>();

export function callLength(call: CallDto): string {
  if (!call.answeredAt || !call.endedAt) return "0:00";
  return formatDuration(new Date(call.endedAt).getTime() - new Date(call.answeredAt).getTime());
}

/** Calls the person again. A failure is explained by the same dialogs a first call would show. */
export async function callAgain(call: CallDto, nav: Nav): Promise<void> {
  if (!call.conversationId) return;
  try {
    const started = await startCallRequest(call.conversationId, call.media);
    nav.push(`/app/call/${started.call.id}`);
  } catch (e) {
    handleStartCallError(e, call.peer.name, nav, () => void callAgain(call, nav));
  }
}

/** One answer for every way starting a call can fail, in plain words and without naming a block. */
export function handleStartCallError(
  e: unknown,
  name: string,
  _nav: Nav,
  retry?: () => void,
): void {
  const close: SessionAction = { id: "close", label: copy.modal.close, kind: "secondary" };
  if (e instanceof ApiClientError && e.status === 0) {
    showSessionModal({
      id: "call-start-error",
      priority: "disconnected",
      icon: "unplug",
      title: copy.net.cantConnectTitle,
      body: copy.net.cantConnectBody,
      actions: [...(retry ? [{ id: "retry", label: copy.modal.tryAgain, run: retry }] : []), close],
    });
    return;
  }
  if (e instanceof ApiClientError && e.status === 403) {
    showSessionModal({
      id: "call-start-error",
      priority: "ended",
      icon: "phone-off",
      title: copy.call.unreachableTitle(name),
      body: copy.call.unreachableBody,
      actions: [close],
    });
    return;
  }
  if (
    e instanceof ApiClientError &&
    e.status === 409 &&
    /another call|in a room/i.test(e.message)
  ) {
    showSessionModal({
      id: "call-start-error",
      priority: "ended",
      icon: "phone-missed",
      title: copy.call.busyTitle(name),
      body: copy.call.busyBody,
      actions: [close],
    });
    return;
  }
  showSessionModal({
    id: "call-start-error",
    priority: "ended",
    icon: "alert",
    title: copy.net.cantConnectTitle,
    body: e instanceof ApiClientError ? e.message : copy.net.cantConnectBody,
    actions: [close],
  });
}

/**
 * Says how a call ended, once. The caller hears why nobody picked up, and each side hears when the other left. A block
 * or an unfriend only ever says "This call has ended".
 */
export function showCallOutcome(call: CallDto, nav: Nav): void {
  if (told.has(call.id)) return;
  const name = call.peer.name;
  const id = `call-outcome:${call.id}`;
  const outgoing = call.direction === "OUTGOING";
  const close: SessionAction = { id: "close", label: copy.modal.close, kind: "secondary" };
  const again: SessionAction = {
    id: "again",
    label: copy.modal.callAgain,
    run: () => callAgain(call, nav),
  };
  const message: SessionAction = {
    id: "message",
    label: copy.modal.message,
    kind: "secondary",
    run: () => {
      if (call.conversationId) nav.push(`/app/chats/${call.conversationId}`);
    },
  };
  const show = (spec: {
    icon: Parameters<typeof showSessionModal>[0]["icon"];
    title: string;
    body: string;
    actions: SessionAction[];
  }) => {
    told.add(call.id);
    showSessionModal({ id, priority: "ended", ...spec });
  };

  switch (call.status) {
    case "ENDED": {
      if (call.endReason === "blocked") {
        return show({
          icon: "phone-off",
          title: copy.call.neutralEnded,
          body: "",
          actions: [close],
        });
      }
      if (call.endReason === "peer-gone") {
        return show({
          icon: "unplug",
          title: copy.net.peerGoneTitle(name),
          body: copy.net.peerGoneBody,
          actions: [again, message, close],
        });
      }
      if (call.endedBy === "PEER") {
        return show({
          icon: "log-out",
          title: copy.call.peerLeftTitle(name),
          body: copy.call.peerLeftBody(callLength(call)),
          actions: [again, message, close],
        });
      }
      return show({
        icon: "phone-off",
        title: copy.call.endedTitle,
        body: copy.call.endedBody(callLength(call)),
        actions: [{ ...again, label: copy.modal.callBack }, message, close],
      });
    }
    case "DECLINED":
      if (outgoing) {
        return show({
          icon: "phone-missed",
          title: copy.call.declinedTitle(name),
          body: copy.call.declinedBody,
          actions: [again, message, close],
        });
      }
      return;
    case "BUSY":
      if (outgoing) {
        return show({
          icon: "phone-missed",
          title: copy.call.busyTitle(name),
          body: copy.call.busyBody,
          actions: [again, message, close],
        });
      }
      return;
    case "MISSED":
      return outgoing
        ? show({
            icon: "phone-missed",
            title: copy.call.noAnswerTitle(name),
            body: copy.call.noAnswerBody,
            actions: [again, message, close],
          })
        : show({
            icon: "phone-missed",
            title: copy.call.missedTitle(name),
            body: copy.call.missedBody,
            actions: [{ ...again, label: copy.modal.callBack }, message, close],
          });
    case "CANCELLED":
      // The caller hung up while it rang: the person who was being called sees a missed call.
      if (!outgoing) {
        return show({
          icon: "phone-missed",
          title: copy.call.missedTitle(name),
          body: copy.call.missedBody,
          actions: [{ ...again, label: copy.modal.callBack }, message, close],
        });
      }
      return;
    default:
      return;
  }
}

/** A new call starts with a clean slate, so a later call with the same person can be told again. */
export function forgetCallOutcome(callId: string): void {
  told.delete(callId);
  clearSessionModal(`call-outcome:${callId}`);
}
