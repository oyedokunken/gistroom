"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, UserPlus } from "lucide-react";
import type { PersonResult } from "@gistroom/shared";
import { PersonActions } from "@/components/friends/person-actions";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { fab as copy } from "@/content/fab";
import { apiFetch } from "@/lib/api";

/** Search people by name or username and send a request from the same window. */
export function AddFriendModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const id = window.setTimeout(() => setQ(text.trim().replace(/^@+/, "")), 300);
    return () => window.clearTimeout(id);
  }, [text]);
  const ready = q.length >= 2;
  const results = useQuery({
    queryKey: ["people", "modal", q],
    queryFn: () =>
      apiFetch<{ people: PersonResult[] }>(
        `/api/people/search?q=${encodeURIComponent(q)}&limit=10`,
      ),
    enabled: open && ready,
  });
  const people = results.data?.people ?? [];

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      icon={UserPlus}
      title={copy.add.title}
      description={copy.add.body}
    >
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-text-muted"
          />
          <Input
            type="text"
            inputMode="search"
            aria-label={copy.add.label}
            placeholder={copy.add.placeholder}
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            className="rounded-full pl-11"
          />
        </div>
        {!ready ? (
          <p className="text-sm text-text-muted">{copy.add.hint}</p>
        ) : results.isPending ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : results.isError ? (
          <div className="flex flex-col items-start gap-2">
            <p className="text-text-muted">{copy.add.failed}</p>
            <Button variant="secondary" onClick={() => void results.refetch()}>
              {copy.add.retry}
            </Button>
          </div>
        ) : people.length === 0 ? (
          <p className="py-2 text-text-muted">{copy.add.none}</p>
        ) : (
          <ul className="-mx-2 flex max-h-[50dvh] flex-col overflow-y-auto">
            {people.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-xl px-2 py-2">
                <Avatar name={p.name} src={p.avatarUrl} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-text">{p.name}</span>
                  <span className="block truncate text-sm text-text-muted">@{p.username}</span>
                </span>
                <PersonActions user={p} relationship={p.relationship} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
