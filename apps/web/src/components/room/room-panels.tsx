"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  CameraOff,
  Check,
  Copy,
  Crown,
  EllipsisVertical,
  Link2,
  Mic,
  MicOff,
  Search,
  Send,
  Shield,
  SmilePlus,
  Trash2,
  UserPlus,
} from "lucide-react";
import {
  CHAT_MODES,
  LANGUAGES,
  LANGUAGE_LABELS,
  LIMITS,
  REACTIONS,
  SLOW_MODE_OPTIONS,
  TOPICS,
  canActOn,
  canDo,
  type FriendDto,
  type RoomChatDto,
  type RoomChatMode,
  type RoomDto,
  type RoomMemberDto,
  type RoomRole,
  type RoomSettingsInput,
} from "@gistroom/shared";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { EmojiButton } from "@/components/chat/emoji-button";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import {
  DropdownContent,
  DropdownItem,
  DropdownMenu,
  DropdownSeparator,
  DropdownTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, Input, Textarea } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { roomCopy as copy } from "@/content/rooms";
import { ApiClientError, apiFetch } from "@/lib/api";
import { cn } from "@/lib/cn";
import { roomApi } from "@/lib/rooms/api";
import { formatClock, formatExpiry, formatFull, formatUntil } from "@/lib/time";

const fail = (e: unknown) => (e instanceof ApiClientError ? e.message : copy.invite.loadError);

export interface PersonState {
  mic: boolean;
  cam: boolean;
}

// ---------- Badges ----------

function RoleBadge({ role }: { role: RoomRole }) {
  if (role === "MEMBER") return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-400 px-2 py-0.5 text-[0.6875rem] font-bold text-ink-950">
      {role === "HOST" ? (
        <Crown aria-hidden className="size-3" />
      ) : (
        <Shield aria-hidden className="size-3" />
      )}
      {role === "HOST" ? copy.stage.host : copy.stage.moderator}
    </span>
  );
}

// ---------- Chat ----------

function ReactionPicker({ onPick }: { onPick: (emoji: string) => void }) {
  return (
    <DropdownMenu>
      <DropdownTrigger asChild>
        <IconButton label={copy.chat.react} className="size-9">
          <SmilePlus aria-hidden className="size-4" />
        </IconButton>
      </DropdownTrigger>
      <DropdownContent align="end">
        <div role="group" aria-label={copy.chat.react} className="grid grid-cols-5 gap-1 p-1">
          {REACTIONS.map((r) => (
            <Menu.Item
              key={r.id}
              aria-label={r.label}
              onSelect={() => onPick(r.emoji)}
              className="flex size-11 cursor-pointer items-center justify-center rounded-full text-xl outline-none data-[highlighted]:bg-green-100"
            >
              {r.emoji}
            </Menu.Item>
          ))}
        </div>
      </DropdownContent>
    </DropdownMenu>
  );
}

