import type { Metadata } from "next";
import { BackLink } from "@/components/app/back-link";
import { DataSaverForm } from "@/components/app/settings-forms";
import { settings } from "@/content/app";
import { requireUserForPage } from "@/server/auth/page";
import { toMe } from "@/server/users/serialize";

export const metadata: Metadata = { title: settings.data.heading };

export default async function DataSettingsPage() {
  const { user } = await requireUserForPage();
  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/app/settings" />
      <h2 className="text-xl font-bold text-text">{settings.data.heading}</h2>
      <DataSaverForm user={toMe(user)} />
    </div>
  );
}
