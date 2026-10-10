import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { pages } from "@/content/app";

export const metadata: Metadata = { title: pages.notifications.title };

export default function Page() {
  return (
    <>
      <PageHeader title={pages.notifications.title} />
      <EmptyState artId="empty-notifications" title={pages.notifications.empty} />
    </>
  );
}
