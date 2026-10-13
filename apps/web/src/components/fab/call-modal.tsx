"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Phone, Search, Video } from "lucide-react";
import type { FriendDto } from "@gistroom/shared";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { Avatar } from "@/components/ui/avatar";
import { buttonStyles } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { fab as copy } from "@/content/fab";
import { ApiClientError, apiFetch } from "@/lib/api";
import { startCallRequest } from "@/lib/calls/api";
import { handleStartCallError } from "@/lib/live/call-outcomes";
import Link from "next/link";

/** Pick a friend, then the call starts. The button that opened this says whether it is audio or video. */
export function CallModal({
  media,
  open,
  onOpenChange,
}: {
  media: "AUDIO" | "VIDEO";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { showError } = useFeedback();
  const [text, setText] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const friends = useQuery({
    queryKey: ["friends"],
    queryFn: () => apiFetch<{ friends: FriendDto[] }>("/api/friends"),
    enabled: open,
  });
  const video = media === "VIDEO";

  const shown = useMemo(() => {
    const q = text.trim().toLowerCase().replace(/^@/, "");
    const all = friends.data?.friends ?? [];
    if (!q) return all;
    return all.filter((f) => f.user.name.toLowerCase().includes(q) || f.user.username.includes(q));
  }, [friends.data, text]);

  async function call(f: FriendDto) {
    setBusyId(f.user.id);
    try {
      const conversationId =
        f.conversationId ??
        (
          await apiFetch<{ conversationId: string }>("/api/conversations", {
            body: { userId: f.user.id },
          })
        ).conversationId;
      const started = await startCallRequest(conversationId, media);
      onOpenChange(false);
      router.push(`/app/call/${started.call.id}`);
    } catch (e) {
      setBusyId(null);
      if (e instanceof ApiClientError) {
        handleStartCallError(e, f.user.name, { push: (p) => router.push(p) });
      } else {
        showError(copy.call.failed);
      }
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      icon={video ? Video : Phone}
      title={video ? copy.call.titleVideo : copy.call.titleAudio}
      description={copy.call.body}
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
            aria-label={copy.call.search}
            placeholder={copy.call.search}
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoComplete="off"
            className="rounded-full pl-11"
          />
        </div>
        {friends.isPending ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : (friends.data?.friends.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <p className="text-text-muted">{copy.call.noFriends}</p>
            <Link
              href="/app/friends?tab=find"
              onClick={() => onOpenChange(false)}
              className={buttonStyles("primary")}
            >
              {copy.call.findFriends}
            </Link>
          </div>
        ) : shown.length === 0 ? (
          <p className="py-4 text-center text-text-muted">{copy.call.none}</p>
        ) : (
          <ul className="-mx-2 flex max-h-[50dvh] flex-col overflow-y-auto">
            {shown.map((f) => (
              <li key={f.user.id}>
                <button
                  type="button"
                  disabled={busyId !== null}
                  aria-label={copy.call.friendLabel(f.user.name, video ? "Video" : "Audio")}
                  onClick={() => void call(f)}
                  className="flex min-h-14 w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-surface-2 disabled:opacity-60"
                >
                  <Avatar name={f.user.name} src={f.user.avatarUrl} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-text">{f.user.name}</span>
                    <span className="block truncate text-sm text-text-muted">
                      {busyId === f.user.id
                        ? copy.call.calling(f.user.name)
                        : `@${f.user.username}`}
                    </span>
                  </span>
                  {video ? (
                    <Video aria-hidden className="size-5 text-green-700" />
                  ) : (
                    <Phone aria-hidden className="size-5 text-green-700" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
