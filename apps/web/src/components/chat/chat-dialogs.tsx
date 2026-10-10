"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Archive,
  ArchiveRestore,
  Bell,
  BellOff,
  Flag,
  Settings,
  ShieldOff,
  Star,
  Trash2,
  UserRound,
  UserX,
  type LucideIcon,
} from "lucide-react";
import {
  REPORT_REASONS,
  previewText,
  type ConversationDto,
  type MessageDto,
  type Page,
  type ReportReason,
} from "@gistroom/shared";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { chat } from "@/content/chat";
import { ApiClientError, apiFetch } from "@/lib/api";
import { useConversations } from "@/lib/chat/hooks";
import { cn } from "@/lib/cn";
import { formatFull } from "@/lib/time";

function ActionRow({
  icon: Icon,
  danger,
  onClick,
  href,
  children,
}: {
  icon: LucideIcon;
  danger?: boolean;
  onClick?: () => void;
  href?: string;
  children: ReactNode;
}) {
  const className = cn(
    "flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-base font-medium hover:bg-surface-2",
    danger ? "text-danger-600" : "text-text",
  );
  const inner = (
    <>
      <Icon aria-hidden className="size-5 shrink-0" />
      {children}
    </>
  );
  return href ? (
    <Link href={href} onClick={onClick} className={className}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={className}>
      {inner}
    </button>
  );
}

export interface ChatSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: ConversationDto;
  onToggleMute: () => void;
  onToggleArchive: () => void;
  onStarred: () => void;
  onReport: () => void;
  onBlock: () => void;
  onUnblock: () => void;
  onClear: () => void;
}

/** One place for everything you can do to a chat. Every destructive row opens its own confirm modal. */
export function ChatSettings({
  open,
  onOpenChange,
  conversation,
  onToggleMute,
  onToggleArchive,
  onStarred,
  onReport,
  onBlock,
  onUnblock,
  onClear,
}: ChatSettingsProps) {
  const close = (run: () => void) => () => {
    onOpenChange(false);
    run();
  };
  const blocked = conversation.availability === "BLOCKED_BY_ME";
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      icon={Settings}
      title={chat.settings.title}
      description={conversation.peer.name}
    >
      <div className="-mx-2 flex flex-col">
        <ActionRow
          icon={UserRound}
          href={`/app/u/${conversation.peer.username}`}
          onClick={() => onOpenChange(false)}
        >
          {chat.settings.profile}
        </ActionRow>
        <ActionRow icon={Star} onClick={close(onStarred)}>
          {chat.settings.starred}
        </ActionRow>
        <ActionRow icon={conversation.muted ? Bell : BellOff} onClick={close(onToggleMute)}>
          {conversation.muted ? chat.settings.muteOff : chat.settings.muteOn}
        </ActionRow>
        <ActionRow
          icon={conversation.archived ? ArchiveRestore : Archive}
          onClick={close(onToggleArchive)}
        >
          {conversation.archived ? chat.settings.unarchive : chat.settings.archive}
        </ActionRow>
        <div aria-hidden className="my-1 h-px bg-border" />
        <ActionRow icon={Flag} danger onClick={close(onReport)}>
          {chat.settings.report}
        </ActionRow>
        {blocked ? (
          <ActionRow icon={ShieldOff} onClick={close(onUnblock)}>
            {chat.blockedByMe.unblock}
          </ActionRow>
        ) : (
          <ActionRow icon={UserX} danger onClick={close(onBlock)}>
            {chat.settings.block}
          </ActionRow>
        )}
        <ActionRow icon={Trash2} danger onClick={close(onClear)}>
          {chat.settings.clear}
        </ActionRow>
      </div>
    </Modal>
  );
}

