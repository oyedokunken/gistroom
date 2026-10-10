import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app/app-shell";
import { getSessionContext } from "@/server/auth/session";
import { toMe } from "@/server/users/serialize";

// Every authed page is noindex (Section 12.2).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: { default: "Gistroom", template: "%s | Gistroom" },
};

export default async function AppLayout({ children }: { children: ReactNode }) {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login?error=session_expired");
  if (!ctx.user.onboardedAt) redirect("/onboarding");
  return <AppShell user={toMe(ctx.user)}>{children}</AppShell>;
}
