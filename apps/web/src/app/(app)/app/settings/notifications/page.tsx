import type { Metadata } from "next";
import { BackLink } from "@/components/app/back-link";
import { NotificationPrefsForm } from "@/components/app/notification-prefs-form";
import { PushCard } from "@/components/app/push-card";
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
      <NotificationPrefsForm />
    </div>
  );
}
