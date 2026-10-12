import type { Metadata } from "next";
import { BackLink } from "@/components/app/back-link";
import { CalmSwitch, DataSaverForm } from "@/components/app/settings-forms";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { settings } from "@/content/app";
import { requireUserForPage } from "@/server/auth/page";
import { toMe } from "@/server/users/serialize";

export const metadata: Metadata = { title: settings.appearance.heading };

export default async function AppearanceSettingsPage() {
  const { user } = await requireUserForPage();
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-4">
        <BackLink href="/app/settings" />
        <h2 className="text-xl font-bold text-text">{settings.appearance.heading}</h2>
      </div>
      <section aria-labelledby="theme-h" className="flex flex-col gap-3">
        <h3 id="theme-h" className="text-lg font-bold text-text">
          {settings.appearance.themeHeading}
        </h3>
        <p className="text-text-muted">{settings.appearance.intro}</p>
        <ThemeToggle className="w-fit border border-border" />
        <CalmSwitch />
      </section>
      <section aria-labelledby="data-h" className="flex flex-col gap-3">
        <h3 id="data-h" className="text-lg font-bold text-text">
          {settings.appearance.dataHeading}
        </h3>
        <DataSaverForm user={toMe(user)} />
      </section>
    </div>
  );
}
