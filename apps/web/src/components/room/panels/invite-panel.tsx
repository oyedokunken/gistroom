"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Link2, Search, UserPlus } from "lucide-react";
import { LIMITS, canDo, type FriendDto, type RoomDto, type RoomRole } from "@gistroom/shared";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { roomCopy as copy } from "@/content/rooms";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/cn";
import { roomApi } from "@/lib/rooms/api";
import { formatExpiry, formatUntil } from "@/lib/time";
import { fail } from "./shared";

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
  const people = useQuery({
    queryKey: ["room-members", room.slug],
    queryFn: () => roomApi.members(room.slug),
  });
  // Friends who are in the room right now cannot be invited again.
  const inside = useMemo(
    () =>
      new Set(
        (people.data?.members ?? []).filter((m) => m.state === "JOINED").map((m) => m.user.id),
      ),
    [people.data],
  );
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
            const here = inside.has(f.user.id);
            return (
              <li key={f.user.id}>
                <label
                  className={cn(
                    "flex min-h-12 items-center gap-3 py-1",
                    here ? "cursor-not-allowed opacity-70" : "cursor-pointer",
                  )}
                >
                  <input
                    type="checkbox"
                    disabled={here}
                    checked={on && !here}
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
                  {here ? (
                    <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                      {copy.invite.alreadyIn}
                    </span>
                  ) : null}
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
