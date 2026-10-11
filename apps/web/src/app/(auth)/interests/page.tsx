import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { InterestPicker } from "@/components/interests/interest-picker";
import { authArt } from "@/content/auth";
import { interests as copy } from "@/content/interests";
import { safeNext } from "@/server/auth/google";
import { getSessionContext } from "@/server/auth/session";
import { getInterests } from "@/server/interests/service";

export const metadata: Metadata = {
  title: copy.metaTitle,
  robots: { index: false, follow: false },
};

export default async function InterestsPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; first?: string }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next, "/app/discover");
  const ctx = await getSessionContext();
  if (!ctx) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (!ctx.user.onboardedAt) redirect(`/onboarding?next=${encodeURIComponent(next)}`);
  const current = await getInterests(ctx.user.id);
  // Only the first time, straight after sign up, the walkthrough follows. Changing interests later just goes back.
  const to = params.first ? `${next}${next.includes("?") ? "&" : "?"}welcome=1` : next;
  return (
    <AuthShell artId={authArt.onboarding}>
      <div className="flex flex-col gap-2">
        <h1 className="text-[clamp(1.875rem,5vw,2.5rem)] font-bold leading-[1.1] tracking-tight text-text">
          {copy.heading}
        </h1>
        <p className="text-text-muted">{copy.subhead}</p>
      </div>
      <InterestPicker initial={current} to={to} />
    </AuthShell>
  );
}
