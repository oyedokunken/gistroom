import type { Metadata } from "next";
import { identifierSchema } from "@gistroom/shared";
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
  searchParams: Promise<{ email?: string; auto?: string }>;
}) {
  const params = await searchParams;
  const parsed = identifierSchema.safeParse(params.email ?? "");
  return (
    <AuthShell artId={authArt.forgot}>
      <ForgotForm
        initialEmail={parsed.success ? parsed.data : ""}
        autoSend={params.auto === "1" && parsed.success}
      />
    </AuthShell>
  );
}
