"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreVertical, Search, UserMinus, UserX, User } from "lucide-react";
import type { FriendDto, FriendRequestDto, PersonResult, PublicUser } from "@gistroom/shared";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonStyles } from "@/components/ui/button";
import {
  DropdownContent,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { friends as copy } from "@/content/friends";
import { ApiClientError, apiFetch } from "@/lib/api";
import { useRealtimeStore } from "@/lib/realtime/store";
import { PersonActions } from "./person-actions";

type Tab = "friends" | "requests" | "sent" | "find";
const TABS: Tab[] = ["friends", "requests", "sent", "find"];

function PersonLine({
  user,
  sub,
  online,
  children,
}: {
  user: PublicUser;
  sub?: string;
  online?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <Link href={`/app/u/${user.username}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={user.name} src={user.avatarUrl} size={48} online={online} />
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-semibold text-text">{user.name}</span>
          <span className="truncate text-sm text-text-muted">{sub ?? `@${user.username}`}</span>
        </span>
      </Link>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </li>
  );
}

function ListState({
  query,
  empty,
}: {
  query: { isPending: boolean; isError: boolean; refetch: () => unknown };
  empty: React.ReactNode;
}) {
  if (query.isPending) {
    return (
      <div className="flex flex-col gap-3 p-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-12 rounded-full" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    );
  }
  if (query.isError) {
    return (
      <div className="flex flex-col items-center gap-3 p-8 text-center">
        <p className="text-text-muted">{copy.loadError}</p>
        <Button variant="secondary" onClick={() => void query.refetch()}>
          {copy.retry}
        </Button>
      </div>
    );
  }
  return <>{empty}</>;
}

function FriendsList() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { confirm, showError } = useFeedback();
  const presence = useRealtimeStore((s) => s.presence);
  const q = useQuery({
    queryKey: ["friends"],
    queryFn: () => apiFetch<{ friends: FriendDto[] }>("/api/friends"),
  });

  async function unfriend(f: FriendDto) {
    if (
      !(await confirm({
        title: copy.unfriendTitle(f.user.name),
        message: copy.unfriendBody,
        confirmLabel: copy.unfriendConfirm,
        destructive: true,
      }))
    )
      return;
    try {
      await apiFetch(`/api/friends/${f.user.id}`, { method: "DELETE", body: {} });
      void queryClient.invalidateQueries({ queryKey: ["friends"] });
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    } catch (e) {
      if (e instanceof ApiClientError) showError(e.message);
      else throw e;
    }
  }
  async function block(f: FriendDto) {
    if (
      !(await confirm({
        title: copy.blockTitle(f.user.name),
        message: copy.blockBody,
        confirmLabel: copy.blockConfirm,
        destructive: true,
      }))
    )
      return;
    try {
      await apiFetch("/api/blocks", { body: { userId: f.user.id } });
      void queryClient.invalidateQueries({ queryKey: ["friends"] });
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    } catch (e) {
      if (e instanceof ApiClientError) showError(e.message);
      else throw e;
    }
  }

  const items = q.data?.friends ?? [];
  return (
    <ListState
      query={q}
      empty={
        items.length === 0 ? (
          <EmptyState
            icon="friends"
            title={copy.emptyFriendsTitle}
            body={copy.emptyFriendsBody}
            action={
              <Link href="/app/friends?tab=find" className={buttonStyles("primary")}>
                {copy.emptyFriendsAction}
              </Link>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((f) => (
              <PersonLine key={f.user.id} user={f.user} online={presence[f.user.id]?.online}>
                <PersonActions
                  user={f.user}
                  relationship="FRIENDS"
                  conversationId={f.conversationId}
                />
                <DropdownMenu>
                  <DropdownTrigger asChild>
                    <IconButton label={`${copy.more}: ${f.user.name}`}>
                      <MoreVertical aria-hidden className="size-5" />
                    </IconButton>
                  </DropdownTrigger>
                  <DropdownContent>
                    <DropdownItem
                      icon={User}
                      onSelect={() => router.push(`/app/u/${f.user.username}`)}
                    >
                      {copy.profile}
                    </DropdownItem>
                    <DropdownItem icon={UserMinus} danger onSelect={() => void unfriend(f)}>
                      {copy.unfriend}
                    </DropdownItem>
                    <DropdownItem icon={UserX} danger onSelect={() => void block(f)}>
                      {copy.block}
                    </DropdownItem>
                  </DropdownContent>
                </DropdownMenu>
              </PersonLine>
            ))}
          </ul>
        )
      }
    />
  );
}

function RequestList({ direction }: { direction: "incoming" | "outgoing" }) {
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useFeedback();
  const q = useQuery({
    queryKey: ["requests", direction],
    queryFn: () =>
      apiFetch<{ requests: FriendRequestDto[] }>(`/api/friends/requests?direction=${direction}`),
  });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["requests"] });
    void queryClient.invalidateQueries({ queryKey: ["friends"] });
    void queryClient.invalidateQueries({ queryKey: ["unread"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };
  async function act(r: FriendRequestDto, action: "accept" | "reject" | "cancel") {
    try {
      if (action === "cancel")
        await apiFetch(`/api/friends/requests/${r.id}`, { method: "DELETE", body: {} });
      else await apiFetch(`/api/friends/requests/${r.id}/${action}`, { body: {} });
      if (action === "accept") showSuccess(copy.nowFriends(r.user.name));
      refresh();
    } catch (e) {
      if (e instanceof ApiClientError) showError(e.message);
      else throw e;
    }
  }
  const items = q.data?.requests ?? [];
  return (
    <ListState
      query={q}
      empty={
        items.length === 0 ? (
          direction === "incoming" ? (
            <EmptyState
              icon="invites"
              title={copy.emptyRequestsTitle}
              body={copy.emptyRequestsBody}
            />
          ) : (
            <EmptyState icon="invites" title={copy.emptySentTitle} body={copy.emptySentBody} />
          )
        ) : (
          <ul className="divide-y divide-border">
            {items.map((r) => (
              <PersonLine key={r.id} user={r.user}>
                {direction === "incoming" ? (
                  <>
                    <Button onClick={() => void act(r, "accept")}>{copy.accept}</Button>
                    <Button
                      variant="ghost"
                      className="border border-border"
                      onClick={() => void act(r, "reject")}
                    >
                      {copy.decline}
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="ghost"
                    className="border border-border"
                    onClick={() => void act(r, "cancel")}
                  >
                    {copy.cancel}
                  </Button>
                )}
              </PersonLine>
            ))}
          </ul>
        )
      }
    />
  );
}

function useDebounced(value: string, ms: number): string {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

function FindPeople() {
  const [text, setText] = useState("");
  const q = useDebounced(text.trim(), 350);
  const enabled = q.length >= 2;
  const search = useInfiniteQuery({
    queryKey: ["people", q],
    enabled,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      apiFetch<{ people: PersonResult[]; nextCursor: string | null }>(
        `/api/people/search?q=${encodeURIComponent(q)}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`,
      ),
    getNextPageParam: (last) => last.nextCursor,
  });
  const people = useMemo(() => search.data?.pages.flatMap((p) => p.people) ?? [], [search.data]);

  return (
    <div className="flex flex-col">
      <div className="relative p-4">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-7 top-1/2 size-4 -translate-y-1/2 text-text-muted"
        />
        <Input
          type="search"
          inputMode="search"
          aria-label={copy.searchLabel}
          placeholder={copy.searchPlaceholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoComplete="off"
          className="rounded-full pl-10"
        />
      </div>
      {!enabled ? (
        <p className="px-4 pb-6 text-sm text-text-muted">{copy.searchHint}</p>
      ) : search.isPending ? (
        <ListState query={search} empty={null} />
      ) : search.isError ? (
        <ListState query={search} empty={null} />
      ) : people.length === 0 ? (
        <EmptyState icon="open-gist" title={copy.searchEmptyTitle} body={copy.searchEmptyBody} />
      ) : (
        <>
          <ul className="divide-y divide-border">
            {people.map((p) => (
              <PersonLine
                key={p.id}
                user={p}
                sub={`@${p.username} ${p.mutualFriends > 0 ? `• ${copy.mutual(p.mutualFriends)}` : ""}`}
              >
                <PersonActions user={p} relationship={p.relationship} />
              </PersonLine>
            ))}
          </ul>
          {search.hasNextPage ? (
            <div className="flex justify-center p-4">
              <Button
                variant="secondary"
                loading={search.isFetchingNextPage}
                onClick={() => void search.fetchNextPage()}
              >
                {copy.loadMore}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export function FriendsTabs() {
  const router = useRouter();
  const params = useSearchParams();
  const raw = params.get("tab");
  const tab: Tab = TABS.includes(raw as Tab) ? (raw as Tab) : "friends";
  const incoming = useQuery({
    queryKey: ["requests", "incoming"],
    queryFn: () =>
      apiFetch<{ requests: FriendRequestDto[] }>("/api/friends/requests?direction=incoming"),
  });
  const count = incoming.data?.requests.length ?? 0;

  return (
    <Tabs value={tab} onValueChange={(v) => router.replace(`/app/friends?tab=${v}`)}>
      <div className="overflow-x-auto px-4 pt-3">
        <TabsList label={copy.tabsLabel}>
          <TabsTrigger value="friends">{copy.tabs.friends}</TabsTrigger>
          <TabsTrigger value="requests">
            {copy.tabs.requests}
            {count > 0 ? (
              <Badge tone="yellow" className="ml-2">
                {count}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="sent">{copy.tabs.sent}</TabsTrigger>
          <TabsTrigger value="find">{copy.tabs.find}</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="friends">
        <FriendsList />
      </TabsContent>
      <TabsContent value="requests">
        <RequestList direction="incoming" />
      </TabsContent>
      <TabsContent value="sent">
        <RequestList direction="outgoing" />
      </TabsContent>
      <TabsContent value="find">
        <FindPeople />
      </TabsContent>
    </Tabs>
  );
}
