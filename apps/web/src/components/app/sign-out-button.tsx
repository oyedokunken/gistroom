"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { Button } from "@/components/ui/button";
import { appNav } from "@/content/app";
import { ApiClientError, apiFetch } from "@/lib/api";

export function SignOutButton() {
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
      await apiFetch("/api/auth/logout", { method: "POST", body: {} });
      router.replace("/login");
      router.refresh();
    } catch (e) {
      setBusy(false);
      if (e instanceof ApiClientError) showError(e.message);
      else throw e;
    }
  }

  return (
    <Button
      variant="ghost"
      loading={busy}
      icon={<LogOut aria-hidden className="size-4" />}
      onClick={() => void signOut()}
      className="w-fit border border-border"
    >
      {busy ? appNav.signingOut : appNav.signOut}
    </Button>
  );
}
