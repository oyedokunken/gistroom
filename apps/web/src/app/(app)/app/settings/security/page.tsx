import type { Metadata } from "next";
import { BackLink } from "@/components/app/back-link";
import { PasswordForm } from "@/components/app/password-form";
import { ChangeEmailForm, ResetByEmail } from "@/components/app/security-forms";
import { passwordSettings, settings } from "@/content/app";
import { requireUserForPage } from "@/server/auth/page";

export const metadata: Metadata = { title: settings.security.heading };

export default async function SecuritySettingsPage() {
  const { user } = await requireUserForPage();
  const hasPassword = user.passwordHash !== null;
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-4">
        <BackLink href="/app/settings" />
        <h2 className="text-xl font-bold text-text">{settings.security.heading}</h2>
      </div>
      <section aria-labelledby="password-h" className="flex flex-col gap-4">
        <h3 id="password-h" className="text-lg font-bold text-text">
          {passwordSettings.heading}
        </h3>
        <PasswordForm hasPassword={hasPassword} email={user.email} />
      </section>
      {hasPassword ? <ResetByEmail email={user.email} /> : null}
      <ChangeEmailForm email={user.email} hasPassword={hasPassword} />
    </div>
  );
}
