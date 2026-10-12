"use client";

import { useCallback, useRef } from "react";
import { Clock, FileText, Image as ImageIcon, Paperclip } from "lucide-react";
import {
  checkUpload,
  errors,
  extensionOf,
  MEDIA_RULES,
  type MessageDto,
  type UploadVerdict,
} from "@gistroom/shared";
import { useFeedback } from "@/components/feedback/feedback-provider";
import {
  DropdownContent,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/cn";
import { useUploadStore, type UploadItem, type UploadKind } from "@/lib/chat/upload-store";
import { chat } from "@/content/chat";
import { ApiClientError } from "@/lib/api";
import { prepareImage, videoPoster } from "@/lib/chat/image";
import { uploadToChat, type ChatUploadInput } from "@/lib/chat/upload";
import { extensionForMime, formatDuration } from "@/lib/chat/voice";
import type { RecordedVoice } from "./voice-recorder";

const accept = {
  media: "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm",
  files: ".pdf,.docx,.xlsx,.pptx,.txt,.csv",
};

const newId = () => crypto.randomUUID();

/** Running uploads live outside any one composer, so switching chats never cancels them. */
const jobs = new Map<string, { run: () => Promise<void>; abort: AbortController }>();

export const retryUpload = (id: string) => void jobs.get(id)?.run();
export function cancelUpload(id: string) {
  jobs.get(id)?.abort.abort();
  jobs.delete(id);
  useUploadStore.getState().drop(id);
}

function messageFor(reason: Extract<UploadVerdict, { ok: false }>["reason"]): string {
  return reason === "TOO_BIG"
    ? errors.uploadTooBig
    : reason === "EMPTY"
      ? errors.uploadEmpty
      : reason === "MISMATCH"
        ? errors.uploadMismatch
        : errors.uploadType;
}

/** Browsers sometimes leave the type empty. Fall back to the file extension for the types we accept. */
function mimeOf(file: File): string {
  if (file.type) return file.type;
  const ext = extensionOf(file.name);
  return MEDIA_RULES.find((r) => r.exts.includes(ext))?.mime ?? "";
}

export function useUploads(args: {
  conversationId: string;
  replyToId: string | null;
  onUploaded: (message: MessageDto) => void;
  onSent: () => void;
}) {
  const { showError } = useFeedback();

  const start = useCallback(
    (
      item: Omit<UploadItem, "progress" | "status">,
      build: (signal: AbortSignal, onProgress: (f: number) => void) => Promise<ChatUploadInput>,
    ) => {
      const { patch, drop, add } = useUploadStore.getState();
      const id = item.id;
      const abort = new AbortController();
      const run = async () => {
        patch(id, { status: "uploading", progress: 0, error: undefined });
        try {
          const input = await build(abort.signal, (f) => patch(id, { progress: f }));
          const message = await uploadToChat({ ...input, signal: abort.signal });
          args.onUploaded(message);
          args.onSent();
          jobs.delete(id);
          drop(id);
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") {
            jobs.delete(id);
            return drop(id);
          }
          patch(id, {
            status: "failed",
            error: e instanceof ApiClientError ? e.message : chat.media.uploadFailed,
          });
        }
      };
      jobs.set(id, { run, abort });
      add({ ...item, progress: 0, status: "uploading" });
      void run();
    },
    [args],
  );

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      for (const file of Array.from(files)) {
        const mime = mimeOf(file);
        if (mime === "image/heic" || mime === "image/heif" || /\.hei[cf]$/i.test(file.name)) {
          showError(chat.media.heic);
          continue;
        }
        const verdict = checkUpload({ mime, name: file.name, size: file.size, purpose: "chat" });
        if (!verdict.ok) {
          showError(messageFor(verdict.reason));
          continue;
        }
        const clientId = newId();
        const kind: UploadKind =
          verdict.rule.kind === "IMAGE"
            ? "IMAGE"
            : verdict.rule.kind === "VIDEO"
              ? "VIDEO"
              : "FILE";
        start(
          {
            id: clientId,
            conversationId: args.conversationId,
            kind,
            name: file.name,
            previewUrl: kind === "FILE" ? undefined : URL.createObjectURL(file),
          },
          async (_signal, onProgress) => {
            const base = {
              conversationId: args.conversationId,
              clientId,
              name: file.name,
              replyToId: args.replyToId,
              onProgress,
            };
            if (verdict.rule.kind === "IMAGE") {
              const prepared = await prepareImage(file as File);
              if (prepared) {
                return {
                  ...base,
                  file: prepared.blob,
                  mime: "image/jpeg",
                  name: file.name.replace(/\.[^.]+$/, "") + ".jpg",
                  thumb: prepared.thumb,
                  width: prepared.width,
                  height: prepared.height,
                };
              }
              return { ...base, file, mime: verdict.rule.mime };
            }
            if (verdict.rule.kind === "VIDEO") {
              const poster = await videoPoster(file as File);
              return {
                ...base,
                file,
                mime: verdict.rule.mime,
                thumb: poster?.thumb ?? null,
                width: poster?.width ?? null,
                height: poster?.height ?? null,
              };
            }
            return { ...base, file, mime: verdict.rule.mime };
          },
        );
      }
    },
    [args.conversationId, args.replyToId, showError, start],
  );

  const addVoice = useCallback(
    (voice: RecordedVoice) => {
      const clientId = newId();
      const name = `voice-note.${extensionForMime(voice.mime)}`;
      // The tray says "Voice note", never the file name. Sending happens in the background.
      start(
        {
          id: clientId,
          conversationId: args.conversationId,
          kind: "VOICE",
          name: chat.media.voiceNoteLabel,
          durationMs: voice.durationMs,
          waveform: voice.waveform,
        },
        async (_signal, onProgress) => ({
          conversationId: args.conversationId,
          clientId,
          file: voice.blob,
          name,
          mime: voice.mime,
          replyToId: args.replyToId,
          durationMs: voice.durationMs,
          waveform: voice.waveform,
          onProgress,
        }),
      );
    },
    [args.conversationId, args.replyToId, start],
  );

  return { addFiles, addVoice };
}

