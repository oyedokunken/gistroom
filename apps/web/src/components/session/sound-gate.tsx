"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { inQuietHours, type NotificationPrefs } from "@gistroom/shared";
import { apiFetch } from "@/lib/api";
import { setQuietCheck, sounds } from "@/lib/sound/sounds";

/**
 * Tells the sound manager when the person's quiet hours are on, so sounds stay silent in them. It also makes sure no
 * loop outlives the page: leaving the app stops any ring.
 */
export function SoundGate() {
  const prefs = useQuery({
    queryKey: ["notification-prefs"],
    queryFn: () => apiFetch<{ prefs: NotificationPrefs }>("/api/notifications/preferences"),
    staleTime: 5 * 60_000,
  });
  const start = prefs.data?.prefs.quietStart ?? null;
  const end = prefs.data?.prefs.quietEnd ?? null;

  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Lagos";
    setQuietCheck(() => inQuietHours(new Date(), zone, start, end));
  }, [start, end]);

  useEffect(() => {
    const stop = () => sounds().stopAll();
    window.addEventListener("pagehide", stop);
    return () => {
      window.removeEventListener("pagehide", stop);
      stop();
    };
  }, []);

  return null;
}
