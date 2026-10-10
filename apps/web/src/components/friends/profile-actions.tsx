"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { UserX } from "lucide-react";
import type { PersonResult } from "@gistroom/shared";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { Button } from "@/components/ui/button";
import { friends } from "@/content/friends";
import { ApiClientError, apiFetch } from "@/lib/api";
import { PersonActions } from "./person-actions";

export function ProfileActions({
  profile,
}: {
  profile: PersonResult & { conversationId: string | null; pendingRequestId: string | null };
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { confirm, showError } = useFeedback();

  async function block() {
    const ok = await confirm({
      title: friends.blockTitle(profile.name),
      message: friends.blockBody,
      confirmLabel: friends.blockConfirm,
      destructive: true,
    });
    if (!ok) return;
    try {
      await apiFetch("/api/blocks", { body: { userId: profile.id } });
      void queryClient.invalidateQueries();
      router.replace("/app/friends");
    } catch (e) {
      if (e instanceof ApiClientError) showError(e.message);
      else throw e;
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <PersonActions
        user={profile}
        relationship={profile.relationship}
        pendingRequestId={profile.pendingRequestId}
        conversationId={profile.conversationId}
        onChanged={() => router.refresh()}
      />
      <Button
        variant="ghost"
        className="border border-border"
        icon={<UserX aria-hidden className="size-4" />}
        onClick={() => void block()}
      >
        {friends.block}
      </Button>
    </div>
  );
}
