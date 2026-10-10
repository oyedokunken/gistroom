"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Copy,
  Crown,
  EllipsisVertical,
  Link2,
  Send,
  Shield,
  Trash2,
  UserPlus,
} from "lucide-react";
import {
  LIMITS,
  canActOn,
  canDo,
  type FriendDto,
  type RoomChatDto,
  type RoomDto,
  type RoomMemberDto,
  type RoomRole,
} from "@gistroom/shared";
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
import { Input } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { roomCopy as copy } from "@/content/rooms";
import { ApiClientError, apiFetch } from "@/lib/api";
import { useConversations } from "@/lib/chat/hooks";
import { roomApi } from "@/lib/rooms/api";
import { formatClock, formatFull } from "@/lib/time";

const fail = (e: unknown) => (e instanceof ApiClientError ? e.message : copy.invite.loadError);

// ---------- Chat ----------

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

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [items.length]);

  const send = useMutation({
    mutationFn: (body: string) => roomApi.say(room.slug, crypto.randomUUID(), body),
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

  const canDelete = canDo(role, "DELETE_MESSAGE");
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
          items.map((m) => (
            <li key={m.id} className="group flex items-start gap-2">
              <Avatar name={m.sender.name} src={m.sender.avatarUrl} size={32} />
              <div className="min-w-0 flex-1">
                <p className="flex items-baseline gap-2 text-sm">
                  <span className="truncate font-semibold text-text">
                    {m.sender.id === meId ? "You" : m.sender.name}
                  </span>
                  <time
                    dateTime={m.createdAt}
                    title={formatFull(new Date(m.createdAt))}
                    className="tabular text-xs text-text-muted"
                  >
                    {formatClock(new Date(m.createdAt))}
                  </time>
                </p>
                <p className="whitespace-pre-wrap break-words text-text">{m.body}</p>
              </div>
              {canDelete ? (
                <IconButton
                  label={copy.chat.delete}
                  onClick={() => void remove(m)}
                  className="-mt-1"
                >
                  <Trash2 aria-hidden className="size-4" />
                </IconButton>
              ) : null}
            </li>
          ))
        )}
        <div ref={end} />
      </ul>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const body = text.trim();
          if (!body) return;
          setText("");
          send.mutate(body);
        }}
        className="border-t border-border p-3"
      >
        <p className="mb-2 text-xs text-text-muted">{copy.chat.note}</p>
        <div className="flex items-center gap-2">
          <Input
            aria-label={copy.chat.label}
            placeholder={copy.chat.placeholder}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="rounded-full"
          />
          <IconButton
            type="submit"
            label={copy.chat.send}
            disabled={!text.trim()}
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

