import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SettingsNav } from "@/components/app/settings-nav";
import { SignOutButton } from "@/components/app/sign-out-button";
import { TourButton } from "@/components/app/tour";
import { settings } from "@/content/app";

export const metadata: Metadata = { title: settings.title };

/**
 * Wide screens have the section list in a sidebar, so there is nothing to choose here: go straight to Profile.
 * Phones have no sidebar and pick a section from this list.
 */
export default async function SettingsIndexPage() {
  const agent = (await headers()).get("user-agent") ?? "";
  const phone = /Android.+Mobile|iPhone|iPod|Mobile Safari/i.test(agent);
  if (!phone) redirect("/app/settings/profile");
  return (
    <div className="flex flex-col gap-6">
      <SettingsNav mode="index" />
      <div className="flex flex-wrap gap-3">
        <TourButton />
        <SignOutButton />
      </div>
    </div>
  );
}
