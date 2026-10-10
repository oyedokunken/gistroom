"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./api";

export interface UnreadCounts {
  notifications: number;
  chats: number;
}

const none: UnreadCounts = { notifications: 0, chats: 0 };

/**
 * Unread totals for the rail and tab bar. Refetched on focus, on reconnect and every minute,
 * and nudged immediately by the realtime `badge:update` event once sockets are connected.
 */
export function useUnreadCounts(): UnreadCounts {
  const { data } = useQuery({
    queryKey: ["unread"],
    queryFn: () => apiFetch<UnreadCounts>("/api/unread"),
    refetchInterval: 60_000,
    refetchOnReconnect: true,
  });
  return data ?? none;
}
