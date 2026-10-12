import type { Metadata } from "next";
import { AccountPanel } from "@/components/app/account-panel";
import { BackLink } from "@/components/app/back-link";
import { settings } from "@/content/app";
import { requireUserForPage } from "@/server/auth/page";

export const metadata: Metadata = { title: settings.account.heading };

export default async function AccountSettingsPage() {
  const { user } = await requireUserForPage();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <BackLink href="/app/settings" />
        <h2 className="text-xl font-bold text-text">{settings.account.heading}</h2>
      </div>
      <AccountPanel hasPassword={user.passwordHash !== null} />
    </div>
  );
}
