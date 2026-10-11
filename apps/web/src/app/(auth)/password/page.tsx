import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { PasswordForm } from "@/components/auth/password-form";
import { auth, authArt } from "@/content/auth";
import { getSessionContext } from "@/server/auth/session";
import { safeNext } from "@/server/auth/google";

export const metadata: Metadata = {
  title: auth.password.metaTitle,
  robots: { index: false, follow: false },
};

export default async function PasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeNext((await searchParams).next);
  const ctx = await getSessionContext();
  if (!ctx) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (ctx.user.passwordHash) {
    redirect(ctx.user.onboardedAt ? next : `/onboarding?next=${encodeURIComponent(next)}`);
  }
  return (
    <AuthShell artId={authArt.onboarding}>
      <PasswordForm next={next} />
    </AuthShell>
  );
}
