import type { Metadata } from "next";
import { BackLink } from "@/components/app/back-link";
import { SoundSettingsCard } from "@/components/app/sound-settings";
import { NotificationPrefsForm } from "@/components/app/notification-prefs-form";
import { PushCard } from "@/components/app/push-card";
import { PushHealth } from "@/components/app/push-health";
import { notifySettings } from "@/content/app";

export const metadata: Metadata = { title: notifySettings.heading };

export default function NotificationSettingsPage() {
  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/app/settings" />
      <h2 className="text-xl font-bold text-text">{notifySettings.heading}</h2>
      <div className="w-full">
        <PushCard />
      </div>
      <PushHealth />
      <NotificationPrefsForm />
      <SoundSettingsCard />
    </div>
  );
}
