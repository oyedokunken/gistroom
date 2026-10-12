import type { Metadata } from "next";
import { SettingsNav } from "@/components/app/settings-nav";
import { SignOutButton } from "@/components/app/sign-out-button";
import { TourButton } from "@/components/app/tour";
import { settings } from "@/content/app";

export const metadata: Metadata = { title: settings.title };

/** Phones land here and pick a section. On wider screens the sidebar already shows the list. */
export default function SettingsIndexPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="md:hidden">
        <SettingsNav mode="index" />
      </div>
      <div className="hidden text-text-muted md:block">{settings.sections[0]?.description}</div>
      <div className="flex flex-wrap gap-3">
        <TourButton />
        <SignOutButton />
      </div>
    </div>
  );
}
