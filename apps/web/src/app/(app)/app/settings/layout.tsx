import type { ReactNode } from "react";
import { PageHeader } from "@/components/app/page-header";
import { SettingsNav } from "@/components/app/settings-nav";
import { settings } from "@/content/app";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageHeader title={settings.title} />
      <div className="mx-auto grid w-full max-w-[1000px] gap-6 px-4 py-6 md:grid-cols-[16rem_minmax(0,1fr)] md:px-6">
        <div className="hidden md:block">
          <SettingsNav mode="sidebar" />
        </div>
        <div data-page-shell="narrow" className="w-full min-w-0 max-w-[720px]">
          {children}
        </div>
      </div>
    </>
  );
}
