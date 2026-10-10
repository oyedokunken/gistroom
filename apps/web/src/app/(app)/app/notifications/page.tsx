import type { Metadata } from "next";
import { InstallCard } from "@/components/app/install-card";
import { NotificationsList } from "@/components/app/notifications-list";
import { PageHeader } from "@/components/app/page-header";
import { PushCard } from "@/components/app/push-card";
import { notices } from "@/content/app";

export const metadata: Metadata = { title: notices.title };

export default function NotificationsPage() {
  return (
    <>
      <PageHeader title={notices.title} />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
        <PushCard />
        <InstallCard />
        <NotificationsList />
      </div>
    </>
  );
}
