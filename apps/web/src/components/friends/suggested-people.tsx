"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import type { FriendSuggestion } from "@gistroom/shared";
import { BadgeRow } from "@/components/badges/badge-row";
import { PersonActions } from "@/components/friends/person-actions";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { suggestionsCopy as copy } from "@/content/suggestions";
import { ApiClientError, apiFetch } from "@/lib/api";

/**
 * People you may want to add, with the plain reasons they were suggested and a Not interested button. The list comes
 * from the server already filtered, so nobody blocked, hidden or already connected is ever here.
 */
export function SuggestedPeople() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [dismissing, setDismissing] = useState<string | null>(null);
  const suggestions = useQuery({
    queryKey: ["friend-suggestions"],
    queryFn: () => apiFetch<{ people: FriendSuggestion[] }>("/api/friends/suggestions"),
    staleTime: 60_000,
  });

  async function dismiss(person: FriendSuggestion) {
    setDismissing(person.id);
    setError(null);
    try {
      await apiFetch("/api/friends/suggestions/dismiss", { body: { userId: person.id } });
      queryClient.setQueryData<{ people: FriendSuggestion[] }>(["friend-suggestions"], (data) =>
        data ? { people: data.people.filter((p) => p.id !== person.id) } : data,
      );
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : copy.dismissFailed);
    } finally {
      setDismissing(null);
    }
  }

  return (
    <section aria-labelledby="suggested-h" className="mx-auto mb-8 w-full max-w-[720px]">
      <h2 id="suggested-h" className="text-xl font-bold text-text">
        {copy.heading}
      </h2>
      <p className="mb-3 text-sm text-text-muted">{copy.lead}</p>
      {error ? (
        <p role="alert" className="mb-2 text-sm font-medium text-danger-600">
          {error}
        </p>
      ) : null}
      {suggestions.isPending ? (
        <div role="status" aria-label={copy.loading} className="flex flex-col gap-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : suggestions.isError ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-text-muted">{copy.error}</p>
          <Button variant="secondary" onClick={() => void suggestions.refetch()}>
            {copy.retry}
          </Button>
        </div>
      ) : suggestions.data.people.length === 0 ? (
        <p className="rounded-card border border-dashed border-border p-4 text-text-muted">
          {copy.empty}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {suggestions.data.people.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-surface px-4 py-3"
            >
              <Link
                href={`/app/u/${p.username}`}
                className="flex min-w-0 flex-1 items-center gap-3"
              >
                <Avatar name={p.name} src={p.avatarUrl} size={48} />
                <span className="flex min-w-0 flex-col">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate font-semibold text-text">{p.name}</span>
                    <BadgeRow badges={p.badges} />
                  </span>
                  <span className="truncate text-sm text-text-muted">@{p.username}</span>
                  {p.reasons.length > 0 ? (
                    <span className="text-sm text-green-700">{p.reasons.join(" - ")}</span>
                  ) : null}
                </span>
              </Link>
              <div className="flex shrink-0 items-center gap-2">
                <PersonActions user={p} relationship={p.relationship} />
                <Button
                  variant="ghost"
                  loading={dismissing === p.id}
                  aria-label={copy.notInterestedLabel(p.name)}
                  onClick={() => void dismiss(p)}
                  className="gap-1"
                >
                  <X aria-hidden className="size-4" />
                  {copy.notInterested}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
