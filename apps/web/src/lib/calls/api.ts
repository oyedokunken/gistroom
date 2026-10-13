import type { CallJoin, CallMedia } from "@gistroom/shared";
import { apiFetch } from "@/lib/api";

export const startCallRequest = (conversationId: string, media: CallMedia) =>
  apiFetch<CallJoin & { merged: boolean }>("/api/calls", { body: { conversationId, media } });

export const callAction = (
  id: string,
  action: "accept" | "decline" | "cancel" | "end" | "timeout",
) => apiFetch<CallJoin>(`/api/calls/${id}/${action}`, { body: {} });

/** A quiet "still here" while a call is on. A side that stops saying so for a minute counts as gone. */
export const callHeartbeat = (id: string) =>
  apiFetch<{ ok: true }>(`/api/calls/${id}/heartbeat`, { body: {} }).catch(() => undefined);

export const fetchCall = (id: string) => apiFetch<CallJoin>(`/api/calls/${id}`);
