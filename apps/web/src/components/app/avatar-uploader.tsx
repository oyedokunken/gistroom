"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { checkUpload, errors, isDefaultAvatar } from "@gistroom/shared";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { avatarUploader as copy } from "@/content/app";
import { ApiClientError, apiFetch } from "@/lib/api";
import { prepareImage } from "@/lib/chat/image";
import { uploadAvatar } from "@/lib/chat/upload";

/** Pick a photo, squeeze it on the phone, upload it to storage and make it the profile photo. */
export function AvatarUploader({
  name,
  avatarUrl,
  onChanged,
}: {
  name: string;
  avatarUrl: string | null;
  onChanged?: () => void;
}) {
  const router = useRouter();
  const { confirm, showError } = useFeedback();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(avatarUrl);
  // The illustrated default is not a photo the person uploaded.
  const hasPhoto = Boolean(preview) && !isDefaultAvatar(preview);

  async function pick(file: File) {
    const verdict = checkUpload({
      mime: file.type,
      name: file.name,
      size: file.size,
      purpose: "avatar",
    });
    if (!verdict.ok) {
      showError(verdict.reason === "TOO_BIG" ? errors.uploadTooBig : errors.uploadNotImage);
      return;
    }
    setBusy(true);
    try {
      const prepared = await prepareImage(file);
      const blob = prepared?.blob ?? file;
      const mime = prepared ? "image/jpeg" : file.type;
      const upName = prepared ? "avatar.jpg" : file.name;
      await uploadAvatar(blob, upName, mime);
      setPreview(URL.createObjectURL(blob));
      router.refresh();
      onChanged?.();
    } catch (e) {
      showError(e instanceof ApiClientError ? e.message : copy.failed);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const ok = await confirm({
      title: copy.removeTitle,
      message: copy.removeBody,
      confirmLabel: copy.removeConfirm,
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await apiFetch("/api/avatar/commit", { method: "DELETE", body: {} });
      setPreview(null);
      router.refresh();
      onChanged?.();
    } catch (e) {
      showError(e instanceof ApiClientError ? e.message : copy.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar name={name || "?"} src={preview} size={72} />
      <div className="flex flex-col items-start gap-2">
        <span className="text-sm font-semibold text-text">{copy.label}</span>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            loading={busy}
            onClick={() => input.current?.click()}
          >
            {hasPhoto ? copy.change : copy.add}
          </Button>
          {hasPhoto ? (
            <Button type="button" variant="ghost" disabled={busy} onClick={() => void remove()}>
              {copy.remove}
            </Button>
          ) : null}
        </div>
        <span className="text-xs text-text-muted">{copy.help}</span>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void pick(file);
        }}
      />
    </div>
  );
}
