import type { CallJoin, CallMedia } from "@gistroom/shared";
import { apiFetch } from "@/lib/api";
import { StartCancelled, confirmLeaveCurrent } from "@/lib/call-window/store";

export async function startCallRequest(conversationId: string, media: CallMedia) {
  // Already in a room or another call: ask before ringing anyone.
  if (!(await confirmLeaveCurrent("call"))) throw new StartCancelled();
  return apiFetch<CallJoin & { merged: boolean }>("/api/calls", {
    body: { conversationId, media },
  });
}

export const callAction = (
  id: string,
  action: "accept" | "decline" | "cancel" | "end" | "timeout",
) => apiFetch<CallJoin>(`/api/calls/${id}/${action}`, { body: {} });

/** A quiet "still here" while a call is on. A side that stops saying so for a minute counts as gone. */
export const callHeartbeat = (id: string) =>
  apiFetch<{ ok: true }>(`/api/calls/${id}/heartbeat`, { body: {} }).catch(() => undefined);

export const fetchCall = (id: string) => apiFetch<CallJoin>(`/api/calls/${id}`);