export function ChatPanel({ room, meId, role }: { room: RoomDto; meId: string; role: RoomRole }) {
  const { confirm, showError } = useFeedback();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const chat = useQuery({
    queryKey: ["room-chat", room.slug],
    queryFn: () => roomApi.chat(room.slug),
  });
  const items = [...(chat.data?.items ?? [])].reverse();
  const mode = room.settings.chatMode;
  const privileged = canDo(role, "DELETE_MESSAGE");
  const closed = mode === "OFF" || (mode === "MODERATORS" && !privileged);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [items.length]);

  const send = useMutation({
    mutationFn: (body: string) => roomApi.say(room.slug, crypto.randomUUID(), body),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["room-chat", room.slug] }),
    onError: (e) => showError(fail(e)),
  });

  const react = useMutation({
    mutationFn: (v: { id: string; emoji: string }) => roomApi.react(room.slug, v.emoji, v.id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["room-chat", room.slug] }),
    onError: (e) => showError(fail(e)),
  });

  async function remove(m: RoomChatDto) {
    const ok = await confirm({
      title: copy.chat.deleteTitle,
      message: copy.chat.deleteBody,
      confirmLabel: copy.chat.delete,
      destructive: true,
    });
    if (!ok) return;
    try {
      await roomApi.deleteMessage(room.slug, m.id);
      void queryClient.invalidateQueries({ queryKey: ["room-chat", room.slug] });
    } catch (e) {
      showError(fail(e));
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ul
        role="log"
        aria-live="polite"
        aria-label={copy.panels.chat}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4"
      >
        {chat.isPending ? (
          <Skeleton className="h-12" />
        ) : chat.isError ? (
          <p className="text-text-muted">{copy.chat.loadError}</p>
        ) : items.length === 0 ? (
          <p className="text-text-muted">{copy.chat.empty}</p>
        ) : (
          items.map((m) => {
            const own = m.sender.id === meId;
            return (
              <li key={m.id} className="group flex items-start gap-2">
                <Avatar name={m.sender.name} src={m.sender.avatarUrl} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                    <span className="truncate font-semibold text-text">
                      {own ? copy.stage.you : m.sender.name}
                    </span>
                    <RoleBadge role={m.senderRole} />
                    <time
                      dateTime={m.createdAt}
                      title={formatFull(new Date(m.createdAt))}
                      className="tabular text-xs text-text-muted"
                    >
                      {formatClock(new Date(m.createdAt))}
                    </time>
                  </p>
                  <p className="whitespace-pre-wrap break-words text-text">{m.body}</p>
                  {m.reactions.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {m.reactions.map((r) => (
                        <button
                          type="button"
                          key={r.emoji}
                          aria-pressed={r.mine}
                          onClick={() => react.mutate({ id: m.id, emoji: r.emoji })}
                          className={cn(
                            "tabular inline-flex min-h-7 items-center gap-1 rounded-full border bg-surface px-2 text-sm text-text",
                            r.mine ? "border-2 border-green-600" : "border-border",
                          )}
                        >
                          <span>{r.emoji}</span>
                          {r.count > 1 ? <span>{r.count}</span> : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <span className="flex shrink-0 items-center">
                  {room.settings.reactionsOn ? (
                    <ReactionPicker onPick={(emoji) => react.mutate({ id: m.id, emoji })} />
                  ) : null}
                  {own || privileged ? (
                    <IconButton
                      label={copy.chat.delete}
                      onClick={() => void remove(m)}
                      className="size-9"
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </IconButton>
                  ) : null}
                </span>
              </li>
            );
          })
        )}
        <div ref={end} />
      </ul>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const body = text.trim();
          if (!body || closed) return;
          setText("");
          send.mutate(body);
        }}
        className="border-t border-border p-3"
      >
        <p className="mb-2 text-xs text-text-muted">
          {mode === "OFF"
            ? copy.chat.closedOff
            : closed
              ? copy.chat.closedModerators
              : room.settings.slowModeSec > 0 && !privileged
                ? copy.chat.slow(room.settings.slowModeSec)
                : copy.chat.note}
        </p>
        <div className="flex items-center gap-1">
          <EmojiButton onPick={(emoji) => setText((t) => t + emoji)} />
          <Input
            aria-label={copy.chat.label}
            placeholder={copy.chat.placeholder}
            value={text}
            disabled={closed}
            onChange={(e) => setText(e.target.value)}
            className="rounded-full"
          />
          <IconButton
            type="submit"
            label={copy.chat.send}
            disabled={!text.trim() || closed}
            className="bg-green-600 text-white hover:bg-green-700"
          >
            <Send aria-hidden className="size-5" />
          </IconButton>
        </div>
      </form>
    </div>
  );
}

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
          members.data.members.map((m) => {
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
                </span>
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

// ---------- Invite ----------

type InviteTab = "friends" | "link";

function CopyButton({ text, label = copy.invite.copy }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!done) return;
    const t = window.setTimeout(() => setDone(false), 3000);
    return () => window.clearTimeout(t);
  }, [done]);
  return (
    <span className="flex flex-col items-start gap-1">
      <Button
        variant="secondary"
        onClick={() => {
          navigator.clipboard.writeText(text).then(
            () => {
              setFailed(false);
              setDone(true);
            },
            () => setFailed(true),
          );
        }}
        icon={
          done ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />
        }
      >
        {done ? copy.invite.copiedButton : label}
      </Button>
      {failed ? (
        <span role="alert" className="text-xs text-danger-600">
          {copy.invite.copyFailed}
        </span>
      ) : null}
    </span>
  );
}

function InviteFriends({ room }: { room: RoomDto }) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<Record<string, { ok: boolean; reason?: string }> | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const friends = useQuery({
    queryKey: ["friends"],
    queryFn: () => apiFetch<{ friends: FriendDto[] }>("/api/friends"),
  });
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = friends.data?.friends ?? [];
    return q
      ? all.filter((f) => `${f.user.name} ${f.user.username}`.toLowerCase().includes(q))
      : all;
  }, [friends.data, query]);
  const nameOf = (id: string) =>
    friends.data?.friends.find((f) => f.user.id === id)?.user.name ?? id;

  const send = useMutation({
    mutationFn: () => roomApi.inviteFriends(room.slug, [...picked]),
    onSuccess: (r) => {
      setResults(Object.fromEntries(r.results.map((x) => [x.userId, x])));
      setPicked(new Set());
      setError(null);
    },
    onError: (e) => setError(fail(e)),
  });

  if (results) {
    return (
      <div className="flex flex-col gap-3">
        <ul className="flex flex-col gap-2">
          {Object.entries(results).map(([id, r]) => (
            <li
              key={id}
              className={cn(
                "flex items-center gap-2 rounded-xl px-3 py-2 text-sm",
                r.ok ? "bg-green-100 text-green-700" : "bg-danger-600/10 text-danger-600",
              )}
            >
              {r.ok ? <Check aria-hidden className="size-4" /> : null}
              {copy.invite.result(nameOf(id), r.ok, r.reason)}
            </li>
          ))}
        </ul>
        <Button variant="secondary" onClick={() => setResults(null)}>
          {copy.invite.again}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-text-muted">{copy.invite.friendsHelp}</p>
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
        />
        <Input
          aria-label={copy.invite.friendsSearch}
          placeholder={copy.invite.friendsSearch}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>
      <ul className="flex flex-col">
        {friends.isPending ? (
          <Skeleton className="h-12" />
        ) : friends.isError ? (
          <p className="text-text-muted">{copy.invite.loadError}</p>
        ) : friends.data.friends.length === 0 ? (
          <p className="text-text-muted">{copy.invite.noFriends}</p>
        ) : list.length === 0 ? (
          <p className="text-text-muted">{copy.invite.noMatch}</p>
        ) : (
          list.map((f) => {
            const on = picked.has(f.user.id);
            return (
              <li key={f.user.id}>
                <label className="flex min-h-12 cursor-pointer items-center gap-3 py-1">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() =>
                      setPicked((s) => {
                        const next = new Set(s);
                        if (on) next.delete(f.user.id);
                        else next.add(f.user.id);
                        return next;
                      })
                    }
                    className="size-5 shrink-0 cursor-pointer accent-green-600"
                  />
                  <Avatar name={f.user.name} src={f.user.avatarUrl} size={40} />
                  <span className="min-w-0 flex-1 truncate font-semibold text-text">
                    {f.user.name}
                  </span>
                </label>
              </li>
            );
          })
        )}
      </ul>
      {error ? (
        <p role="alert" className="text-sm font-medium text-danger-600">
          {error}
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <span className="tabular text-sm text-text-muted">{copy.invite.selected(picked.size)}</span>
        <Button
          disabled={picked.size === 0}
          loading={send.isPending}
          onClick={() => send.mutate()}
          icon={<UserPlus aria-hidden className="size-4" />}
        >
          {send.isPending ? copy.invite.sending : copy.invite.send}
        </Button>
      </div>
    </div>
  );
}

const HOUR_OPTIONS = [
  { hours: LIMITS.INVITE_LINK_TTL_OPTIONS_HOURS[0], label: copy.invite.hour },
  { hours: LIMITS.INVITE_LINK_TTL_OPTIONS_HOURS[1], label: copy.invite.hours12 },
  { hours: LIMITS.INVITE_LINK_TTL_OPTIONS_HOURS[2], label: copy.invite.day },
  { hours: LIMITS.INVITE_LINK_TTL_OPTIONS_HOURS[3], label: copy.invite.week },
] as const;

function InviteLinks({ room, role }: { room: RoomDto; role: RoomRole }) {
  const { confirm, showError } = useFeedback();
  const queryClient = useQueryClient();
  const [hours, setHours] = useState(String(LIMITS.INVITE_LINK_DEFAULT_TTL_HOURS));
  const [uses, setUses] = useState("");
  const [made, setMade] = useState<{ url: string; expiresAt: string } | null>(null);
  const canManage = canDo(role, "LINK");
  const links = useQuery({
    queryKey: ["room-links", room.slug],
    queryFn: () => roomApi.links(room.slug),
  });

  const create = useMutation({
    mutationFn: () => {
      const n = uses.trim() ? Math.max(1, Math.min(500, Number(uses))) : null;
      return roomApi.makeLink(
        room.slug,
        Number(hours),
        n !== null && Number.isFinite(n) ? n : null,
      );
    },
    onSuccess: ({ link }) => {
      setMade({ url: link.url, expiresAt: link.expiresAt });
      void queryClient.invalidateQueries({ queryKey: ["room-links", room.slug] });
    },
    onError: (e) => showError(fail(e)),
  });

  async function revoke(id: string) {
    const ok = await confirm({
      title: copy.invite.revokeTitle,
      message: copy.invite.revokeBody,
      confirmLabel: copy.invite.revoke,
      destructive: true,
    });
    if (!ok) return;
    try {
      await roomApi.revokeLink(room.slug, id);
      setMade(null);
      void queryClient.invalidateQueries({ queryKey: ["room-links", room.slug] });
    } catch (e) {
      showError(fail(e));
    }
  }

  const roomUrl = links.data?.roomUrl ?? null;

  return (
    <div className="flex flex-col gap-4">
      {roomUrl ? (
        <section className="flex flex-col gap-2 rounded-2xl bg-surface-2 p-3">
          <h3 className="text-sm font-semibold text-text">{copy.invite.roomLink}</h3>
          <p className="text-sm text-text-muted">{copy.invite.roomLinkHelp}</p>
          <p className="break-all rounded-xl bg-surface px-3 py-2 text-sm text-text">{roomUrl}</p>
          <CopyButton text={roomUrl} />
        </section>
      ) : null}

      {!canManage ? (
        <p className="text-sm text-text-muted">{copy.invite.memberCannotCreate}</p>
      ) : made ? (
        <section className="flex flex-col gap-3 rounded-2xl bg-green-100 p-3">
          <h3 className="text-sm font-semibold text-green-700">{copy.invite.newLink}</h3>
          <p className="break-all rounded-xl bg-surface px-3 py-2 text-sm text-text">{made.url}</p>
          <p className="tabular text-sm text-text-muted">
            {copy.invite.expires(formatExpiry(new Date(made.expiresAt)))}
          </p>
          <div className="flex flex-wrap gap-2">
            <CopyButton text={made.url} />
            <Button variant="secondary" onClick={() => setMade(null)}>
              {copy.invite.createAnother}
            </Button>
          </div>
        </section>
      ) : (
        <section className="flex flex-col gap-3">
          <p className="text-sm text-text-muted">{copy.invite.linkHelp}</p>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-text">{copy.invite.duration}</span>
            <SegmentedTabs
              label={copy.invite.duration}
              value={hours}
              onChange={setHours}
              options={HOUR_OPTIONS.map((o) => ({ value: String(o.hours), label: o.label }))}
            />
            <p className="text-sm text-text-muted">{copy.invite.durationHelp}</p>
          </div>
          <Input
            aria-label={copy.invite.maxUses}
            placeholder={copy.invite.maxUses}
            inputMode="numeric"
            value={uses}
            onChange={(e) => setUses(e.target.value.replace(/\D/g, ""))}
          />
          <Button
            loading={create.isPending}
            icon={<Link2 aria-hidden className="size-4" />}
            onClick={() => create.mutate()}
          >
            {copy.invite.createLink}
          </Button>
        </section>
      )}

      {canManage ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-text">{copy.invite.links}</h3>
          <ul className="flex flex-col gap-2">
            {links.isPending ? (
              <Skeleton className="h-16" />
            ) : links.isError ? (
              <p className="text-text-muted">{copy.invite.loadError}</p>
            ) : links.data.links.length === 0 ? (
              <p className="text-text-muted">{copy.invite.noLinks}</p>
            ) : (
              links.data.links.map((l) => {
                const at = new Date(l.expiresAt);
                return (
                  <li
                    key={l.id}
                    className="flex flex-col gap-2 rounded-xl bg-surface-2 px-3 py-3 text-sm"
                  >
                    <p className="break-all text-text">{l.url}</p>
                    <p className="tabular text-text-muted">
                      {copy.invite.uses(l.usedCount, l.maxUses)}
                      {" | "}
                      {copy.invite.expires(formatExpiry(at))}
                      {" | "}
                      {copy.invite.expiresIn(formatUntil(at))}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <CopyButton text={l.url} />
                      <Button variant="ghost" onClick={() => void revoke(l.id)}>
                        {copy.invite.revoke}
                      </Button>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

export function InvitePanel({ room, role }: { room: RoomDto; role: RoomRole }) {
  const [tab, setTab] = useState<InviteTab>("friends");
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
      <SegmentedTabs
        label={copy.invite.title}
        value={tab}
        onChange={(v) => setTab(v as InviteTab)}
        options={[
          { value: "friends", label: copy.invite.friends },
          { value: "link", label: copy.invite.linkTitle },
        ]}
      />
      {tab === "friends" ? <InviteFriends room={room} /> : <InviteLinks room={room} role={role} />}
    </div>
  );
}

// ---------- Settings ----------

const CHAT_LABELS: Record<RoomChatMode, string> = {
  EVERYONE: copy.settings.chatEveryone,
  MODERATORS: copy.settings.chatModerators,
  OFF: copy.settings.chatOff,
};

/** The host and moderators change these live. Switches save as soon as they are touched. */
export function SettingsPanel({ room }: { room: RoomDto }) {
  const { showError } = useFeedback();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(room.title);
  const [description, setDescription] = useState(room.description ?? "");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: (input: RoomSettingsInput) => roomApi.settings(room.slug, input),
    onSuccess: () => {
      setSaved(true);
      void queryClient.invalidateQueries({ queryKey: ["room", room.slug] });
      void queryClient.invalidateQueries({ queryKey: ["room-log", room.slug] });
    },
    onError: (e) => showError(fail(e)),
  });
  const s = room.settings;
  const change = (input: RoomSettingsInput) => {
    setSaved(false);
    save.mutate(input);
  };

  async function lock() {
    try {
      await roomApi.session(room.slug, room.locked ? "unlock" : "lock");
      void queryClient.invalidateQueries({ queryKey: ["room", room.slug] });
    } catch (e) {
      showError(fail(e));
    }
  }

  function saveAbout() {
    const t = title.trim();
    if (!t) return setTitleError(copy.settings.titleRequired);
    if (t.length > LIMITS.ROOM_TITLE_MAX) {
      return setTitleError(copy.settings.titleTooLong(LIMITS.ROOM_TITLE_MAX));
    }
    if (description.trim().length > 500) return;
    setTitleError(null);
    change({ title: t, description: description.trim() || null });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4">
      <p className="text-sm text-text-muted">{copy.settings.help}</p>

      <section className="flex flex-col gap-3" aria-labelledby="set-about">
        <h3 id="set-about" className="text-base font-bold text-text">
          {copy.settings.groups.about}
        </h3>
        <Field label={copy.settings.titleLabel} error={titleError ?? undefined}>
          {(props) => <Input {...props} value={title} onChange={(e) => setTitle(e.target.value)} />}
        </Field>
        <Field
          label={copy.settings.descriptionLabel}
          error={description.length > 500 ? copy.settings.descriptionTooLong : undefined}
        >
          {(props) => (
            <Textarea
              {...props}
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          )}
        </Field>
        <div className="flex items-center gap-3">
          <Button variant="secondary" loading={save.isPending} onClick={saveAbout}>
            {save.isPending ? copy.settings.saving : copy.settings.save}
          </Button>
          {saved ? (
            <span role="status" className="flex items-center gap-1 text-sm text-green-700">
              <Check aria-hidden className="size-4" />
              {copy.settings.saved}
            </span>
          ) : null}
        </div>
        <Field label={copy.settings.topicLabel}>
          {(props) => (
            <Combobox
              id={props.id}
              value={room.topicSlug ?? undefined}
              onValueChange={(v) => change({ topicSlug: v })}
              placeholder={copy.create.topicPlaceholder}
              searchLabel={copy.create.topicPlaceholder}
              emptyText={copy.create.topicEmpty}
              options={TOPICS.map((t) => ({ value: t.slug, label: t.name }))}
            />
          )}
        </Field>
        <Field label={copy.settings.languageLabel}>
          {(props) => (
            <Select
              id={props.id}
              value={room.language}
              onValueChange={(v) => change({ language: v as RoomDto["language"] })}
              options={LANGUAGES.map((l) => ({ value: l, label: LANGUAGE_LABELS[l] }))}
            />
          )}
        </Field>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-text">{copy.settings.visibilityLabel}</span>
          <SegmentedTabs
            label={copy.settings.visibilityLabel}
            value={room.visibility}
            onChange={(v) => change({ visibility: v as "PUBLIC" | "PRIVATE" })}
            options={[
              { value: "PUBLIC", label: copy.settings.public },
              { value: "PRIVATE", label: copy.settings.private },
            ]}
          />
          <p className="text-sm text-text-muted">
            {room.visibility === "PUBLIC" ? copy.settings.publicHelp : copy.settings.privateHelp}
          </p>
        </div>
      </section>

      <section className="flex flex-col divide-y divide-border" aria-labelledby="set-who">
        <h3 id="set-who" className="pb-2 text-base font-bold text-text">
          {copy.settings.groups.who}
        </h3>
        <Switch
          label={copy.settings.cameraAllowed}
          help={copy.settings.cameraAllowedHelp}
          checked={s.cameraAllowed}
          onChange={(v) => change({ cameraAllowed: v })}
        />
        <Switch
          label={copy.settings.joinMuted}
          help={copy.settings.joinMutedHelp}
          checked={s.joinMuted}
          onChange={(v) => change({ joinMuted: v })}
        />
        <Switch
          label={copy.settings.unmuteLocked}
          help={copy.settings.unmuteLockedHelp}
          checked={s.unmuteLocked}
          onChange={(v) => change({ unmuteLocked: v })}
        />
        {room.visibility === "PUBLIC" ? (
          <Switch
            label={copy.settings.membersCanShare}
            help={copy.settings.membersCanShareHelp}
            checked={s.membersCanShare}
            onChange={(v) => change({ membersCanShare: v })}
          />
        ) : null}
        <Switch
          label={copy.settings.lock}
          help={copy.settings.lockHelp}
          checked={room.locked}
          onChange={() => void lock()}
        />
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="set-chat">
        <h3 id="set-chat" className="text-base font-bold text-text">
          {copy.settings.groups.chat}
        </h3>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-text">{copy.settings.chatLabel}</span>
          <SegmentedTabs
            label={copy.settings.chatLabel}
            value={s.chatMode}
            onChange={(v) => change({ chatMode: v as RoomChatMode })}
            options={CHAT_MODES.map((m) => ({ value: m, label: CHAT_LABELS[m] }))}
          />
        </div>
        <Switch
          label={copy.settings.reactionsOn}
          help={copy.settings.reactionsOnHelp}
          checked={s.reactionsOn}
          onChange={(v) => change({ reactionsOn: v })}
        />
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-text">{copy.settings.slowLabel}</span>
          <SegmentedTabs
            label={copy.settings.slowLabel}
            value={String(s.slowModeSec)}
            onChange={(v) => change({ slowModeSec: Number(v) })}
            options={SLOW_MODE_OPTIONS.map((n) => ({
              value: String(n),
              label: n === 0 ? copy.settings.slowOff : copy.settings.slowSeconds(n),
            }))}
          />
          <p className="text-sm text-text-muted">{copy.settings.slowHelp}</p>
        </div>
      </section>
    </div>
  );
}
