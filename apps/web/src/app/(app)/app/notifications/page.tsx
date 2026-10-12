import type { Metadata } from "next";
import { InstallCard } from "@/components/app/install-card";
import { NotificationsList } from "@/components/app/notifications-list";
import { PageShell } from "@/components/app/page-shell";
import { PushCard } from "@/components/app/push-card";
import { notices } from "@/content/app";

export const metadata: Metadata = { title: notices.title };

export default function NotificationsPage() {
  return (
    <PageShell variant="full" title={notices.title}>
      <div className="flex flex-col gap-4">
        <PushCard />
        <InstallCard />
        <NotificationsList />
      </div>
    </PageShell>
  );
}