export function ReportDialog({
  open,
  onOpenChange,
  conversationId,
  messageId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  messageId?: string;
}) {
  const { showError, showSuccess } = useFeedback();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!reason) {
      setError(chat.report.reasonLabel);
      return;
    }
    setBusy(true);
    try {
      await apiFetch(`/api/conversations/${conversationId}/report`, {
        body: { reason, details: details.trim() || undefined, messageId },
      });
      onOpenChange(false);
      setReason(null);
      setDetails("");
      setError(null);
      showSuccess(chat.report.done);
    } catch (e) {
      showError(e instanceof ApiClientError ? e.message : chat.loadError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      icon={Flag}
      tone="error"
      title={chat.report.title}
      description={chat.report.body}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {chat.edit.cancel}
          </Button>
          <Button variant="danger" loading={busy} onClick={() => void submit()}>
            {chat.report.submit}
          </Button>
        </>
      }
    >
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-sm font-semibold text-text">{chat.report.reasonLabel}</legend>
        {REPORT_REASONS.map((r) => (
          <label
            key={r}
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 hover:bg-surface-2"
          >
            <input
              type="radio"
              name="report-reason"
              value={r}
              checked={reason === r}
              onChange={() => {
                setReason(r);
                setError(null);
              }}
              className="size-4 accent-green-600"
            />
            <span className="text-base text-text">{chat.report.reasons[r]}</span>
          </label>
        ))}
        {error ? (
          <p role="alert" className="text-sm font-medium text-danger-600">
            {error}
          </p>
        ) : null}
      </fieldset>
      <label className="mt-3 block text-sm font-semibold text-text" htmlFor="report-details">
        {chat.report.detailsLabel}
      </label>
      <Textarea
        id="report-details"
        rows={3}
        value={details}
        placeholder={chat.report.detailsPlaceholder}
        onChange={(e) => setDetails(e.target.value)}
        className="mt-1"
      />
    </Modal>
  );
}

/** Starred messages for one chat, or for every chat when no conversation is given. */
export function StarredDialog({
  open,
  onOpenChange,
  conversationId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId?: string;
}) {
  const conversations = useConversations(false);
  const archived = useConversations(true);
  const starred = useQuery({
    queryKey: ["starred"],
    queryFn: () => apiFetch<Page<MessageDto>>("/api/starred?limit=50"),
    enabled: open,
  });
  const peers = new Map<string, string>();
  for (const c of [
    ...(conversations.data?.conversations ?? []),
    ...(archived.data?.conversations ?? []),
  ]) {
    peers.set(c.id, c.peer.name);
  }
  const items = (starred.data?.items ?? []).filter(
    (m) => !conversationId || m.conversationId === conversationId,
  );
  return (
    <Modal open={open} onOpenChange={onOpenChange} icon={Star} title={chat.starredDialog.title}>
      {starred.isPending ? (
        <p className="text-text-muted">{chat.loadingOlder}</p>
      ) : starred.isError ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-text-muted">{chat.loadError}</p>
          <Button variant="secondary" onClick={() => void starred.refetch()}>
            {chat.retry}
          </Button>
        </div>
      ) : items.length === 0 ? (
        <p className="text-text-muted">
          {conversationId ? chat.starredDialog.empty : chat.starredDialog.emptyAll}
        </p>
      ) : (
        <ul className="-mx-2 flex max-h-[55dvh] flex-col gap-1 overflow-y-auto">
          {items.map((m) => (
            <li key={m.id}>
              <Link
                href={`/app/chats/${m.conversationId}`}
                onClick={() => onOpenChange(false)}
                className="flex flex-col gap-0.5 rounded-xl px-3 py-2 hover:bg-surface-2"
              >
                <span className="text-sm font-semibold text-green-700">
                  {peers.get(m.conversationId) ?? chat.title}
                </span>
                <span className="line-clamp-2 text-base text-text">
                  {previewText({
                    type: m.type,
                    body: m.body,
                    deletedForEveryone: m.deletedForEveryone,
                    mine: false,
                  })}
                </span>
                <span className="tabular text-xs text-text-muted">
                  {formatFull(new Date(m.createdAt))}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
