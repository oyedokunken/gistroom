import type { Metadata } from "next";
import { BackLink } from "@/components/app/back-link";
import { InstallCard } from "@/components/app/install-card";
import { notifySettings } from "@/content/app";

export const metadata: Metadata = { title: notifySettings.installHeading };

export default function InstallSettingsPage() {
  return (
    <div className="flex w-full flex-col gap-4">
      <BackLink href="/app/settings" />
      <h2 className="text-xl font-bold text-text">{notifySettings.installHeading}</h2>
      <p className="text-text-muted">{notifySettings.installIntro}</p>
      <InstallCard always />
    </div>
  );
}
