import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { emailSchema } from "@gistroom/shared";
import { AuthShell } from "@/components/auth/auth-shell";
import { VerifyForm } from "@/components/auth/verify-form";
import { buttonStyles } from "@/components/ui/button";
import { auth, authArt } from "@/content/auth";
import { getSessionContext } from "@/server/auth/session";
import { safeNext } from "@/server/auth/google";

export const metadata: Metadata = {
  title: auth.verify.metaTitle,
  robots: { index: false, follow: false },
};

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; email?: string }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const ctx = await getSessionContext();
  if (ctx?.user.onboardedAt) redirect(next);
  const email = emailSchema.safeParse(params.email ?? "");
  return (
    <AuthShell artId={authArt.verify}>
      {email.success ? (
        <VerifyForm email={email.data} next={next} />
      ) : (
        <>
          <h1 className="text-3xl font-bold tracking-tight text-text">{auth.verify.title}</h1>
          <p className="text-text-muted">{auth.verify.missingEmail}</p>
          <Link href="/login" className={buttonStyles("primary", "w-fit")}>
            {auth.login.title}
          </Link>
        </>
      )}
    </AuthShell>
  );
}
