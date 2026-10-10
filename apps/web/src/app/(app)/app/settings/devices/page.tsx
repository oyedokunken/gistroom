import type { Metadata } from "next";
import { BackLink } from "@/components/app/back-link";
import { DevicesList } from "@/components/app/devices-list";
import { settings } from "@/content/app";

export const metadata: Metadata = { title: settings.devices.heading };

export default function DevicesSettingsPage() {
  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/app/settings" />
      <h2 className="text-xl font-bold text-text">{settings.devices.heading}</h2>
      <DevicesList />
    </div>
  );
}
