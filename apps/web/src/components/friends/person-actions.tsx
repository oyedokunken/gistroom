"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MessageCircle, UserCheck, UserPlus } from "lucide-react";
import type { Relationship, PublicUser } from "@gistroom/shared";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { Button } from "@/components/ui/button";
import { friends } from "@/content/friends";
import { ApiClientError, apiFetch } from "@/lib/api";

export interface PersonActionsProps {
  user: PublicUser;
  relationship: Relationship;
  /** The request the other person sent me, so Accept can answer it. */
  pendingRequestId?: string | null;
  conversationId?: string | null;
  onChanged?: () => void;
}

/** The right action for one person: Add friend, Request sent, Accept, Message, or nothing when unavailable. */
export function PersonActions({
  user,
  relationship,
  pendingRequestId,
  conversationId,
  onChanged,
}: PersonActionsProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showError, showInfo, showSuccess } = useFeedback();
  const [busy, setBusy] = useState(false);
  const [local, setLocal] = useState<Relationship>(relationship);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      void queryClient.invalidateQueries({ queryKey: ["friends"] });
      void queryClient.invalidateQueries({ queryKey: ["requests"] });
      onChanged?.();
    } catch (e) {
      if (e instanceof ApiClientError) {
        if (e.status === 409) {
          setLocal("UNAVAILABLE");
          showInfo(e.message);
        } else showError(e.message);
      } else throw e;
    } finally {
      setBusy(false);
    }
  }

  async function openChat() {
    await run(async () => {
      const id =
        conversationId ??
        (
          await apiFetch<{ conversationId: string }>("/api/conversations", {
            body: { userId: user.id },
          })
        ).conversationId;
      router.push(`/app/chats/${id}`);
    });
  }

  if (local === "UNAVAILABLE") return null;

  if (local === "FRIENDS") {
    return (
      <Button
        variant="secondary"
        loading={busy}
        icon={<MessageCircle aria-hidden className="size-4" />}
        onClick={() => void openChat()}
      >
        {friends.message}
      </Button>
    );
  }
  if (local === "REQUEST_SENT") {
    return (
      <Button
        variant="ghost"
        disabled
        icon={<UserCheck aria-hidden className="size-4" />}
        className="border border-border"
      >
        {friends.requestSent}
      </Button>
    );
  }
  if (local === "REQUEST_RECEIVED" && pendingRequestId) {
    return (
      <Button
        loading={busy}
        onClick={() =>
          void run(async () => {
            await apiFetch(`/api/friends/requests/${pendingRequestId}/accept`, { body: {} });
            setLocal("FRIENDS");
            showSuccess(friends.nowFriends(user.name));
          })
        }
      >
        {friends.accept}
      </Button>
    );
  }
  return (
    <Button
      loading={busy}
      icon={<UserPlus aria-hidden className="size-4" />}
      onClick={() =>
        void run(async () => {
          const res = await apiFetch<{ status: string }>("/api/friends/requests", {
            body: { userId: user.id },
          });
          if (res.status === "ACCEPTED") {
            setLocal("FRIENDS");
            showSuccess(friends.nowFriends(user.name));
          } else {
            setLocal("REQUEST_SENT");
            showInfo(friends.requestSentBody(user.name), friends.requestSentTitle);
          }
        })
      }
    >
      {friends.addFriend}
    </Button>
  );
}
