import type { Metadata } from "next";
import { emailSchema } from "@gistroom/shared";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotForm } from "@/components/auth/forgot-form";
import { auth, authArt } from "@/content/auth";

export const metadata: Metadata = {
  title: auth.forgotPage.metaTitle,
  robots: { index: false, follow: false },
};

export default async function ForgotPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const parsed = emailSchema.safeParse((await searchParams).email ?? "");
  return (
    <AuthShell artId={authArt.login}>
      <ForgotForm initialEmail={parsed.success ? parsed.data : ""} />
    </AuthShell>
  );
}
