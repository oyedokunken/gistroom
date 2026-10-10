"use client";

import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Laptop } from "lucide-react";
import type { SessionInfo } from "@gistroom/shared";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { settings } from "@/content/app";
import { ui } from "@/content/ui";
import { ApiClientError, apiFetch } from "@/lib/api";
import { formatRelative } from "@/lib/time";

export function DevicesList() {
  const copy = settings.devices;
  const router = useRouter();
  const client = useQueryClient();
  const { confirm, showError, showInfo } = useFeedback();
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["sessions"],
    queryFn: () => apiFetch<{ sessions: SessionInfo[] }>("/api/sessions"),
  });

  async function revoke(s: SessionInfo) {
    const ok = await confirm({
      title: copy.confirmTitle,
      message: copy.confirmOne,
      confirmLabel: copy.signOut,
      destructive: true,
    });
    if (!ok) return;
    try {
      await apiFetch(`/api/sessions/${s.id}`, { method: "DELETE", body: {} });
      if (s.current) {
        router.replace("/login");
        router.refresh();
        return;
      }
      await client.invalidateQueries({ queryKey: ["sessions"] });
      showInfo(copy.done);
    } catch (e) {
      if (e instanceof ApiClientError) showError(e.message);
      else throw e;
    }
  }

  async function revokeOthers() {
    const ok = await confirm({
      title: copy.confirmTitle,
      message: copy.confirmOthers,
      confirmLabel: copy.signOutOthers,
      destructive: true,
    });
    if (!ok) return;
    try {
      const res = await apiFetch<{ revoked: number }>("/api/sessions/revoke-others", {
        method: "POST",
        body: {},
      });
      await client.invalidateQueries({ queryKey: ["sessions"] });
      showInfo(copy.doneOthers(res.revoked));
    } catch (e) {
      if (e instanceof ApiClientError) showError(e.message);
      else throw e;
    }
  }

  if (isPending) {
    return (
      <div className="flex max-w-lg flex-col gap-3">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    );
  }
  if (isError) {
    return (
      <div className="flex max-w-lg flex-col items-start gap-3">
        <p className="text-text-muted">{settings.devices.intro}</p>
        <Button variant="secondary" onClick={() => void refetch()}>
          {ui.retry}
        </Button>
      </div>
    );
  }

  const sessions = data.sessions;
  return (
    <div className="flex max-w-lg flex-col gap-4">
      <p className="text-text-muted">{copy.intro}</p>
      <ul className="flex flex-col gap-3">
        {sessions.map((s) => (
          <li key={s.id} className="flex items-center gap-3 rounded-card border border-border p-4">
            <Laptop aria-hidden className="size-6 shrink-0 text-text-muted" />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-semibold text-text">
                {s.deviceLabel}
                {s.current ? (
                  <span className="ml-2 text-sm font-medium text-green-700">{copy.current}</span>
                ) : null}
              </span>
              <span className="text-sm text-text-muted">
                {copy.lastSeen(formatRelative(new Date(s.lastSeenAt)))}
              </span>
            </div>
            <Button
              variant="ghost"
              onClick={() => void revoke(s)}
              className="border border-border px-4"
            >
              {copy.signOut}
            </Button>
          </li>
        ))}
      </ul>
      {sessions.length > 1 ? (
        <Button variant="secondary" onClick={() => void revokeOthers()} className="w-fit">
          {copy.signOutOthers}
        </Button>
      ) : null}
    </div>
  );
}
