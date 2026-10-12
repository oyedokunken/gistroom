import type { Metadata } from "next";
import { BackLink } from "@/components/app/back-link";
import { InterestsSettings } from "@/components/interests/interests-settings";
import { settings } from "@/content/app";
import { requireUserForPage } from "@/server/auth/page";
import { getInterests } from "@/server/interests/service";

export const metadata: Metadata = { title: settings.interests.heading };

export default async function InterestsSettingsPage() {
  const { user } = await requireUserForPage();
  const current = await getInterests(user.id);
  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/app/settings" />
      <h2 className="text-xl font-bold text-text">{settings.interests.heading}</h2>
      <p className="text-text-muted">{settings.interests.intro}</p>
      <InterestsSettings initial={current} />
    </div>
  );
}
