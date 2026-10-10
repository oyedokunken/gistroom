import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/login-form";
import { auth, authArt } from "@/content/auth";
import { getSessionContext } from "@/server/auth/session";
import { safeNext } from "@/server/auth/google";

export const metadata: Metadata = {
  title: auth.signup.metaTitle,
  description: auth.signup.metaDescription,
  robots: { index: false, follow: false },
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const ctx = await getSessionContext();
  if (ctx?.user.onboardedAt) redirect(next);
  if (ctx) redirect(`/onboarding?next=${encodeURIComponent(next)}`);
  return (
    <AuthShell artId={authArt.signup}>
      <SignupForm next={next} error={params.error} />
    </AuthShell>
  );
}
