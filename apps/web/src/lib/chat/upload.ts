import type { FinalizeUploadInput, MessageDto, SignedUpload } from "@gistroom/shared";
import { ApiClientError, apiFetch } from "@/lib/api";
import { network } from "@/content/errors";

/** PUT a file straight to storage with progress. Resolves when the bytes are stored. */
export function putFile(
  url: string,
  blob: Blob,
  mime: string,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", mime);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new ApiClientError(xhr.status, "SERVER", network.server));
    xhr.onerror = () => reject(new ApiClientError(0, "NETWORK", network.offline));
    xhr.onabort = () => reject(new DOMException("aborted", "AbortError"));
    signal?.addEventListener("abort", () => xhr.abort());
    xhr.send(blob);
  });
}

export interface ChatUploadInput {
  conversationId: string;
  clientId: string;
  file: Blob;
  name: string;
  mime: string;
  thumb?: Blob | null;
  caption?: string | null;
  replyToId?: string | null;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
  waveform?: number[] | null;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

/** Ask for a slot, upload the file (and its preview), then ask the server to turn it into a message. */
export async function uploadToChat(input: ChatUploadInput): Promise<MessageDto> {
  const main = await apiFetch<SignedUpload>("/api/media/sign", {
    body: {
      conversationId: input.conversationId,
      name: input.name,
      mime: input.mime,
      size: input.file.size,
      role: "main",
    },
    signal: input.signal,
  });
  let thumbAssetId: string | null = null;
  if (input.thumb) {
    try {
      const t = await apiFetch<SignedUpload>("/api/media/sign", {
        body: {
          conversationId: input.conversationId,
          name: "preview.jpg",
          mime: "image/jpeg",
          size: input.thumb.size,
          role: "thumb",
        },
        signal: input.signal,
      });
      await putFile(t.uploadUrl, input.thumb, "image/jpeg", undefined, input.signal);
      thumbAssetId = t.assetId;
    } catch (e) {
      if (e instanceof DOMException) throw e;
      thumbAssetId = null; // The preview is optional. The file still goes.
    }
  }
  await putFile(main.uploadUrl, input.file, input.mime, input.onProgress, input.signal);
  const body: FinalizeUploadInput = {
    clientId: input.clientId,
    assetId: main.assetId,
    fileName: input.name,
    thumbAssetId,
    caption: input.caption ?? null,
    replyToId: input.replyToId ?? null,
    width: input.width ?? null,
    height: input.height ?? null,
    durationMs: input.durationMs ?? null,
    waveform: input.waveform ?? null,
  };
  const res = await apiFetch<{ message: MessageDto }>(
    `/api/conversations/${input.conversationId}/attachments`,
    { body, signal: input.signal },
  );
  return res.message;
}

/** Upload a profile photo to the public avatars bucket and make it the current one. */
export async function uploadAvatar(file: Blob, name: string, mime: string): Promise<void> {
  const slot = await apiFetch<SignedUpload>("/api/avatar/sign", {
    body: { name, mime, size: file.size },
  });
  await putFile(slot.uploadUrl, file, mime);
  await apiFetch("/api/avatar/commit", { body: { assetId: slot.assetId } });
}
