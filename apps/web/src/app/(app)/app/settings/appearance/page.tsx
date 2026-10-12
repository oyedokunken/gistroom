import type { Metadata } from "next";
import { BackLink } from "@/components/app/back-link";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { settings } from "@/content/app";

export const metadata: Metadata = { title: settings.appearance.heading };

export default function AppearanceSettingsPage() {
  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/app/settings" />
      <h2 className="text-xl font-bold text-text">{settings.appearance.heading}</h2>
      <p className="text-text-muted">{settings.appearance.intro}</p>
      <ThemeToggle className="w-fit border border-border" />
    </div>
  );
}
