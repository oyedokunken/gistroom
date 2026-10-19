"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, CameraOff, EllipsisVertical, Mic, MicOff } from "lucide-react";
import { canActOn, canDo, type RoomDto, type RoomMemberDto, type RoomRole } from "@gistroom/shared";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownContent,
  DropdownItem,
  DropdownMenu,
  DropdownSeparator,
  DropdownTrigger,
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { Skeleton } from "@/components/ui/skeleton";
import { roomCopy as copy } from "@/content/rooms";
import { roomApi } from "@/lib/rooms/api";
import { formatClock, formatFull } from "@/lib/time";
import { SignalBars } from "@/components/session/signal-bars";
import { useLive } from "@/lib/live/live-session";
import { RoleBadge, fail, type PersonState } from "./shared";

// ---------- People ----------

type ModAction = "MUTE" | "MUTE_VIDEO" | "REMOVE" | "BAN" | "PROMOTE" | "DEMOTE" | "TRANSFER";

export function PeoplePanel({
  room,
  meId,
  role,
  states,
  count,
}: {
  room: RoomDto;
  meId: string;
  role: RoomRole;
  states: Record<string, PersonState>;
  count: number;
}) {
  const { confirm, showError } = useFeedback();
  const queryClient = useQueryClient();
  const members = useQuery({
    queryKey: ["room-members", room.slug],
    queryFn: () => roomApi.members(room.slug),
  });
  const quality = useLive((s) => s.quality);
  // People rung a moment ago whose phones may be quiet: shown under their name for this visit.
  const [quiet, setQuiet] = useState<Set<string>>(new Set());

  async function ring(m: RoomMemberDto) {
    try {
      const r = await roomApi.ring(room.slug, m.user.id);
      if (r.mayNotSee) setQuiet((s) => new Set(s).add(m.user.id));
      void queryClient.invalidateQueries({ queryKey: ["room-members", room.slug] });
    } catch (e) {
      showError(fail(e));
    }
  }

  async function act(m: RoomMemberDto, action: ModAction) {
    const name = m.user.name;
    const prompts = {
      REMOVE: [copy.mod.removeTitle(name), copy.mod.removeBody],
      BAN: [copy.mod.banTitle(name), copy.mod.banBody],
      PROMOTE: [copy.mod.promoteTitle(name), copy.mod.promoteBody],
      DEMOTE: [copy.mod.demoteTitle(name), copy.mod.demoteBody],
      TRANSFER: [copy.mod.transferTitle(name), copy.mod.transferBody],
    } as const;
    if (action !== "MUTE" && action !== "MUTE_VIDEO") {
      const [title, message] = prompts[action];
      const ok = await confirm({
        title,
        message,
        confirmLabel: copy.mod.confirm,
        destructive: action === "REMOVE" || action === "BAN",
      });
      if (!ok) return;
    }
    try {
      await roomApi.moderate(room.slug, action, m.user.id);
      void queryClient.invalidateQueries({ queryKey: ["room-members", room.slug] });
    } catch (e) {
      showError(fail(e));
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="tabular border-b border-border px-4 py-2 text-sm text-text-muted">
        {copy.people.count(count)}
      </p>
      <ul className="flex min-h-0 flex-1 flex-col overflow-y-auto p-2">
        {members.isPending ? (
          <Skeleton className="m-2 h-12" />
        ) : members.isError ? (
          <p className="p-3 text-text-muted">{copy.invite.loadError}</p>
        ) : (
          members.data.members
            .filter((m) => m.state === "JOINED")
            .map((m) => {
              const mine = m.user.id === meId;
              const target = m.user.id === room.host.id ? "HOST" : m.role;
              const menu = !mine && canActOn(role, target) && canDo(role, "MUTE");
              const state = states[m.user.id];
              return (
                <li key={m.user.id} className="flex items-center gap-3 rounded-xl px-2 py-2">
                  <Avatar name={m.user.name} src={m.user.avatarUrl} size={40} />
                  <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
                    <span className="max-w-full truncate font-semibold text-text">
                      {m.user.name}
                      {mine ? ` (${copy.stage.you})` : ""}
                    </span>
                    <RoleBadge role={target} />
                    {m.joinedAt ? (
                      <span className="tabular text-xs text-text-muted">
                        {copy.people.joinedAt(formatClock(new Date(m.joinedAt)))}
                      </span>
                    ) : null}
                  </span>
                  <SignalBars
                    quality={quality[`user_${m.user.id}`] ?? "unknown"}
                    className="text-text-muted"
                  />
                  {state ? (
                    <span className="flex shrink-0 items-center gap-2 text-text-muted">
                      {state.mic ? (
                        <Mic aria-label={copy.people.micOn} className="size-4" />
                      ) : (
                        <MicOff aria-label={copy.people.muted} className="size-4" />
                      )}
                      {state.cam ? (
                        <Camera aria-label={copy.people.cameraOn} className="size-4" />
                      ) : (
                        <CameraOff aria-label={copy.people.cameraOff} className="size-4" />
                      )}
                    </span>
                  ) : null}
                  {menu ? (
                    <DropdownMenu>
                      <DropdownTrigger asChild>
                        <IconButton label={copy.mod.menu(m.user.name)}>
                          <EllipsisVertical aria-hidden className="size-5" />
                        </IconButton>
                      </DropdownTrigger>
                      <DropdownContent align="end">
                        <DropdownItem onSelect={() => void act(m, "MUTE")}>
                          {copy.mod.mute}
                        </DropdownItem>
                        <DropdownItem onSelect={() => void act(m, "MUTE_VIDEO")}>
                          {copy.mod.muteVideo}
                        </DropdownItem>
                        {canDo(role, "PROMOTE") && target === "MEMBER" ? (
                          <DropdownItem onSelect={() => void act(m, "PROMOTE")}>
                            {copy.mod.promote}
                          </DropdownItem>
                        ) : null}
                        {canDo(role, "DEMOTE") && target === "MODERATOR" ? (
                          <DropdownItem onSelect={() => void act(m, "DEMOTE")}>
                            {copy.mod.demote}
                          </DropdownItem>
                        ) : null}
                        {canDo(role, "TRANSFER") ? (
                          <DropdownItem onSelect={() => void act(m, "TRANSFER")}>
                            {copy.mod.transfer}
                          </DropdownItem>
                        ) : null}
                        <DropdownSeparator />
                        <DropdownItem danger onSelect={() => void act(m, "REMOVE")}>
                          {copy.mod.remove}
                        </DropdownItem>
                        <DropdownItem danger onSelect={() => void act(m, "BAN")}>
                          {copy.mod.ban}
                        </DropdownItem>
                      </DropdownContent>
                    </DropdownMenu>
                  ) : null}
                </li>
              );
            })
        )}
        {members.data?.members.some((m) => m.state === "INVITED") ? (
          <>
            <li className="px-2 pb-1 pt-4 text-sm font-bold text-text">
              {copy.people.invitedHeading}
            </li>
            {members.data.members
              .filter((m) => m.state === "INVITED")
              .map((m) => (
                <li key={m.user.id} className="flex items-center gap-3 rounded-xl px-2 py-2">
                  <Avatar name={m.user.name} src={m.user.avatarUrl} size={40} />
                  <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
                    <span className="max-w-full truncate font-semibold text-text">
                      {m.user.name}
                    </span>
                    <span className="text-xs text-text-muted">
                      {m.ringStatus === "RINGING"
                        ? copy.people.ringing
                        : m.ringStatus === "DECLINED"
                          ? copy.people.declined
                          : m.ringStatus === "NO_ANSWER"
                            ? copy.people.noAnswer
                            : copy.people.invited}
                      {quiet.has(m.user.id) ? `. ${copy.people.mayNotSee}` : ""}
                    </span>
                  </span>
                  {canDo(role, "INVITE") && room.status === "LIVE" ? (
                    <Button
                      variant="secondary"
                      aria-label={copy.people.ringFor(m.user.name)}
                      disabled={m.ringStatus === "RINGING"}
                      onClick={() => void ring(m)}
                    >
                      {m.ringStatus === "DECLINED" || m.ringStatus === "NO_ANSWER"
                        ? copy.people.ringAgain
                        : copy.people.ring}
                    </Button>
                  ) : null}
                </li>
              ))}
          </>
        ) : null}
      </ul>
    </div>
  );
}

// ---------- Moderator log ----------

export function LogPanel({ room }: { room: RoomDto }) {
  const log = useQuery({
    queryKey: ["room-log", room.slug],
    queryFn: () => roomApi.log(room.slug),
  });
  return (
    <ul className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
      {log.isPending ? (
        <Skeleton className="h-10" />
      ) : log.isError ? (
        <p className="text-text-muted">{copy.invite.loadError}</p>
      ) : log.data.log.length === 0 ? (
        <p className="text-text-muted">{copy.mod.logEmpty}</p>
      ) : (
        log.data.log.map((l) => (
          <li key={l.id} className="text-sm">
            <p className="text-text">
              <span className="font-semibold">{l.actor.name}</span>{" "}
              {copy.mod.logLabels[l.action as keyof typeof copy.mod.logLabels] ?? l.action}
              {l.target ? <span className="font-semibold"> {l.target.name}</span> : null}
            </p>
            <time
              dateTime={l.createdAt}
              title={formatFull(new Date(l.createdAt))}
              className="tabular text-xs text-text-muted"
            >
              {formatClock(new Date(l.createdAt))}
            </time>
          </li>
        ))
      )}
    </ul>
  );
}
