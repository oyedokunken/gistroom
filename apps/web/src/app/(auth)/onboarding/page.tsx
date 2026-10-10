import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { OnboardingForm } from "@/components/auth/onboarding-form";
import { auth, authArt } from "@/content/auth";
import { getSessionContext } from "@/server/auth/session";
import { safeNext } from "@/server/auth/google";

export const metadata: Metadata = {
  title: auth.onboarding.metaTitle,
  robots: { index: false, follow: false },
};

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeNext((await searchParams).next);
  const ctx = await getSessionContext();
  if (!ctx) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (ctx.user.onboardedAt) redirect(next);
  return (
    <AuthShell artId={authArt.onboarding}>
      <OnboardingForm defaultName={ctx.user.name} next={next} />
    </AuthShell>
  );
}
