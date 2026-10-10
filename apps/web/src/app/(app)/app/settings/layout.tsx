import type { ReactNode } from "react";
import { PageHeader } from "@/components/app/page-header";
import { SettingsNav } from "@/components/app/settings-nav";
import { settings } from "@/content/app";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageHeader title={settings.title} />
      <div className="mx-auto grid w-full max-w-5xl gap-6 p-4 md:grid-cols-[16rem_minmax(0,1fr)] md:p-6">
        <div className="hidden md:block">
          <SettingsNav mode="sidebar" />
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </>
  );
}
