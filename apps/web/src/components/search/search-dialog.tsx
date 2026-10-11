"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, NotebookPen, Radio, Search, Users } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import type { SearchResults } from "@gistroom/shared";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/field";
import { search as copy } from "@/content/search";
import { apiFetch } from "@/lib/api";

export const SEARCH_EVENT = "gr:search";

export function openSearch() {
  window.dispatchEvent(new Event(SEARCH_EVENT));
}

function Group({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="flex items-center gap-2 px-2 text-sm font-bold text-text-muted">
        {icon}
        {title}
      </h3>
      <ul className="flex flex-col">{children}</ul>
    </section>
  );
}

const row =
  "flex min-h-14 items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-surface-2 focus-visible:bg-surface-2";

/** One search for people, chats, public rooms and your own notes. It opens with Ctrl K, a slash or the search button. */
export function SearchDialog() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    const show = () => setOpen(true);
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = Boolean(target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "/" && !typing && !target?.isContentEditable) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener(SEARCH_EVENT, show);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(SEARCH_EVENT, show);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => setQ(text.trim().replace(/^@+/, "")), 250);
    return () => window.clearTimeout(id);
  }, [text]);

  const ready = q.length >= 2;
  const results = useQuery({
    queryKey: ["search", q],
    queryFn: () => apiFetch<SearchResults>(`/api/search?q=${encodeURIComponent(q)}`),
    enabled: open && ready,
    staleTime: 15_000,
  });

  const data = results.data;
  const empty =
    data && !data.people.length && !data.chats.length && !data.rooms.length && !data.notes.length;
  const close = () => setOpen(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink-950/55" />
        <Dialog.Content className="fixed inset-x-0 top-0 z-50 flex max-h-dvh w-full flex-col gap-3 overflow-hidden bg-surface p-4 shadow-lift md:inset-x-auto md:left-1/2 md:top-[8dvh] md:max-h-[80dvh] md:w-[min(92vw,38rem)] md:-translate-x-1/2 md:rounded-card">
          <Dialog.Title className="sr-only">{copy.title}</Dialog.Title>
          <Dialog.Description className="sr-only">{copy.hint}</Dialog.Description>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-text-muted"
              />
              <Input
                type="text"
                inputMode="search"
                autoCapitalize="none"
                spellCheck={false}
                aria-label={copy.label}
                placeholder={copy.placeholder}
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="min-h-12 pl-12"
              />
            </div>
            <Dialog.Close className="min-h-12 shrink-0 rounded-full px-3 text-sm font-semibold text-green-700 hover:bg-green-100">
              {copy.close}
            </Dialog.Close>
          </div>

          <div
            aria-live="polite"
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-2"
          >
            {!ready ? (
              <p className="px-2 text-text-muted">{copy.hint}</p>
            ) : results.isPending ? (
              <p className="px-2 text-text-muted">{copy.loading}</p>
            ) : results.isError ? (
              <div className="flex flex-col items-start gap-2 px-2">
                <p className="text-text-muted">{copy.failed}</p>
                <button
                  type="button"
                  onClick={() => void results.refetch()}
                  className="min-h-11 font-semibold text-green-700 underline-offset-4 hover:underline"
                >
                  {copy.retry}
                </button>
              </div>
            ) : empty ? (
              <p className="px-2 text-text-muted">{copy.none(q)}</p>
            ) : data ? (
              <>
                {data.people.length > 0 ? (
                  <Group title={copy.people} icon={<Users aria-hidden className="size-4" />}>
                    {data.people.map((p) => (
                      <li key={p.id}>
                        <Link href={`/app/u/${p.username}`} onClick={close} className={row}>
                          <Avatar name={p.name} src={p.avatarUrl} size={40} />
                          <span className="min-w-0">
                            <span className="block truncate font-semibold text-text">{p.name}</span>
                            <span className="block truncate text-sm text-text-muted">
                              @{p.username}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </Group>
                ) : null}
                {data.chats.length > 0 ? (
                  <Group title={copy.chats} icon={<MessageCircle aria-hidden className="size-4" />}>
                    {data.chats.map((c) => (
                      <li key={c.conversationId}>
                        <Link
                          href={`/app/chats/${c.conversationId}`}
                          onClick={close}
                          className={row}
                        >
                          <Avatar name={c.peer.name} src={c.peer.avatarUrl} size={40} />
                          <span className="min-w-0">
                            <span className="block truncate font-semibold text-text">
                              {c.peer.name}
                            </span>
                            <span className="block truncate text-sm text-text-muted">
                              @{c.peer.username}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </Group>
                ) : null}
                {data.rooms.length > 0 ? (
                  <Group title={copy.rooms} icon={<Radio aria-hidden className="size-4" />}>
                    {data.rooms.map((r) => (
                      <li key={r.slug}>
                        <Link href={`/app/rooms/${r.slug}`} onClick={close} className={row}>
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">
                            <Radio aria-hidden className="size-5" />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-semibold text-text">
                              {r.title}
                            </span>
                            <span className="block truncate text-sm text-text-muted">
                              {r.status === "LIVE" ? copy.live : copy.scheduled}
                              {r.topicName ? `, ${r.topicName}` : ""}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </Group>
                ) : null}
                {data.notes.length > 0 ? (
                  <Group title={copy.notes} icon={<NotebookPen aria-hidden className="size-4" />}>
                    {data.notes.map((n) => (
                      <li key={n.id}>
                        <Link href={n.href} onClick={close} className={row}>
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-yellow-100 text-ink-950">
                            <NotebookPen aria-hidden className="size-5" />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-semibold text-text">
                              {n.where}
                            </span>
                            <span className="line-clamp-2 text-sm text-text-muted">{n.body}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </Group>
                ) : null}
              </>
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
