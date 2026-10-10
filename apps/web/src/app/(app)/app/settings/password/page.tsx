import type { Metadata } from "next";
import { BackLink } from "@/components/app/back-link";
import { PasswordForm } from "@/components/app/password-form";
import { passwordSettings } from "@/content/app";
import { requireUserForPage } from "@/server/auth/page";

export const metadata: Metadata = { title: passwordSettings.heading };

export default async function PasswordSettingsPage() {
  const { user } = await requireUserForPage();
  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/app/settings" />
      <h2 className="text-xl font-bold text-text">{passwordSettings.heading}</h2>
      <PasswordForm hasPassword={user.passwordHash !== null} email={user.email} />
    </div>
  );
}
