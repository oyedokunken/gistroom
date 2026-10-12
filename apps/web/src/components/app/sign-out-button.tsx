"use client";

import { LogOut } from "lucide-react";
import { useSignOut } from "@/components/app/use-sign-out";
import { Button } from "@/components/ui/button";
import { appNav } from "@/content/app";

export function SignOutButton() {
  const { signOut, busy } = useSignOut();
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