export function PeoplePanel({ room, meId, role }: { room: RoomDto; meId: string; role: RoomRole }) {
  const { confirm, showError } = useFeedback();
  const queryClient = useQueryClient();
  const members = useQuery({
    queryKey: ["room-members", room.slug],
    queryFn: () => roomApi.members(room.slug),
  });

  async function act(
    m: RoomMemberDto,
    action: "MUTE" | "REMOVE" | "BAN" | "PROMOTE" | "DEMOTE" | "TRANSFER",
  ) {
    const name = m.user.name;
    const prompts = {
      REMOVE: [copy.mod.removeTitle(name), copy.mod.removeBody],
      BAN: [copy.mod.banTitle(name), copy.mod.banBody],
      PROMOTE: [copy.mod.promoteTitle(name), copy.mod.promoteBody],
      DEMOTE: [copy.mod.demoteTitle(name), copy.mod.demoteBody],
      TRANSFER: [copy.mod.transferTitle(name), copy.mod.transferBody],
    } as const;
    if (action !== "MUTE") {
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

type InviteTab = "friends" | "link" | "chats";

export function InvitePanel({ room }: { room: RoomDto }) {
  const { confirm, showError, showSuccess } = useFeedback();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<InviteTab>("friends");
  const [hours, setHours] = useState("24");
  const [uses, setUses] = useState("");
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const friends = useQuery({
    queryKey: ["friends"],
    queryFn: () => apiFetch<{ friends: FriendDto[] }>("/api/friends"),
    enabled: tab === "friends",
  });
  const chats = useConversations(false);
  const links = useQuery({
    queryKey: ["room-links", room.slug],
    queryFn: () => roomApi.links(room.slug),
    enabled: tab === "link",
  });

  async function invite(f: FriendDto) {
    try {
      await roomApi.inviteFriend(room.slug, f.user.id);
      setSent((s) => ({ ...s, [f.user.id]: true }));
    } catch (e) {
      showError(fail(e));
    }
  }

  async function makeLink() {
    try {
      const max = uses.trim() ? Math.max(1, Math.min(500, Number(uses))) : null;
      const { link } = await roomApi.makeLink(
        room.slug,
        Number(hours),
        Number.isFinite(max) ? max : null,
      );
      await navigator.clipboard.writeText(link.url).catch(() => undefined);
      showSuccess(copy.invite.copied);
      void queryClient.invalidateQueries({ queryKey: ["room-links", room.slug] });
    } catch (e) {
      showError(fail(e));
    }
  }

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
      void queryClient.invalidateQueries({ queryKey: ["room-links", room.slug] });
    } catch (e) {
      showError(fail(e));
    }
  }

  async function forward(conversationId: string) {
    try {
      await roomApi.forward(room.slug, [conversationId]);
      setSent((s) => ({ ...s, [conversationId]: true }));
    } catch (e) {
      showError(fail(e));
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
      <SegmentedTabs
        label={copy.invite.title}
        value={tab}
        onChange={(v) => setTab(v as InviteTab)}
        options={[
          { value: "friends", label: copy.invite.friends },
          { value: "link", label: copy.invite.linkTitle },
          { value: "chats", label: copy.invite.forward },
        ]}
      />
      {tab === "friends" ? (
        <>
          <p className="text-sm text-text-muted">{copy.invite.friendsHelp}</p>
          <ul className="flex flex-col">
            {friends.isPending ? (
              <Skeleton className="h-12" />
            ) : friends.isError ? (
              <p className="text-text-muted">{copy.invite.loadError}</p>
            ) : friends.data.friends.length === 0 ? (
              <p className="text-text-muted">{copy.invite.noFriends}</p>
            ) : (
              friends.data.friends.map((f) => (
                <li key={f.user.id} className="flex items-center gap-3 py-2">
                  <Avatar name={f.user.name} src={f.user.avatarUrl} size={40} />
                  <span className="min-w-0 flex-1 truncate font-semibold text-text">
                    {f.user.name}
                  </span>
                  <Button
                    variant="secondary"
                    disabled={sent[f.user.id]}
                    onClick={() => void invite(f)}
                    icon={
                      sent[f.user.id] ? (
                        <Check aria-hidden className="size-4" />
                      ) : (
                        <UserPlus aria-hidden className="size-4" />
                      )
                    }
                  >
                    {sent[f.user.id] ? copy.invite.invited : copy.invite.inviteAction}
                  </Button>
                </li>
              ))
            )}
          </ul>
        </>
      ) : tab === "link" ? (
        <>
          <p className="text-sm text-text-muted">{copy.invite.linkHelp}</p>
          <div className="flex flex-col gap-3">
            <SegmentedTabs
              label={copy.invite.duration}
              value={hours}
              onChange={setHours}
              options={[
                { value: String(LIMITS.INVITE_LINK_TTL_OPTIONS_HOURS[0]), label: copy.invite.hour },
                { value: String(LIMITS.INVITE_LINK_TTL_OPTIONS_HOURS[1]), label: copy.invite.day },
                { value: String(LIMITS.INVITE_LINK_TTL_OPTIONS_HOURS[2]), label: copy.invite.week },
              ]}
            />
            <Input
              aria-label={copy.invite.maxUses}
              placeholder={copy.invite.maxUses}
              inputMode="numeric"
              value={uses}
              onChange={(e) => setUses(e.target.value.replace(/\D/g, ""))}
            />
            <Button icon={<Link2 aria-hidden className="size-4" />} onClick={() => void makeLink()}>
              {copy.invite.createLink}
            </Button>
          </div>
          <h3 className="mt-2 text-sm font-semibold text-text">{copy.invite.links}</h3>
          <ul className="flex flex-col gap-2">
            {links.isPending ? (
              <Skeleton className="h-10" />
            ) : links.isError ? (
              <p className="text-text-muted">{copy.invite.loadError}</p>
            ) : links.data.links.length === 0 ? (
              <p className="text-text-muted">{copy.invite.noLinks}</p>
            ) : (
              links.data.links.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2 text-sm"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-text">
                      {copy.invite.states[l.state]}
                    </span>
                    <span className="tabular block text-text-muted">
                      {copy.invite.uses(l.usedCount, l.maxUses)} ·{" "}
                      {copy.invite.expires(formatFull(new Date(l.expiresAt)))}
                    </span>
                  </span>
                  {l.state === "OK" ? (
                    <Button variant="ghost" onClick={() => void revoke(l.id)}>
                      {copy.invite.revoke}
                    </Button>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </>
      ) : (
        <>
          <p className="text-sm text-text-muted">{copy.invite.forwardHelp}</p>
          <ul className="flex flex-col">
            {(chats.data?.conversations ?? []).map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2">
                <Avatar name={c.peer.name} src={c.peer.avatarUrl} size={40} />
                <span className="min-w-0 flex-1 truncate font-semibold text-text">
                  {c.peer.name}
                </span>
                <Button
                  variant="secondary"
                  disabled={sent[c.id] || c.availability !== "OK"}
                  onClick={() => void forward(c.id)}
                  icon={
                    sent[c.id] ? (
                      <Check aria-hidden className="size-4" />
                    ) : (
                      <Copy aria-hidden className="size-4" />
                    )
                  }
                >
                  {sent[c.id] ? copy.invite.forwarded : copy.invite.forwardAction}
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
