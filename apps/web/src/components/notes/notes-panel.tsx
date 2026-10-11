"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Lock, Pencil, Trash2 } from "lucide-react";
import { z } from "zod";
import { noteBodySchema, type NoteDto } from "@gistroom/shared";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Textarea } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Skeleton } from "@/components/ui/skeleton";
import { notes as copy } from "@/content/notes";
import { ApiClientError, apiFetch } from "@/lib/api";
import { formatFull } from "@/lib/time";

export type NotesScope = { conversationId: string } | { roomSlug: string };

const formSchema = z.object({ body: noteBodySchema });
type FormValues = z.infer<typeof formSchema>;

const scopeKey = (s: NotesScope) =>
  "conversationId" in s ? `c:${s.conversationId}` : `r:${s.roomSlug}`;
const scopeQuery = (s: NotesScope) =>
  "conversationId" in s
    ? `conversationId=${encodeURIComponent(s.conversationId)}`
    : `room=${encodeURIComponent(s.roomSlug)}`;

function NoteForm({
  initial,
  submitLabel,
  busyLabel,
  onSubmit,
  onCancel,
}: {
  initial: string;
  submitLabel: string;
  busyLabel: string;
  onSubmit: (body: string) => Promise<void>;
  onCancel?: () => void;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { body: initial },
  });
  const body = form.watch("body");
  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(async (v) => {
        await onSubmit(v.body);
        form.reset({ body: onCancel ? v.body : "" });
      })}
      className="flex flex-col gap-2"
    >
      <Field label={copy.label} error={form.formState.errors.body?.message}>
        {(props) => (
          <Textarea {...props} rows={3} placeholder={copy.placeholder} {...form.register("body")} />
        )}
      </Field>
      <div className="flex items-center justify-between gap-2">
        <span className="tabular text-xs text-text-muted">{copy.count(body.length)}</span>
        <div className="flex gap-2">
          {onCancel ? (
            <Button type="button" variant="secondary" onClick={onCancel}>
              {copy.cancel}
            </Button>
          ) : null}
          <Button type="submit" loading={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? busyLabel : submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}

/** Private notes for one chat or one room. It works the same in both places. */
export function NotesPanel({ scope }: { scope: NotesScope }) {
  const queryClient = useQueryClient();
  const { confirm, showError } = useFeedback();
  const [editing, setEditing] = useState<string | null>(null);
  const key = ["notes", scopeKey(scope)];

  const list = useQuery({
    queryKey: key,
    queryFn: () => apiFetch<{ notes: NoteDto[] }>(`/api/notes?${scopeQuery(scope)}`),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
  const fail = (e: unknown) => showError(e instanceof ApiClientError ? e.message : copy.loadError);

  const add = useMutation({
    mutationFn: (body: string) => apiFetch("/api/notes", { body: { ...scope, body } }),
    onSuccess: refresh,
    onError: fail,
  });
  const update = useMutation({
    mutationFn: (v: { id: string; body: string }) =>
      apiFetch(`/api/notes/${v.id}`, { method: "PATCH", body: { body: v.body } }),
    onSuccess: () => {
      setEditing(null);
      void refresh();
    },
    onError: fail,
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/notes/${id}`, { method: "DELETE" }),
    onSuccess: refresh,
    onError: fail,
  });

  async function ask(id: string) {
    const ok = await confirm({
      title: copy.removeTitle,
      message: copy.removeBody,
      confirmLabel: copy.removeConfirm,
      destructive: true,
    });
    if (ok) remove.mutate(id);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
      <p className="flex items-center gap-2 text-sm text-text-muted">
        <Lock aria-hidden className="size-4 shrink-0 text-green-600" />
        {copy.privacy}
      </p>
      <NoteForm
        initial=""
        submitLabel={copy.add}
        busyLabel={copy.adding}
        onSubmit={async (body) => {
          await add.mutateAsync(body).catch(() => undefined);
        }}
      />
      {list.isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : list.isError ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-text-muted">{copy.loadError}</p>
          <Button variant="secondary" onClick={() => void list.refetch()}>
            {copy.retry}
          </Button>
        </div>
      ) : list.data.notes.length === 0 ? (
        <EmptyState icon="notes" title={copy.emptyTitle} body={copy.emptyBody} />
      ) : (
        <ul className="flex flex-col gap-2">
          {list.data.notes.map((n) => (
            <li key={n.id} className="rounded-2xl bg-yellow-100 p-3 text-ink-950">
              {editing === n.id ? (
                <NoteForm
                  initial={n.body}
                  submitLabel={copy.save}
                  busyLabel={copy.adding}
                  onCancel={() => setEditing(null)}
                  onSubmit={async (body) => {
                    await update.mutateAsync({ id: n.id, body }).catch(() => undefined);
                  }}
                />
              ) : (
                <>
                  <p className="whitespace-pre-wrap break-words">{n.body}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <time
                      dateTime={n.createdAt}
                      title={formatFull(new Date(n.createdAt))}
                      className="tabular text-xs text-ink-700"
                    >
                      {formatFull(new Date(n.createdAt))}
                      {n.updatedAt !== n.createdAt ? ` (${copy.edited})` : ""}
                    </time>
                    <span className="flex">
                      <IconButton label={copy.edit} onClick={() => setEditing(n.id)}>
                        <Pencil aria-hidden className="size-4" />
                      </IconButton>
                      <IconButton label={copy.remove} onClick={() => void ask(n.id)}>
                        <Trash2 aria-hidden className="size-4" />
                      </IconButton>
                    </span>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
