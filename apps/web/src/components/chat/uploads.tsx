"use client";

import { useCallback, useRef, useState } from "react";
import { FileText, Image as ImageIcon, Loader2, Paperclip, RotateCw, X } from "lucide-react";
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
import { chat } from "@/content/chat";
import { ApiClientError } from "@/lib/api";
import { prepareImage, videoPoster } from "@/lib/chat/image";
import { uploadToChat, type ChatUploadInput } from "@/lib/chat/upload";
import { extensionForMime } from "@/lib/chat/voice";
import type { RecordedVoice } from "./voice-recorder";

export interface UploadItem {
  id: string;
  name: string;
  progress: number;
  status: "uploading" | "failed";
  error?: string;
}

const accept = {
  media: "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm",
  files: ".pdf,.docx,.xlsx,.pptx,.txt,.csv",
};

const newId = () => crypto.randomUUID();

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
  const [items, setItems] = useState<UploadItem[]>([]);
  const jobs = useRef(new Map<string, { run: () => Promise<void>; abort: AbortController }>());

  const patch = useCallback((id: string, change: Partial<UploadItem>) => {
    setItems((list) => list.map((i) => (i.id === id ? { ...i, ...change } : i)));
  }, []);
  const drop = useCallback((id: string) => {
    jobs.current.delete(id);
    setItems((list) => list.filter((i) => i.id !== id));
  }, []);

  const start = useCallback(
    (
      id: string,
      name: string,
      build: (signal: AbortSignal, onProgress: (f: number) => void) => Promise<ChatUploadInput>,
    ) => {
      const abort = new AbortController();
      const run = async () => {
        patch(id, { status: "uploading", progress: 0, error: undefined });
        try {
          const input = await build(abort.signal, (f) => patch(id, { progress: f }));
          const message = await uploadToChat({ ...input, signal: abort.signal });
          args.onUploaded(message);
          args.onSent();
          drop(id);
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") return drop(id);
          patch(id, {
            status: "failed",
            error: e instanceof ApiClientError ? e.message : chat.media.uploadFailed,
          });
        }
      };
      jobs.current.set(id, { run, abort });
      setItems((list) => [...list, { id, name, progress: 0, status: "uploading" }]);
      void run();
    },
    [args, drop, patch],
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
        start(clientId, file.name, async (_signal, onProgress) => {
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
        });
      }
    },
    [args.conversationId, args.replyToId, showError, start],
  );

  const addVoice = useCallback(
    (voice: RecordedVoice) => {
      const clientId = newId();
      const name = `voice-note.${extensionForMime(voice.mime)}`;
      start(clientId, name, async (_signal, onProgress) => ({
        conversationId: args.conversationId,
        clientId,
        file: voice.blob,
        name,
        mime: voice.mime,
        replyToId: args.replyToId,
        durationMs: voice.durationMs,
        waveform: voice.waveform,
        onProgress,
      }));
    },
    [args.conversationId, args.replyToId, start],
  );

  const retry = useCallback((id: string) => void jobs.current.get(id)?.run(), []);
  const cancel = useCallback(
    (id: string) => {
      jobs.current.get(id)?.abort.abort();
      drop(id);
    },
    [drop],
  );

  return { items, addFiles, addVoice, retry, cancel };
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

export function UploadTray({
  items,
  onRetry,
  onCancel,
}: {
  items: UploadItem[];
  onRetry: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <ul className="mb-2 flex flex-col gap-2" aria-live="polite">
      {items.map((i) => (
        <li
          key={i.id}
          className="flex items-center gap-3 rounded-lg bg-surface-2 px-3 py-2 text-sm"
        >
          {i.status === "uploading" ? (
            <Loader2 aria-hidden className="size-4 shrink-0 animate-spin text-green-600" />
          ) : (
            <RotateCw aria-hidden className="size-4 shrink-0 text-danger-600" />
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium text-text">{i.name}</span>
            {i.status === "uploading" ? (
              <span
                role="progressbar"
                aria-label={chat.media.uploading}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(i.progress * 100)}
                className="mt-1 block h-1.5 overflow-hidden rounded-full bg-border"
              >
                <span
                  className="block h-full origin-left bg-green-600 transition-transform"
                  style={{ transform: `scaleX(${Math.max(0.04, i.progress)})` }}
                />
              </span>
            ) : (
              <span role="alert" className="block text-danger-600">
                {i.error ?? chat.media.uploadFailed}
              </span>
            )}
          </span>
          {i.status === "failed" ? (
            <button
              type="button"
              onClick={() => onRetry(i.id)}
              className="min-h-11 rounded-full px-3 font-semibold text-green-700"
            >
              {chat.media.retryUpload}
            </button>
          ) : null}
          <IconButton
            label={i.status === "failed" ? chat.media.removeUpload : chat.media.cancelUpload}
            onClick={() => onCancel(i.id)}
            className="-mr-2"
          >
            <X aria-hidden className="size-4" />
          </IconButton>
        </li>
      ))}
    </ul>
  );
}
