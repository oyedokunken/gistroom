"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { appNav } from "@/content/app";
import { ApiClientError, apiFetch } from "@/lib/api";
import { clearAuthedHint } from "@/lib/authed-hint";
import { unsubscribeFromPush } from "@/lib/push-client";

/** Sign out with a confirmation modal. Used by the avatar menu and the Settings button. */
export function useSignOut() {
  const router = useRouter();
  const { confirm, showError } = useFeedback();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    const ok = await confirm({
      title: appNav.signOutTitle,
      message: appNav.signOutConfirm,
      confirmLabel: appNav.signOut,
    });
    if (!ok) return;
    setBusy(true);
    try {
      // Signing out on purpose also stops alerts here, so a shared computer never shows the next person's gist.
      await unsubscribeFromPush().catch(() => undefined);
      await apiFetch("/api/auth/logout", { method: "POST", body: {} });
      clearAuthedHint();
      router.replace("/login");
      router.refresh();
    } catch (e) {
      setBusy(false);
      if (e instanceof ApiClientError) showError(e.message);
      else throw e;
    }
  }

  return { signOut, busy };
}