export function AttachButton({ onFiles }: { onFiles: (files: FileList) => void }) {
  const media = useRef<HTMLInputElement>(null);
  const files = useRef<HTMLInputElement>(null);
  const change = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) onFiles(e.target.files);
    e.target.value = "";
  };
  return (
    <>
      <DropdownMenu>
        <DropdownTrigger asChild>
          <IconButton label={chat.media.attach}>
            <Paperclip aria-hidden className="size-5" />
          </IconButton>
        </DropdownTrigger>
        <DropdownContent align="start">
          <DropdownItem icon={ImageIcon} onSelect={() => media.current?.click()}>
            {chat.media.attachPhoto}
          </DropdownItem>
          <DropdownItem icon={FileText} onSelect={() => files.current?.click()}>
            {chat.media.attachFile}
          </DropdownItem>
        </DropdownContent>
      </DropdownMenu>
      <input
        ref={media}
        type="file"
        multiple
        accept={accept.media}
        onChange={change}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
      />
      <input
        ref={files}
        type="file"
        multiple
        accept={accept.files}
        onChange={change}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
      />
    </>
  );
}

/**
 * What is being sent, shown as a dulled bubble in the thread until it is done. No spinner, no progress bar: the
 * picture, clip, voice note or file you chose, with "Sending" under it. A failed one offers Retry and Remove.
 */
export function PendingUploads({ conversationId }: { conversationId: string }) {
  const all = useUploadStore((s) => s.items);
  const items = all.filter((i) => i.conversationId === conversationId);
  if (items.length === 0) return null;
  return (
    <ul className="mt-3 flex flex-col items-end gap-1.5" aria-live="polite">
      {items.map((i) => (
        <li key={i.id} className="flex w-full flex-col items-end">
          <div
            className={cn(
              "relative max-w-[min(78%,34rem)] rounded-bubble rounded-br-[4px] bg-green-600 px-3.5 py-2 text-white",
              i.status === "uploading" ? "opacity-60" : "ring-2 ring-danger-600",
            )}
          >
            <PendingBody item={i} />
            <span className="mt-1 flex items-center justify-end gap-1.5 text-[0.6875rem] leading-none">
              {i.status === "uploading" ? (
                <>
                  <Clock aria-hidden className="size-3" />
                  {chat.media.sending}
                </>
              ) : (
                <span role="alert">{i.error ?? chat.media.uploadFailed}</span>
              )}
            </span>
          </div>
          {i.status === "failed" ? (
            <span className="mt-1 flex gap-2">
              <button
                type="button"
                onClick={() => retryUpload(i.id)}
                className="min-h-11 rounded-full px-3 text-sm font-semibold text-green-700"
              >
                {chat.media.retryUpload}
              </button>
              <button
                type="button"
                onClick={() => cancelUpload(i.id)}
                className="min-h-11 rounded-full px-3 text-sm font-semibold text-danger-600"
              >
                {chat.media.removeUpload}
              </button>
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function PendingBody({ item }: { item: UploadItem }) {
  if (item.kind === "IMAGE" && item.previewUrl) {
    return (
      <img
        src={item.previewUrl}
        alt={item.name}
        className="max-h-72 w-[min(20rem,70vw)] rounded-xl object-cover"
      />
    );
  }
  if (item.kind === "VIDEO" && item.previewUrl) {
    return (
      <video
        src={item.previewUrl}
        muted
        playsInline
        preload="metadata"
        aria-label={item.name}
        className="max-h-72 w-[min(20rem,70vw)] rounded-xl bg-ink-950"
      />
    );
  }
  if (item.kind === "VOICE") {
    const bars = item.waveform?.length ? item.waveform : Array.from({ length: 40 }, () => 30);
    return (
      <div className="flex w-[min(17rem,62vw)] flex-col gap-1">
        <div aria-hidden className="flex h-8 items-center gap-px overflow-hidden">
          {bars.map((h, n) => (
            <span
              key={n}
              className="min-w-px max-w-[3px] flex-1 rounded-full bg-white/70"
              style={{ height: `${Math.max(12, h)}%` }}
            />
          ))}
        </div>
        <span className="tabular text-xs">{formatDuration(item.durationMs ?? 0)}</span>
      </div>
    );
  }
  return (
    <span className="flex items-center gap-2">
      <FileText aria-hidden className="size-5 shrink-0" />
      <span className="max-w-[16rem] truncate">{item.name}</span>
    </span>
  );
}
